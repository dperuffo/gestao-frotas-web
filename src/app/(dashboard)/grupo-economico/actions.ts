"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  criarGrupoEconomico,
  atualizarGrupoEconomico,
  vincularEmpresaAoGrupo,
  desvincularEmpresaDoGrupo,
} from "@/lib/gruposEconomicos";

export type GrupoFormState = { erro?: string } | undefined;

// Fase 27.87 — a lógica de escrita foi extraída pra src/lib/gruposEconomicos.ts
// (compartilhada com /rede-postos/actions.ts, o equivalente pro lado dos
// postos) — aqui só fixa segmento: "Frota" e cuida do revalidatePath/redirect
// desta rota.
export async function criarGrupo(_prev: GrupoFormState, formData: FormData): Promise<GrupoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;

  const resultado = await criarGrupoEconomico(supabase, { segmento: "Frota", nome, cnpjMatriz: cnpj_matriz });
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath("/grupo-economico");
  redirect(`/grupo-economico/${resultado.id}`);
}

export async function atualizarGrupo(
  id: string,
  _prev: GrupoFormState,
  formData: FormData
): Promise<GrupoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  const resultado = await atualizarGrupoEconomico(supabase, { id, nome, cnpjMatriz: cnpj_matriz, ativo });
  if (resultado.erro) return { erro: resultado.erro };

  revalidatePath("/grupo-economico");
  revalidatePath(`/grupo-economico/${id}`);
  return { erro: undefined };
}

export async function vincularEmpresa(grupoId: string, empresaId: string) {
  const supabase = await createClient();
  const resultado = await vincularEmpresaAoGrupo(supabase, { grupoId, empresaId });
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/grupo-economico/${grupoId}`);
}

export async function desvincularEmpresa(grupoId: string, vinculoId: string) {
  const supabase = await createClient();
  // Fase 27.139 — desvincularEmpresaDoGrupo passou a exigir o grupoId (pra
  // permitir self-service de Rede de Postos sem abrir mão da checagem de
  // permissão) — Grupo Econômico (Frota) continua admin-only, sem mudança
  // de comportamento aqui.
  const resultado = await desvincularEmpresaDoGrupo(supabase, vinculoId, grupoId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/grupo-economico/${grupoId}`);
}
