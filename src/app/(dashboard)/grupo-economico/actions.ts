"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type GrupoFormState = { erro?: string } | undefined;

export async function criarGrupo(_prev: GrupoFormState, formData: FormData): Promise<GrupoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;

  if (!nome) return { erro: "Nome do grupo é obrigatório." };

  const { data, error } = await supabase
    .from("grupos_economicos")
    .insert({ nome, cnpj_matriz })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/grupo-economico");
  redirect(`/grupo-economico/${data.id}`);
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

  if (!nome) return { erro: "Nome do grupo é obrigatório." };

  const { error } = await supabase
    .from("grupos_economicos")
    .update({ nome, cnpj_matriz, ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/grupo-economico");
  revalidatePath(`/grupo-economico/${id}`);
  return { erro: undefined };
}

export async function vincularEmpresa(grupoId: string, empresaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("grupos_economicos_empresas")
    .insert({ grupo_economico_id: grupoId, empresa_id: empresaId });
  if (error) throw new Error(error.message);
  revalidatePath(`/grupo-economico/${grupoId}`);
}

export async function desvincularEmpresa(grupoId: string, vinculoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_economicos_empresas").delete().eq("id", vinculoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/grupo-economico/${grupoId}`);
}
