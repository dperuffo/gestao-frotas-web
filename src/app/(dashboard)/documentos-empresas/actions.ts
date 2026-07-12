"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revisarDocumentacao } from "@/lib/empresasDocumentos";

// Fase 27.149 — fila de revisão do admin. A checagem de "é mesmo admin?"
// vive dentro de revisarDocumentacao (src/lib/empresasDocumentos.ts) — não
// só na RLS — mesmo padrão de sempre validar de novo em código já usado em
// gruposEconomicos.ts/negociacoesPostos.ts.
export async function revisarDocumentacaoAcao(
  empresaId: string,
  decisao: "aprovada" | "rejeitada",
  motivo: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await revisarDocumentacao(supabase, {
    empresaId,
    decisao,
    motivo: motivo.trim() || null,
    revisadoPor: user?.email ?? null,
  });
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath("/documentos-empresas");
  revalidatePath(`/documentos-empresas/${empresaId}`);
  return {};
}

// Fase 27.150 — pedido do Daniel: bolinha vermelha de notificação na
// chegada de documentos, no menu do admin — mesmo padrão já usado pelas
// demais contagens do layout (contarAvaliacoesPendentesAcao,
// contarNegociacoesPendentesAcao etc.): só conta pra admin (evita a
// chamada à toa pra quem não vai ver nada mesmo) e é best-effort (falha
// vira 0, badge escondido, nunca derruba o layout — ver catch no caller).
export async function contarDocumentosPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") return 0;

  const { count } = await supabase
    .from("empresas")
    .select("id", { count: "exact", head: true })
    .eq("documentacao_status", "pendente");

  return count ?? 0;
}
