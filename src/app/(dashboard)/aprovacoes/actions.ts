"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Fluxo de aprovação em múltiplos níveis")
// — ver o comentário grande na migração solicitacoes_aprovacao pro escopo
// completo desta 1ª versão (módulo autônomo, não integrado ao write-path de
// manutenção/fretes/estoque ainda). Toda a lógica de nível/permissão fica
// nas RPCs (SECURITY DEFINER) — esta camada só traduz erro do Postgres em
// mensagem legível pro formulário.

export type CriarSolicitacaoState = { erro?: string; ok?: boolean } | undefined;

export async function criarSolicitacaoAprovacaoAcao(
  _prev: CriarSolicitacaoState,
  formData: FormData
): Promise<CriarSolicitacaoState> {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorBruto = String(formData.get("valor") ?? "").trim();
  const valor = Number(valorBruto.replace(/\./g, "").replace(",", "."));

  if (!empresaId) return { erro: "Selecione o cliente." };
  if (!titulo) return { erro: "Informe um título pra solicitação." };
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe um valor válido, maior que zero." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_solicitacao_aprovacao", {
    p_empresa_id: empresaId,
    p_categoria: categoria || "outro",
    p_titulo: titulo,
    p_descricao: descricao,
    p_valor: valor,
  });

  if (error) return { erro: error.message };

  revalidatePath("/aprovacoes");
  return { ok: true };
}

export async function decidirSolicitacaoAcao(
  solicitacaoId: string,
  decisao: "aprovado" | "reprovado",
  comentario?: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decidir_solicitacao_aprovacao", {
    p_solicitacao_id: solicitacaoId,
    p_decisao: decisao,
    p_comentario: comentario?.trim() || undefined,
  });
  if (error) return { erro: error.message };

  revalidatePath("/aprovacoes");
  return {};
}

export async function marcarExecutadaAcao(solicitacaoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_solicitacao_executada", { p_solicitacao_id: solicitacaoId });
  if (error) return { erro: error.message };

  revalidatePath("/aprovacoes");
  return {};
}
