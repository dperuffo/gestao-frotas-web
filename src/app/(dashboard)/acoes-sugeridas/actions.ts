"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Motor-de-Ação-Automática — pedido do Daniel após o benchmark com a
// TicketLog: "vamos começar a implementar as demandas de alta prioridade".
// Esta é a Central de Ações Sugeridas — o equivalente ao TED da TicketLog:
// detecta oportunidades (reaproveitando Anomalias/Inteligência de Rede/CNH
// vencida) e fecha o ciclo até a execução real no banco, sempre com aceite
// explícito do gestor (nunca automático sem aprovação, ao menos nesta
// primeira versão — ver comentário na migration).
export type ResultadoDeteccaoAcoes = { erro?: string; inseridas?: number };

export async function executarDeteccaoAcoesSugeridasAcao(empresaId: string | null): Promise<ResultadoDeteccaoAcoes> {
  const supabase = await createClient();

  // Fase Ações-Sugeridas-Completa — com o painel de Anomalias fora do menu,
  // ninguém mais chama detectar_anomalias_abastecimento() manualmente (era o
  // botão "Detectar agora" de lá). volume_tanque/geo_distancia/hodometro/
  // preco_regiao só existem em acoes_sugeridas a partir de linhas em
  // anomalias_abastecimento, então rodamos essa detecção de base aqui
  // primeiro — sem isso, os 4 tipos ficariam presos nos dados do último dia
  // em que alguém abriu a tela antiga.
  const anomalias = await supabase.rpc("detectar_anomalias_abastecimento", { p_empresa_id: empresaId });
  if (anomalias.error) {
    return { erro: `Não foi possível rodar a detecção base de anomalias: ${anomalias.error.message}` };
  }

  const [cnh, posto, hodometro, volumeTanque, geoDistancia, precoRegiao] = await Promise.all([
    supabase.rpc("detectar_acoes_cnh_vencida", { p_empresa_id: empresaId }),
    supabase.rpc("detectar_acoes_posto_caro", { p_empresa_id: empresaId }),
    supabase.rpc("detectar_acoes_hodometro", { p_empresa_id: empresaId }),
    supabase.rpc("detectar_acoes_volume_tanque", { p_empresa_id: empresaId }),
    supabase.rpc("detectar_acoes_geo_distancia", { p_empresa_id: empresaId }),
    supabase.rpc("detectar_acoes_preco_regiao", { p_empresa_id: empresaId }),
  ]);

  const erro = cnh.error ?? posto.error ?? hodometro.error ?? volumeTanque.error ?? geoDistancia.error ?? precoRegiao.error;
  if (erro) {
    return { erro: `Não foi possível rodar a detecção: ${erro.message}` };
  }

  const inseridas =
    (cnh.data ?? 0) +
    (posto.data ?? 0) +
    (hodometro.data ?? 0) +
    (volumeTanque.data ?? 0) +
    (geoDistancia.data ?? 0) +
    (precoRegiao.data ?? 0);
  revalidatePath("/acoes-sugeridas");
  return { inseridas };
}

// Mapa tipo -> RPC de execução específica (cada tipo grava numa tabela
// diferente — motoristas, postos_gf, parametros_variacao_hodometro,
// parametros_volume_diario_veiculo, parametros_intervalo_abastecimento, ou
// revisa em lote as anomalias de preço — por isso não dá pra ter uma única
// RPC genérica de "aprovar". Fase Ações-Sugeridas-Completa: fecha os 3 tipos
// que faltavam pra cobrir tudo que Anomalias detecta.
const RPC_EXECUCAO: Record<string, string> = {
  cnh_vencida: "executar_acao_bloquear_motorista",
  posto_acima_media: "executar_acao_remover_posto_rede",
  hodometro_fora_padrao: "executar_acao_ajustar_hodometro",
  volume_tanque: "executar_acao_limitar_volume_diario",
  geo_distancia: "executar_acao_limitar_intervalo",
  preco_regiao: "executar_acao_revisar_preco_regiao",
};

export async function aprovarEExecutarAcaoAcao(id: number, tipo: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const nomeRpc = RPC_EXECUCAO[tipo];
  if (!nomeRpc) {
    return { erro: `Tipo de ação desconhecido: ${tipo}` };
  }

  // nomeRpc vem de um mapa fixo (RPC_EXECUCAO) indexado por `tipo`, nunca de
  // entrada livre do usuário — o cast é seguro; o Supabase client só aceita
  // o nome da função como literal de união, não como `string` genérico.
  const { error } = await supabase.rpc(nomeRpc as "executar_acao_bloquear_motorista", { p_acao_id: id });
  if (error) {
    return { erro: `Não foi possível executar a ação: ${error.message}` };
  }

  revalidatePath("/acoes-sugeridas");
  return {};
}

export async function rejeitarAcaoSugeridaAcao(id: number): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("rejeitar_acao_sugerida", { p_acao_id: id });
  if (error) {
    return { erro: `Não foi possível rejeitar: ${error.message}` };
  }

  revalidatePath("/acoes-sugeridas");
  return {};
}

// Badge no menu lateral — mesmo padrão de contarAnomaliasNaoRevisadasAcao.
export async function contarAcoesSugeridasPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("acoes_sugeridas")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");

  return count ?? 0;
}

// Fase Bloqueio-por-Anomalia — pedido do Daniel: "colocar um seletor para o
// tipo de anomalia para que o usuário selecione para restringir o
// abastecimento". Upsert simples (RLS já garante que só quem tem acesso à
// empresa consegue gravar aqui — ver policy acoes_sugeridas_config_restricao_tenant_all).
export async function salvarConfigRestricaoAcao(
  empresaId: string,
  tipo: string,
  restringirAbastecimento: boolean
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("acoes_sugeridas_config_restricao").upsert(
    {
      empresa_id: empresaId,
      tipo,
      restringir_abastecimento: restringirAbastecimento,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    },
    { onConflict: "empresa_id,tipo" }
  );

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/acoes-sugeridas/restricoes");
  return {};
}

export async function liberarBloqueioAbastecimentoAcao(id: number): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("liberar_bloqueio_abastecimento", { p_bloqueio_id: id });
  if (error) {
    return { erro: `Não foi possível liberar: ${error.message}` };
  }

  revalidatePath("/acoes-sugeridas/restricoes");
  return {};
}
