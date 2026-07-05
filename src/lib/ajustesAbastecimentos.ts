import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.65 — solicitação de ajuste em abastecimentos, com aprovação da
// contraparte (cliente <-> posto). Mesma máquina de estados de
// negociacoesPostos.ts (Fase 27.50) — cabeçalho + rodadas, turno alternado,
// contraproposta em vez de recusa definitiva. Diferença chave: quando
// aceita, os campos propostos são de fato aplicados em
// profrotas_abastecimentos (não é só "fotografado" como em negociação) —
// por isso decidirAjuste chama a RPC SECURITY DEFINER
// decidir_ajuste_abastecimento (ver migração), que valida autorização e
// aplica tudo atomicamente no banco.

export const STATUS_AJUSTE = ["pendente_posto", "pendente_cliente", "aceito", "recusado", "cancelado"] as const;
export type StatusAjuste = (typeof STATUS_AJUSTE)[number];

export const STATUS_AJUSTE_LABEL: Record<StatusAjuste, string> = {
  pendente_posto: "Aguardando posto",
  pendente_cliente: "Aguardando cliente",
  aceito: "Aceito",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export type AutorAjuste = "cliente" | "posto";

type ClienteSupabase = SupabaseClient<Database>;

// Fase 27.65 — campos ajustáveis confirmados com o Daniel: os principais
// (não inclui placa/motorista/posto, mudança mais rara e mais sensível —
// essa continua só pela edição direta, quando não há contraparte).
export type CamposAjuste = {
  data_abastecimento?: string | null;
  hodometro?: number | null;
  item_nome?: string | null;
  item_quantidade?: number | null;
  item_valor_unitario?: number | null;
  item_valor_total?: number | null;
};

export const LABEL_CAMPO_AJUSTE: Record<keyof CamposAjuste, string> = {
  data_abastecimento: "Data/hora",
  hodometro: "Hodômetro",
  item_nome: "Combustível",
  item_quantidade: "Litros",
  item_valor_unitario: "Preço por litro",
  item_valor_total: "Valor total",
};

export function validarCamposAjuste(campos: CamposAjuste): string | null {
  const preenchidos = Object.values(campos).filter((v) => v !== null && v !== undefined && v !== "");
  if (preenchidos.length === 0) return "Preencha ao menos um campo para propor o ajuste.";
  if (campos.hodometro != null && (!Number.isFinite(campos.hodometro) || campos.hodometro < 0)) {
    return "Hodômetro inválido.";
  }
  if (campos.item_quantidade != null && (!Number.isFinite(campos.item_quantidade) || campos.item_quantidade <= 0)) {
    return "Litros inválido.";
  }
  if (campos.item_valor_unitario != null && (!Number.isFinite(campos.item_valor_unitario) || campos.item_valor_unitario <= 0)) {
    return "Preço por litro inválido.";
  }
  if (campos.item_valor_total != null && (!Number.isFinite(campos.item_valor_total) || campos.item_valor_total <= 0)) {
    return "Valor total inválido.";
  }
  if (campos.data_abastecimento && Number.isNaN(Date.parse(campos.data_abastecimento))) {
    return "Data/hora inválida.";
  }
  return null;
}

// Cria a solicitação (cabeçalho + rodada 1).
export async function criarSolicitacaoAjuste(
  supabase: ClienteSupabase,
  params: {
    abastecimentoId: number;
    empresaClienteId: string;
    empresaPostoId: string;
    autor: AutorAjuste;
    campos: CamposAjuste;
    motivo: string | null;
    criadoPor: string | null;
  }
): Promise<{ id: string } | { erro: string }> {
  const erroValidacao = validarCamposAjuste(params.campos);
  if (erroValidacao) return { erro: erroValidacao };

  const status: StatusAjuste = params.autor === "cliente" ? "pendente_posto" : "pendente_cliente";

  const { data: ajuste, error } = await supabase
    .from("ajustes_abastecimentos")
    .insert({
      abastecimento_id: params.abastecimentoId,
      empresa_cliente_id: params.empresaClienteId,
      empresa_posto_id: params.empresaPostoId,
      origem: params.autor,
      status,
      rodada_atual: 1,
      criado_por: params.criadoPor,
      atualizado_por: params.criadoPor,
    })
    .select("id")
    .single();

  if (error || !ajuste) {
    // Índice único parcial (1 ajuste em aberto por abastecimento) — mensagem
    // amigável em vez do erro cru de constraint.
    if (error?.code === "23505") {
      return { erro: "Já existe uma solicitação de ajuste em aberto para este abastecimento." };
    }
    return { erro: error?.message ?? "Não foi possível criar a solicitação de ajuste." };
  }

  const { error: erroRodada } = await supabase.from("ajustes_abastecimentos_rodadas").insert({
    ajuste_id: ajuste.id,
    numero_rodada: 1,
    autor: params.autor,
    motivo: params.motivo,
    decisao: "pendente",
    ...params.campos,
  });

  if (erroRodada) return { erro: erroRodada.message };

  return { id: ajuste.id };
}

// Contraproposta — mesma lógica de adicionarContraproposta em
// negociacoesPostos.ts.
export async function adicionarContrapropostaAjuste(
  supabase: ClienteSupabase,
  params: { ajusteId: string; autor: AutorAjuste; campos: CamposAjuste; motivo: string | null; decididoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  const erroValidacao = validarCamposAjuste(params.campos);
  if (erroValidacao) return { erro: erroValidacao };

  const { data: ajuste, error: erroBusca } = await supabase
    .from("ajustes_abastecimentos")
    .select("id, status, rodada_atual")
    .eq("id", params.ajusteId)
    .maybeSingle();

  if (erroBusca || !ajuste) return { erro: "Solicitação de ajuste não encontrada." };
  if (ajuste.status === "aceito" || ajuste.status === "recusado" || ajuste.status === "cancelado") {
    return { erro: "Esta solicitação já foi encerrada e não aceita novas rodadas." };
  }

  const statusEsperado: StatusAjuste = params.autor === "cliente" ? "pendente_cliente" : "pendente_posto";
  if (ajuste.status !== statusEsperado) {
    return { erro: "Não é a sua vez de responder esta solicitação." };
  }

  const novaRodada = ajuste.rodada_atual + 1;
  const agora = new Date().toISOString();

  const { error: erroFechaAnterior } = await supabase
    .from("ajustes_abastecimentos_rodadas")
    .update({ decisao: "contraproposta", decidido_em: agora, decidido_por: params.decididoPor })
    .eq("ajuste_id", params.ajusteId)
    .eq("numero_rodada", ajuste.rodada_atual);
  if (erroFechaAnterior) return { erro: erroFechaAnterior.message };

  const { error: erroInsereNova } = await supabase.from("ajustes_abastecimentos_rodadas").insert({
    ajuste_id: params.ajusteId,
    numero_rodada: novaRodada,
    autor: params.autor,
    motivo: params.motivo,
    decisao: "pendente",
    ...params.campos,
  });
  if (erroInsereNova) return { erro: erroInsereNova.message };

  const novoStatus: StatusAjuste = params.autor === "cliente" ? "pendente_posto" : "pendente_cliente";
  const { error: erroAtualizaCabecalho } = await supabase
    .from("ajustes_abastecimentos")
    .update({ status: novoStatus, rodada_atual: novaRodada, atualizado_em: agora, atualizado_por: params.decididoPor })
    .eq("id", params.ajusteId);
  if (erroAtualizaCabecalho) return { erro: erroAtualizaCabecalho.message };

  return { ok: true };
}

// Aceita ou recusa — delega pra RPC SECURITY DEFINER (ver migração
// decidir_ajuste_abastecimento_rpc): precisa aplicar em
// profrotas_abastecimentos quando aceita, e a RLS comum de update dessa
// tabela não cobre o lado do posto aceitando proposta do cliente (nem
// vice-versa).
export async function decidirAjuste(
  supabase: ClienteSupabase,
  params: { ajusteId: string; decisao: "aceita" | "recusada"; decididoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  const { error } = await supabase.rpc("decidir_ajuste_abastecimento", {
    p_ajuste_id: params.ajusteId,
    p_decisao: params.decisao,
    p_decidido_por: params.decididoPor,
  });
  if (error) return { erro: error.message };
  return { ok: true };
}

export async function cancelarAjuste(
  supabase: ClienteSupabase,
  ajusteId: string,
  canceladoPor: string | null
): Promise<{ ok: true } | { erro: string }> {
  const { error } = await supabase
    .from("ajustes_abastecimentos")
    .update({ status: "cancelado", atualizado_em: new Date().toISOString(), atualizado_por: canceladoPor })
    .eq("id", ajusteId)
    .in("status", ["pendente_posto", "pendente_cliente"]);
  if (error) return { erro: error.message };
  return { ok: true };
}
