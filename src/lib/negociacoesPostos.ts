import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.50 — Negociação com Postos Revendedores.
//
// Centraliza aqui a máquina de estados da negociação (criar, contrapropor,
// decidir) porque ela é chamada de dois lugares diferentes: a API pública
// (/api/integracoes/negociacoes/*, client admin/service role, chamada pelo
// sistema do posto) e as Server Actions da tela /negociacoes (client com
// sessão do usuário, RLS ativo, chamada pelo cliente de frota OU por um
// usuário posto logado). Sem isso, a lógica de transição de status
// duplicaria e divergiria entre os dois lados.
export const STATUS_NEGOCIACAO = [
  "pendente_posto",
  "pendente_cliente",
  "aceita",
  "recusada",
  "cancelada",
] as const;
export type StatusNegociacao = (typeof STATUS_NEGOCIACAO)[number];

export const STATUS_NEGOCIACAO_LABEL: Record<StatusNegociacao, string> = {
  pendente_posto: "Aguardando posto",
  pendente_cliente: "Aguardando cliente",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export type AutorNegociacao = "cliente" | "posto";

type ClienteSupabase = SupabaseClient<Database>;

export type DadosRodada = {
  combustivel: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  volume_minimo_mensal: number;
  preco_unitario: number;
};

// Dispara a Edge Function "negociacao-email" (Resend) — best-effort, nunca
// bloqueia nem derruba a operação principal se o e-mail falhar (mesmo
// espírito de marcarUsoChaveApi em src/lib/apiAuth.ts). O badge no menu já
// cobre a notificação in-app; isto é só o aviso por e-mail complementar.
async function notificarNegociacao(
  supabase: ClienteSupabase,
  negociacaoId: string,
  evento: "nova_proposta" | "contraproposta" | "aceita" | "recusada"
): Promise<void> {
  try {
    await supabase.functions.invoke("negociacao-email", { body: { negociacao_id: negociacaoId, evento } });
  } catch (e) {
    console.error("[negociacoesPostos] falha ao notificar por e-mail (ignorado):", e);
  }
}

export function validarDadosRodada(d: Partial<DadosRodada>): string | null {
  if (!d.combustivel || !d.combustivel.trim()) return '"combustivel" é obrigatório.';
  if (!d.vigencia_inicio || Number.isNaN(Date.parse(d.vigencia_inicio))) {
    return '"vigencia_inicio" precisa ser uma data válida (ex: "2026-08-01").';
  }
  if (!d.vigencia_fim || Number.isNaN(Date.parse(d.vigencia_fim))) {
    return '"vigencia_fim" precisa ser uma data válida (ex: "2027-01-31").';
  }
  if (d.vigencia_fim < d.vigencia_inicio) {
    return '"vigencia_fim" não pode ser antes de "vigencia_inicio".';
  }
  const volume = Number(d.volume_minimo_mensal);
  if (!Number.isFinite(volume) || volume <= 0) {
    return '"volume_minimo_mensal" precisa ser um número maior que zero.';
  }
  const preco = Number(d.preco_unitario);
  if (!Number.isFinite(preco) || preco <= 0) {
    return '"preco_unitario" precisa ser um número maior que zero.';
  }
  return null;
}

// Cria a negociação (cabeçalho + rodada 1). origem indica quem começou o
// registro (tela do cliente, tela do posto, ou API do posto); autor indica
// de quem é a proposta inicial (normalmente o mesmo lado de origem, exceto
// quando um admin cria em nome de alguém).
export async function criarNegociacao(
  supabase: ClienteSupabase,
  params: {
    empresaClienteId: string;
    empresaPostoId: string | null;
    postoCnpj: string;
    origem: "cliente" | "posto" | "api";
    autor: AutorNegociacao;
    dados: DadosRodada;
    criadoPor: string | null;
  }
): Promise<{ id: string } | { erro: string }> {
  const erroValidacao = validarDadosRodada(params.dados);
  if (erroValidacao) return { erro: erroValidacao };

  const status: StatusNegociacao = params.autor === "cliente" ? "pendente_posto" : "pendente_cliente";

  // Fase 27.51 — achado real: mostrar o nome da CONTRAPARTE via join do
  // PostgREST pra empresas falha em silêncio pra quem está do outro lado
  // (RLS de empresas só libera enxergar quem é membro daquela empresa).
  // Por isso guardamos aqui um "retrato" do nome de cada lado, resolvido
  // via RPC SECURITY DEFINER (nome_empresa_publico, bypassa RLS só pra
  // devolver o nome, nada sensível) — nunca depende de quem está criando
  // já enxergar a empresa do outro lado.
  const [{ data: clienteNome }, { data: postoNome }] = await Promise.all([
    supabase.rpc("nome_empresa_publico", { p_empresa_id: params.empresaClienteId }),
    params.empresaPostoId
      ? supabase.rpc("nome_empresa_publico", { p_empresa_id: params.empresaPostoId })
      : Promise.resolve({ data: null as string | null }),
  ]);

  const { data: negociacao, error } = await supabase
    .from("negociacoes_postos")
    .insert({
      empresa_cliente_id: params.empresaClienteId,
      empresa_posto_id: params.empresaPostoId,
      posto_cnpj: params.postoCnpj,
      origem: params.origem,
      status,
      rodada_atual: 1,
      criado_por: params.criadoPor,
      cliente_nome: clienteNome ?? null,
      posto_nome: postoNome ?? null,
    })
    .select("id")
    .single();

  if (error || !negociacao) return { erro: error?.message ?? "Não foi possível criar a negociação." };

  const { error: erroRodada } = await supabase.from("negociacoes_postos_rodadas").insert({
    negociacao_id: negociacao.id,
    numero_rodada: 1,
    autor: params.autor,
    ...params.dados,
    decisao: "pendente",
  });

  if (erroRodada) return { erro: erroRodada.message };

  await notificarNegociacao(supabase, negociacao.id, "nova_proposta");

  return { id: negociacao.id };
}

// Adiciona uma nova rodada (contraproposta) a uma negociação existente —
// fecha a rodada atual com decisao="contraproposta" e abre a próxima.
export async function adicionarContraproposta(
  supabase: ClienteSupabase,
  params: { negociacaoId: string; autor: AutorNegociacao; dados: DadosRodada; decididoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  const erroValidacao = validarDadosRodada(params.dados);
  if (erroValidacao) return { erro: erroValidacao };

  const { data: negociacao, error: erroBusca } = await supabase
    .from("negociacoes_postos")
    .select("id, status, rodada_atual")
    .eq("id", params.negociacaoId)
    .maybeSingle();

  if (erroBusca || !negociacao) return { erro: "Negociação não encontrada." };
  if (negociacao.status === "aceita" || negociacao.status === "recusada" || negociacao.status === "cancelada") {
    return { erro: "Esta negociação já foi encerrada e não aceita novas rodadas." };
  }

  const statusEsperado: StatusNegociacao = params.autor === "cliente" ? "pendente_cliente" : "pendente_posto";
  if (negociacao.status !== statusEsperado) {
    return { erro: "Não é a sua vez de responder nesta negociação." };
  }

  const novaRodada = negociacao.rodada_atual + 1;
  const agora = new Date().toISOString();

  const { error: erroFechaAnterior } = await supabase
    .from("negociacoes_postos_rodadas")
    .update({ decisao: "contraproposta", decidido_em: agora, decidido_por: params.decididoPor })
    .eq("negociacao_id", params.negociacaoId)
    .eq("numero_rodada", negociacao.rodada_atual);
  if (erroFechaAnterior) return { erro: erroFechaAnterior.message };

  const { error: erroInsereNova } = await supabase.from("negociacoes_postos_rodadas").insert({
    negociacao_id: params.negociacaoId,
    numero_rodada: novaRodada,
    autor: params.autor,
    ...params.dados,
    decisao: "pendente",
  });
  if (erroInsereNova) return { erro: erroInsereNova.message };

  const novoStatus: StatusNegociacao = params.autor === "cliente" ? "pendente_posto" : "pendente_cliente";
  const { error: erroAtualizaCabecalho } = await supabase
    .from("negociacoes_postos")
    .update({ status: novoStatus, rodada_atual: novaRodada, atualizado_em: agora })
    .eq("id", params.negociacaoId);
  if (erroAtualizaCabecalho) return { erro: erroAtualizaCabecalho.message };

  await notificarNegociacao(supabase, params.negociacaoId, "contraproposta");

  return { ok: true };
}

// Aceita ou recusa a rodada pendente atual — decisão final, encerra a
// negociação (sem abrir nova rodada).
export async function decidirNegociacao(
  supabase: ClienteSupabase,
  params: { negociacaoId: string; autor: AutorNegociacao; decisao: "aceita" | "recusada"; decididoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  const { data: negociacao, error: erroBusca } = await supabase
    .from("negociacoes_postos")
    .select("id, status, rodada_atual")
    .eq("id", params.negociacaoId)
    .maybeSingle();

  if (erroBusca || !negociacao) return { erro: "Negociação não encontrada." };

  const statusEsperado: StatusNegociacao = params.autor === "cliente" ? "pendente_cliente" : "pendente_posto";
  if (negociacao.status !== statusEsperado) {
    return { erro: "Não é a sua vez de responder nesta negociação." };
  }

  const agora = new Date().toISOString();
  const { data: rodadaDecidida, error: erroRodada } = await supabase
    .from("negociacoes_postos_rodadas")
    .update({ decisao: params.decisao, decidido_em: agora, decidido_por: params.decididoPor })
    .eq("negociacao_id", params.negociacaoId)
    .eq("numero_rodada", negociacao.rodada_atual)
    .select("combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario")
    .single();
  if (erroRodada) return { erro: erroRodada.message };

  const novoStatus: StatusNegociacao = params.decisao === "aceita" ? "aceita" : "recusada";

  // Fase 27.54 — quando aceita, "fotografa" os termos da rodada vencedora
  // no cabeçalho (vigência, combustível, volume, preço) — é isso que
  // alimenta a aba "Vigentes" da tela /negociacoes, sem precisar de join
  // com negociacoes_postos_rodadas toda vez que a lista é exibida.
  const { error: erroCabecalho } = await supabase
    .from("negociacoes_postos")
    .update({
      status: novoStatus,
      atualizado_em: agora,
      ...(novoStatus === "aceita" && rodadaDecidida
        ? {
            combustivel: rodadaDecidida.combustivel,
            vigencia_inicio: rodadaDecidida.vigencia_inicio,
            vigencia_fim: rodadaDecidida.vigencia_fim,
            volume_minimo_mensal: rodadaDecidida.volume_minimo_mensal,
            preco_unitario: rodadaDecidida.preco_unitario,
          }
        : {}),
    })
    .eq("id", params.negociacaoId);
  if (erroCabecalho) return { erro: erroCabecalho.message };

  await notificarNegociacao(supabase, params.negociacaoId, params.decisao === "aceita" ? "aceita" : "recusada");

  return { ok: true };
}

// Cancela uma negociação ainda em andamento (qualquer um dos dois lados,
// enquanto não houver decisão final).
export async function cancelarNegociacao(
  supabase: ClienteSupabase,
  negociacaoId: string
): Promise<{ ok: true } | { erro: string }> {
  const { error } = await supabase
    .from("negociacoes_postos")
    .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
    .eq("id", negociacaoId)
    .in("status", ["pendente_posto", "pendente_cliente"]);
  if (error) return { erro: error.message };
  return { ok: true };
}
