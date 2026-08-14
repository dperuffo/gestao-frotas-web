"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Badge do menu (layout.tsx) — pedido do Daniel: "Alertas e notificacoes
// dentro do dia são importantes para a decisao do posto, para que nao sejam
// acumulados". Conta as divergências de preço de HOJE que o posto ainda não
// tem um ajuste em andamento (evita contar de novo o que ele já sabe e já
// está resolvendo, mesmo espírito do filtro "🔴 Pendente de ajuste" em
// AbastecimentosPosto.tsx). Só soma pra quem é posto de verdade — quem tem
// mais de uma empresa (raro nesse segmento) tem a contagem somada das
// empresas próprias, resolvidas via usuarios_empresas (mesmo motivo do
// comentário em resolverEmpresaPropria: aqui interessa só o vínculo DIRETO
// de dono, não empresas "irmãs" de rede).
export async function contarDivergenciasPrecoPostoAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "posto") return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return 0;

  const { data: vinculos } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", user.email)
    .eq("ativo", true);

  const idsEmpresas = Array.from(new Set((vinculos ?? []).map((v) => v.empresa_id)));
  if (idsEmpresas.length === 0) return 0;

  const hoje = new Date().toISOString().slice(0, 10);

  let total = 0;
  for (const empresaId of idsEmpresas) {
    const { data, error } = await supabase.rpc("posto_divergencias_preco", {
      p_empresa_posto_id: empresaId,
      p_data_inicio: hoje,
      p_data_fim: hoje,
    });
    if (error) {
      void logger.error("conferencia-precos", "Falha ao contar divergências pendentes (ignorado)", error);
      continue;
    }
    total += (data ?? []).filter((d) => !d.tem_ajuste_pendente).length;
  }

  return total;
}

// Fase Conferencia-Precos-Cliente (12/08/2026) — mesma bolinha de menu, só
// que do lado do CLIENTE (gestor_frota/analista/colaborador): conta
// divergências de HOJE contra os postos de quem ele compra, ainda sem
// ajuste em andamento. Espelha contarDivergenciasPrecoPostoAcao acima,
// trocando o RPC posto_* pelo cliente_* (ver migração
// conferencia_precos_visao_cliente).
export async function contarDivergenciasPrecoClienteAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "posto") return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return 0;

  const { data: vinculos } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", user.email)
    .eq("ativo", true);

  const idsEmpresas = Array.from(new Set((vinculos ?? []).map((v) => v.empresa_id)));
  if (idsEmpresas.length === 0) return 0;

  const hoje = new Date().toISOString().slice(0, 10);

  let total = 0;
  for (const empresaId of idsEmpresas) {
    const { data, error } = await supabase.rpc("cliente_divergencias_preco", {
      p_empresa_cliente_id: empresaId,
      p_data_inicio: hoje,
      p_data_fim: hoje,
    });
    if (error) {
      void logger.error("conferencia-precos", "Falha ao contar divergências pendentes (cliente, ignorado)", error);
      continue;
    }
    total += (data ?? []).filter((d) => !d.tem_ajuste_pendente).length;
  }

  return total;
}
