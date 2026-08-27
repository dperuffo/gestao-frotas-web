"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { registrarAuditoria } from "@/lib/auditoria";

export type SalvarPrecosPostoState = { erro?: string; ok?: boolean } | undefined;

// Fase 27.57 — Preços de combustíveis do posto. Upsert simples: um preço
// "vigente" por combustível (sem histórico por enquanto). RLS já garante
// que só o próprio posto (dono de empresaPostoId) ou admin consegue gravar
// aqui — não precisa checar isso de novo na action.
export async function salvarPrecosPostoAcao(
  empresaPostoId: string,
  formData: FormData
): Promise<SalvarPrecosPostoState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const linhas: { empresa_posto_id: string; combustivel: string; preco: number; atualizado_por: string | null; atualizado_em: string }[] = [];
  const agora = new Date().toISOString();

  for (const produto of PRODUTOS_POSTO) {
    const bruto = String(formData.get(`preco_${produto}`) ?? "").trim();
    if (!bruto) continue; // combustível que o posto não vende — não grava linha
    const preco = Number(bruto.replace(",", "."));
    if (!Number.isFinite(preco) || preco <= 0) {
      return { erro: `Preço inválido para "${produto}".` };
    }
    linhas.push({
      empresa_posto_id: empresaPostoId,
      combustivel: produto,
      preco,
      atualizado_por: user?.email ?? null,
      atualizado_em: agora,
    });
  }

  if (linhas.length === 0) {
    return { erro: "Informe pelo menos um preço." };
  }

  const { error } = await supabase
    .from("precos_postos")
    .upsert(linhas, { onConflict: "empresa_posto_id,combustivel" });

  if (error) return { erro: error.message };

  // Fase Gestao-Controles (27/08/2026) — "edição de preço" é um dos 3
  // exemplos citados pelo Daniel pro log de auditoria.
  await registrarAuditoria({
    acao: "preco_posto.editar",
    entidade: "precos_postos",
    entidadeId: empresaPostoId,
    detalhes: { precos: linhas.map((l) => ({ combustivel: l.combustivel, preco: l.preco })) },
  });

  revalidatePath("/precos-postos");
  return { ok: true };
}
