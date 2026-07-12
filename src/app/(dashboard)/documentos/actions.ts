"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  adicionarSocio,
  removerSocio,
  enviarDocumento,
  removerDocumento,
  enviarDocumentacaoParaAnalise,
  type TipoDocumento,
} from "@/lib/empresasDocumentos";

// Fase 27.149 — Server Actions da tela self-service /documentos (posto e
// cliente). A lógica de domínio/validação vive em src/lib/empresasDocumentos.ts
// (reaproveitada também pela fila de revisão do admin) — aqui só cuida de
// ler FormData/args, chamar a lib e revalidar a rota.

export async function adicionarSocioAcao(empresaId: string, nome: string, cpf: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resultado = await adicionarSocio(supabase, { empresaId, nome, cpf, criadoPor: user?.email ?? null });
  if ("erro" in resultado) throw new Error(resultado.erro);
  revalidatePath("/documentos");
}

export async function removerSocioAcao(socioId: string): Promise<void> {
  const supabase = await createClient();
  const resultado = await removerSocio(supabase, socioId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath("/documentos");
}

export async function enviarDocumentoAcao(formData: FormData): Promise<{ erro?: string }> {
  const empresaId = formData.get("empresa_id");
  const tipo = formData.get("tipo");
  const socioIdRaw = formData.get("socio_id");
  const arquivo = formData.get("arquivo");

  if (typeof empresaId !== "string" || !empresaId) return { erro: "Empresa inválida." };
  if (typeof tipo !== "string" || !tipo) return { erro: "Tipo de documento inválido." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await enviarDocumento(supabase, {
    empresaId,
    tipo: tipo as TipoDocumento,
    socioId: typeof socioIdRaw === "string" && socioIdRaw ? socioIdRaw : null,
    arquivo,
    enviadoPor: user?.email ?? null,
  });
  if ("erro" in resultado) return { erro: resultado.erro };
  revalidatePath("/documentos");
  return {};
}

export async function removerDocumentoAcao(documentoId: string): Promise<void> {
  const supabase = await createClient();
  const resultado = await removerDocumento(supabase, documentoId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath("/documentos");
}

export async function enviarParaAnaliseAcao(empresaId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resultado = await enviarDocumentacaoParaAnalise(supabase, empresaId, user?.email ?? null);
  if ("erro" in resultado) return { erro: resultado.erro };
  revalidatePath("/documentos");
  return {};
}
