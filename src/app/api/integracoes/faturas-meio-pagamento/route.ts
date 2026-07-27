import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_FATURAS_MEIO_PAGAMENTO_WRITE } from "@/lib/apiKeys";
import { garantirVeiculoCadastrado, garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";

// Fase Financeiro-ERP (26/07/2026, pedido do Daniel) — substitui, pra quem
// já é um meio de pagamento de verdade (Ticket Log, Edenred, Veloe,
// RedeFrota, Valecard...), o modelo antigo em que a FNI recalculava ciclo
// e emitia boleto própria (gerar_faturas_postos_robo() + ProvedorCobranca
// — isso continua existindo, mas só pra negociação DIRETA posto↔frotista
// dentro da plataforma, sem provedor terceiro no meio).
//
// Aqui é o PRÓPRIO provedor quem já fechou e vai cobrar a fatura fora da
// FNI — ele só empurra o cabeçalho (valor, vencimento, período) + os
// abastecimentos atrelados a ela, e a FNI registra isso como contas a
// pagar do cliente (ERP financeiro), sem tentar recalcular nada.
//
// Mesma posse de chave de /api/integracoes/abastecimentos (Fase 25): quem
// gera a chave é o CLIENTE (frotista) na tela /integracoes e entrega pro
// seu provedor configurar — o provedor nunca tem chave própria "global",
// então "empresa_id" sempre vem de chave.empresaId, nunca do corpo.
export const runtime = "nodejs";

type ItemAbastecimento = {
  transacao_externa_id?: string;
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
};

type CorpoRequisicao = {
  provedor?: string;
  numero_fatura_externa?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  vencimento?: string;
  valor_total?: number;
  observacoes?: string;
  abastecimentos?: ItemAbastecimento[];
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_FATURAS_MEIO_PAGAMENTO_WRITE);
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
      { erro: '"provedor" é obrigatório (ex: "TicketLog", "Edenred", "Veloe").' },
      { status: 400 }
    );
  }

  const vencimento = corpo.vencimento?.trim();
  if (!vencimento || Number.isNaN(new Date(vencimento).getTime())) {
    return NextResponse.json(
      { erro: '"vencimento" é obrigatório (data ISO, ex: "2026-08-10").' },
      { status: 400 }
    );
  }

  const itens = Array.isArray(corpo.abastecimentos) ? corpo.abastecimentos : [];

  // valor_total pode vir explícito (é o que o provedor efetivamente vai
  // cobrar) — se não vier, calculamos a partir da soma dos itens, mas só
  // como fallback (o valor da fatura pode legitimamente incluir taxas/
  // ajustes que não aparecem item a item).
  let valorTotal = corpo.valor_total != null ? Number(corpo.valor_total) : NaN;
  if (!Number.isFinite(valorTotal)) {
    valorTotal = itens.reduce((soma, item) => soma + (Number(item.valor_total) || 0), 0);
  }
  if (!Number.isFinite(valorTotal) || valorTotal < 0) {
    return NextResponse.json(
      { erro: '"valor_total" precisa ser um número maior ou igual a zero (ou informe os itens em "abastecimentos").' },
      { status: 400 }
    );
  }

  const numeroFaturaExterna = corpo.numero_fatura_externa?.trim() || null;

  // Idempotência: reenvio da mesma fatura (mesmo provedor + número) não é
  // erro — devolve 200 sem duplicar, mesmo padrão dos outros endpoints do
  // Hub de Integrações.
  if (numeroFaturaExterna) {
    const { data: existente } = await supabase
      .from("faturas_recebidas")
      .select("id")
      .eq("empresa_id", chave.empresaId)
      .eq("provedor", provedor)
      .eq("numero_fatura_externa", numeroFaturaExterna)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({ id: existente.id, status: "ja_existia" }, { status: 200 });
    }
  }

  const { data: fatura, error: erroFatura } = await supabase
    .from("faturas_recebidas")
    .insert({
      empresa_id: chave.empresaId,
      provedor,
      numero_fatura_externa: numeroFaturaExterna,
      periodo_inicio: corpo.periodo_inicio?.trim() || null,
      periodo_fim: corpo.periodo_fim?.trim() || null,
      vencimento,
      valor_total: valorTotal,
      quantidade_abastecimentos: itens.length,
      observacoes: corpo.observacoes?.trim() || null,
    })
    .select("id")
    .single();

  if (erroFatura || !fatura) {
    if (erroFatura?.code === "23505") {
      return NextResponse.json({ status: "ja_existia" }, { status: 200 });
    }
    return NextResponse.json({ erro: `Não foi possível registrar a fatura: ${erroFatura?.message}` }, { status: 500 });
  }

  // Título de contas a pagar do cliente — origem/referencia_id apontam pra
  // esta fatura, mesmo padrão de contas_receber (origem/referencia_id ->
  // faturas_postos.id) já usado no resto do app.
  const { error: erroContaPagar } = await supabase.from("contas_pagar").insert({
    empresa_id: chave.empresaId,
    origem: "fatura_meio_pagamento",
    referencia_id: fatura.id,
    credor_nome: provedor,
    descricao:
      corpo.periodo_inicio && corpo.periodo_fim
        ? `Fatura ${provedor} — período ${corpo.periodo_inicio} a ${corpo.periodo_fim}`
        : `Fatura ${provedor}`,
    valor_original: valorTotal,
    vencimento,
    observacoes: corpo.observacoes?.trim() || null,
  });

  if (erroContaPagar) {
    return NextResponse.json(
      { erro: `Fatura registrada, mas falhou ao gerar o título de contas a pagar: ${erroContaPagar.message}` },
      { status: 500 }
    );
  }

  // Abastecimentos atrelados — mesma tabela abastecimentos_externos usada
  // por qualquer outro meio de pagamento integrado (Fase 25), só que já
  // nascem com fatura_recebida_id preenchido (nunca precisam do robô de
  // negociação direta pra serem cobrados). Upsert por (empresa_id,
  // provedor, transacao_externa_id) — mesma chave de idempotência da Fase
  // 25 — então reenviar a mesma fatura/itens é seguro.
  // Fase auto-cadastro-abastecimento (27/07/2026) — pedido do Daniel: não é
  // só a PróFrotas, é QUALQUER integração de meio de pagamento (Ticket Log,
  // Edenred, Veloe, RedeFrota, Valecard...) que deve gerar cadastro
  // automático de placa/motorista. Resolvido uma única vez fora do loop
  // (cnpj_frota é o mesmo pra toda a fatura — não muda por item).
  const { data: empresaFatura } = await supabase.from("empresas").select("cnpj").eq("id", chave.empresaId).maybeSingle();

  let itensGravados = 0;
  const itensSemTransacaoId: number[] = [];
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (!item.transacao_externa_id?.trim()) {
      itensSemTransacaoId.push(i);
      continue;
    }
    const dataAbastecimento = item.data_abastecimento ? new Date(item.data_abastecimento) : null;
    const { error: erroItem } = await supabase.from("abastecimentos_externos").upsert(
      {
        empresa_id: chave.empresaId,
        provedor,
        placa: item.placa?.trim().toUpperCase() || "",
        motorista_nome: item.motorista_nome?.trim() || null,
        motorista_cpf: item.motorista_cpf?.replace(/\D/g, "") || null,
        data_abastecimento: dataAbastecimento && !Number.isNaN(dataAbastecimento.getTime())
          ? dataAbastecimento.toISOString()
          : new Date().toISOString(),
        hodometro: item.hodometro != null ? Number(item.hodometro) : null,
        posto_nome: item.posto_nome?.trim() || null,
        posto_cnpj: item.posto_cnpj?.trim() || null,
        combustivel: item.combustivel?.trim() || null,
        quantidade: Number(item.quantidade) || 0,
        valor_unitario: item.valor_unitario != null ? Number(item.valor_unitario) : null,
        valor_total: Number(item.valor_total) || 0,
        transacao_externa_id: item.transacao_externa_id.trim(),
        fatura_recebida_id: fatura.id,
      },
      { onConflict: "empresa_id,provedor,transacao_externa_id" }
    );
    if (!erroItem) {
      itensGravados++;
      if (empresaFatura?.cnpj && item.placa?.trim()) {
        await garantirVeiculoCadastrado(supabase, empresaFatura.cnpj, item.placa);
      }
      if (item.motorista_nome?.trim()) {
        await garantirMotoristaCadastrado(supabase, chave.empresaId, {
          nomeCompleto: item.motorista_nome,
          cpf: item.motorista_cpf,
        });
      }
    }
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json(
    {
      id: fatura.id,
      status: "criado",
      itens_recebidos: itens.length,
      itens_gravados: itensGravados,
      itens_sem_transacao_externa_id: itensSemTransacaoId,
    },
    { status: 201 }
  );
}
