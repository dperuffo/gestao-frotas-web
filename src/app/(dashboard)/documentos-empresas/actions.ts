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
