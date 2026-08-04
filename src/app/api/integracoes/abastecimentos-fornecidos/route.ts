import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_ABASTECIMENTOS_FORNECIDOS_WRITE } from "@/lib/apiKeys";
import { garantirVeiculoCadastrado, garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";
import { empresaDonaDoVeiculoAcao } from "@/lib/empresasGrupo";

// Fase 27.144 — pedido do Daniel: "na aba de integrações na visão de
// postos, criar o mecanismo de integração com softwares de automação de
// postos para integrar abastecimentos realizados [...] todos os detalhes do
// abastecimento". Mesmo padrão do Hub de Integrações (Fase 25): chave
// própria (Authorization: Bearer <chave>), gerada pelo POSTO em
// /integracoes, escopo "abastecimentos_fornecidos:write".
//
// Diferença chave em relação a /api/integracoes/abastecimentos (Fase 25,
// lado FROTA): lá quem detém a chave é o cliente e o abastecimento cai
// direto em empresa_id = chave.empresaId. Aqui é o POSTO quem detém a
// chave — o abastecimento pertence ao CLIENTE que ele atendeu, então o
// corpo da requisição precisa informar o CNPJ desse cliente
// ("cliente_cnpj"), resolvido pra empresa_id na hora (cliente precisa já
// estar cadastrado na FNI como empresa segmento="Frota" — se não achar,
// devolve erro claro em vez de inventar/deixar nulo). CNPJ e nome do
// próprio posto nunca vêm do corpo — são sempre os da empresa dona da
// chave (chave.empresaId), pra um posto nunca conseguir lançar venda em
// nome de outro posto.
//
// Cai na mesma tabela abastecimentos_externos da Fase 25/27.136 — por
// isso entra automaticamente nos mesmos indicadores financeiros, cobrança
// (fatura_posto_id), pedido de ajuste (Fase 27.142) e NF-e (Fase 27.136b)
// que qualquer outro meio de pagamento externo.
export const runtime = "nodejs";

type CorpoRequisicao = {
  cliente_cnpj?: string;
  sistema?: string;
  placa?: string;
  motorista_nome?: string;
  motorista_cpf?: string;
  data_abastecimento?: string;
  hodometro?: number;
  combustivel?: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
  transacao_externa_id?: string;
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_ABASTECIMENTOS_FORNECIDOS_WRITE);
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

  const clienteCnpj = corpo.cliente_cnpj?.trim();
  if (!clienteCnpj) {
    return NextResponse.json({ erro: '"cliente_cnpj" é obrigatório (CNPJ do cliente que abasteceu).' }, { status: 400 });
  }

  const sistema = corpo.sistema?.trim();
  if (!sistema) {
    return NextResponse.json(
      { erro: '"sistema" é obrigatório (nome do software de automação, ex: "tanknomia").' },
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

  // Fase fidelidade-por-CPF (23/07/26) — mesmo campo do endpoint Fase 25
  // (lado frota): CPF opcional do motorista pra identificação determinística
  // na fidelidade/gamificação. Dígitos puros no banco.
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

  // Fase 27.144 — resolve o cliente (CNPJ -> empresa_id) ignorando a RLS de
  // `empresas` (SECURITY DEFINER, mesma RPC já usada em
  // /abastecimentos/[id] pra resolver o posto a partir do lado cliente —
  // aqui é o caminho inverso).
  const { data: empresaClienteId } = await supabase.rpc("resolver_empresa_por_cnpj_segmento", {
    p_cnpj: clienteCnpj,
    p_segmento: "Frota",
  });
  if (!empresaClienteId) {
    return NextResponse.json(
      { erro: `Nenhum cliente (Frota) cadastrado na FNI com o CNPJ "${clienteCnpj}".` },
      { status: 404 }
    );
  }

  // Posto vem sempre da chave, nunca do corpo (ver comentário do arquivo).
  const { data: posto } = await supabase.from("empresas").select("cnpj, nome").eq("id", chave.empresaId).maybeSingle();

  // Fase Reuso-Operacional-Grupo (Fase 3) — se a placa já tem cadastro e
  // pertence a uma empresa IRMÃ do cliente informado em "cliente_cnpj" (ex.:
  // o posto reporta um abastecimento pro CNPJ da empresa B, mas a placa é
  // de um veículo da empresa A, irmã de B no mesmo grupo econômico), o
  // custo fica com a empresa DONA do veículo — mesmo critério já aplicado
  // no endpoint irmão (/api/integracoes/abastecimentos), no lançamento
  // manual, na importação XLSX e no trigger da PróFrotas.
  const empresaDonaVeiculo = await empresaDonaDoVeiculoAcao(supabase, placa);
  const empresaIdAbastecimento = empresaDonaVeiculo ?? empresaClienteId;

  const { data: registro, error: erroInsert } = await supabase
    .from("abastecimentos_externos")
    .insert({
      empresa_id: empresaIdAbastecimento,
      provedor: sistema,
      placa,
      motorista_nome: corpo.motorista_nome?.trim() || null,
      motorista_cpf: motoristaCpf,
      data_abastecimento: dataAbastecimento.toISOString(),
      hodometro: corpo.hodometro != null ? Number(corpo.hodometro) : null,
      posto_nome: posto?.nome ?? null,
      posto_cnpj: posto?.cnpj ?? null,
      combustivel: corpo.combustivel?.trim() || null,
      quantidade,
      valor_unitario: corpo.valor_unitario != null ? Number(corpo.valor_unitario) : null,
      valor_total: valorTotal,
      transacao_externa_id: corpo.transacao_externa_id?.trim() || null,
    })
    .select("id")
    .single();

  if (erroInsert) {
    // Conflito de idempotência (mesmo cliente + sistema + transacao_externa_id
    // já recebido antes) não é erro do integrador — devolve 200 em vez de
    // 500, pra sistemas que reenviam a mesma transação (retry) não
    // precisarem tratar isso como falha (mesmo padrão do endpoint Fase 25).
    if (erroInsert.code === "23505") {
      return NextResponse.json({ status: "ja_existia" }, { status: 200 });
    }
    return NextResponse.json({ erro: `Não foi possível salvar: ${erroInsert.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  // Fase auto-cadastro-abastecimento (27/07/2026) — garante que a placa (e o
  // motorista, se veio nome/CPF) já existam em cadastro_veiculos/motoristas
  // do CLIENTE (não do posto), mesmo que mínimos e pendentes de revisão.
  // Busca o cnpj canônico da empresa em vez de reusar clienteCnpj cru (pode
  // vir com formatação diferente da já usada nos veículos existentes dela).
  const { data: clienteEmpresa } = await supabase
    .from("empresas")
    .select("cnpj")
    .eq("id", empresaClienteId)
    .maybeSingle();
  if (clienteEmpresa?.cnpj) {
    await garantirVeiculoCadastrado(supabase, clienteEmpresa.cnpj, placa);
  }
  if (corpo.motorista_nome?.trim()) {
    await garantirMotoristaCadastrado(supabase, empresaClienteId, {
      nomeCompleto: corpo.motorista_nome,
      cpf: motoristaCpf,
    });
  }

  return NextResponse.json({ id: registro.id, status: "criado" }, { status: 201 });
}
