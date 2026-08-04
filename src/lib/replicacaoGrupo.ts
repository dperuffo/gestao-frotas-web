"use server";

import { createClient } from "@/lib/supabase/server";

// Fase Replicação-Grupo — mecanismo genérico pra que o usuário (cliente ou
// posto) replique uma parametrização/cadastro que já preencheu numa empresa
// para as demais empresas do mesmo Grupo Econômico ou Rede de Postos, sem
// repetir manualmente. O motor roda inteiro dentro do Postgres (funções
// replicar_para_grupo/processar_replicacao_lote — ver migração
// replicacao_grupo_mecanismo_*), então mesmo um grupo com muitas empresas
// processa numa única chamada, sem risco de timeout no servidor Next.js.
//
// "chaveTabela" precisa bater com uma linha ativa em
// replicacao_tabelas_registro (allow-list — só tabelas cadastradas lá podem
// ser replicadas, nunca uma tabela arbitrária vinda do cliente).

export type EmpresaAlvoReplicacao = { empresa_id: string; nome: string };

export async function buscarEmpresasAlvoReplicacaoAcao(empresaOrigemId: string): Promise<EmpresaAlvoReplicacao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_empresas_alvo_replicacao", {
    p_empresa_origem_id: empresaOrigemId,
  });
  if (error) return [];
  return data ?? [];
}

export type ItemResultadoReplicacao = {
  empresa_destino_id: string;
  nome_empresa: string;
  status: "sucesso" | "pulado" | "erro";
  motivo: string | null;
};

export type ResultadoReplicacao = {
  erro?: string;
  loteId?: string;
  status?: string;
  totalSucesso?: number;
  totalPulado?: number;
  totalErro?: number;
  itens?: ItemResultadoReplicacao[];
};

export async function replicarParaGrupoAcao(
  chaveTabela: string,
  empresaOrigemId: string,
  registroOrigemId: string | null,
  modoConflito: "pular_se_existir" | "sobrescrever" = "pular_se_existir",
): Promise<ResultadoReplicacao> {
  const supabase = await createClient();

  const { data: loteId, error } = await supabase.rpc("replicar_para_grupo", {
    p_chave_tabela: chaveTabela,
    p_empresa_origem_id: empresaOrigemId,
    p_registro_origem_id: registroOrigemId,
    p_modo_conflito: modoConflito,
  });

  if (error || !loteId) {
    return { erro: error?.message ?? "Não foi possível iniciar a replicação." };
  }

  const { data: lote } = await supabase
    .from("replicacoes_lote")
    .select("status, total_sucesso, total_pulado, total_erro")
    .eq("id", loteId)
    .maybeSingle();

  const { data: itensRaw } = await supabase
    .from("replicacoes_lote_itens")
    .select("empresa_destino_id, status, motivo, empresas:empresa_destino_id(nome)")
    .eq("lote_id", loteId);

  const itens: ItemResultadoReplicacao[] = (itensRaw ?? []).map((i) => ({
    empresa_destino_id: i.empresa_destino_id,
    nome_empresa: (i.empresas as unknown as { nome: string } | null)?.nome ?? "—",
    status: i.status as ItemResultadoReplicacao["status"],
    motivo: i.motivo,
  }));

  return {
    loteId,
    status: lote?.status,
    totalSucesso: lote?.total_sucesso ?? 0,
    totalPulado: lote?.total_pulado ?? 0,
    totalErro: lote?.total_erro ?? 0,
    itens,
  };
}
