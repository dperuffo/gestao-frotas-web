import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_ABASTECIMENTOS_WRITE } from "@/lib/apiKeys";

// API pública pra provedores de cartão de combustível (Ticket Log, Alelo
// Fleet, Repom etc.) lançarem transações de abastecimento direto na FNI —
// Fase 25 (Hub de Integrações). Diferente da PróFrotas (Fase 11, que é
// puxada por cron com token próprio do parceiro), aqui é o provedor que
// empurra cada transação assim que ela acontece, autenticado pela chave de
// API do cliente (mesmo padrão de custos-fixos). Os dados caem em
// abastecimentos_externos, tabela genérica (não acoplada ao formato de
// nenhum provedor específico) que os indicadores financeiros somam junto
// com profrotas_abastecimentos — ver indicadores_financeiros() e
// indicadores_financeiros_evolucao() no banco.
export const runtime = "nodejs";

type CorpoRequisicao = {
  provedor?: string;
  placa?: string;
  motorista_nome?: string;
  motorista_cpf?: string;
  data_abastecimento?: string;
  hodometro?: number;
  posto_nome?: string;
  posto_cnpj?: string;
  combustivel?: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
  transacao_externa_id?: string;
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_ABASTECIMENTOS_WRITE);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  let corpo: CorpoRequisicao;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  const provedor = corpo.provedor?.trim();
  if (!provedor) {
    return NextResponse.json(
      { erro: '"provedor" é obrigatório (ex: "ticket_log", "alelo", "repom").' },
      { status: 400 }
    );
  }

  const placa = corpo.placa?.trim().toUpperCase();
  if (!placa) {
    return NextResponse.json({ erro: '"placa" é obrigatória.' }, { status: 400 });
  }

  const dataAbastecimento = corpo.data_abastecimento ? new Date(corpo.data_abastecimento) : null;
  if (!dataAbastecimento || Number.isNaN(dataAbastecimento.getTime())) {
    return NextResponse.json(
      { erro: '"data_abastecimento" precisa ser uma data/hora válida (ISO 8601, ex: "2026-07-03T14:30:00Z").' },
      { status: 400 }
    );
  }

  const quantidade = Number(corpo.quantidade);
  if (!Number.isFinite(quantidade) || quantidade < 0) {
    return NextResponse.json({ erro: '"quantidade" (litros) precisa ser um número maior ou igual a zero.' }, { status: 400 });
  }

  const valorTotal = Number(corpo.valor_total);
  if (!Number.isFinite(valorTotal) || valorTotal < 0) {
    return NextResponse.json({ erro: '"valor_total" precisa ser um número maior ou igual a zero.' }, { status: 400 });
  }

  // Fase fidelidade-por-CPF (23/07/26) — CPF do motorista, opcional mas
  // recomendado: é o que permite ao programa de fidelidade/gamificação
  // identificar o motorista com certeza (nome é texto livre e falha com
  // homônimos/grafia). Aceita com ou sem pontuação; armazena dígitos puros.
  let motoristaCpf: string | null = null;
  if (corpo.motorista_cpf != null && String(corpo.motorista_cpf).trim() !== "") {
    motoristaCpf = String(corpo.motorista_cpf).replace(/\D/g, "");
    if (motoristaCpf.length !== 11) {
      return NextResponse.json(
        { erro: '"motorista_cpf" precisa ter 11 dígitos (com ou sem pontuação, ex: "708.033.260-50").' },
        { status: 400 }
      );
    }
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("abastecimentos_externos")
    .insert({
      empresa_id: chave.empresaId,
      provedor,
      placa,
      motorista_nome: corpo.motorista_nome?.trim() || null,
      motorista_cpf: motoristaCpf,
      data_abastecimento: dataAbastecimento.toISOString(),
      hodometro: corpo.hodometro != null ? Number(corpo.hodometro) : null,
      posto_nome: corpo.posto_nome?.trim() || null,
      posto_cnpj: corpo.posto_cnpj?.trim() || null,
      combustivel: corpo.combustivel?.trim() || null,
      quantidade,
      valor_unitario: corpo.valor_unitario != null ? Number(corpo.valor_unitario) : null,
      valor_total: valorTotal,
      transacao_externa_id: corpo.transacao_externa_id?.trim() || null,
    })
    .select("id")
    .single();

  if (erroInsert) {
    // Conflito de idempotência (mesmo provedor + transacao_externa_id já
    // recebido antes) não é erro do integrador — devolve 200 em vez de 500,
    // pra provedores que reenviam a mesma transação (retry) não precisarem
    // tratar isso como falha.
    if (erroInsert.code === "23505") {
      return NextResponse.json({ status: "ja_existia" }, { status: 200 });
    }
    return NextResponse.json({ erro: `Não foi possível salvar: ${erroInsert.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ id: registro.id, status: "criado" }, { status: 201 });
}
