"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OficinaFormState = { erro?: string; ok?: boolean } | undefined;

function camposComuns(formData: FormData) {
  const especialidades = formData.getAll("especialidades").map((v) => String(v));
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim() || null,
    especialidades,
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    endereco: String(formData.get("endereco") ?? "").trim() || null,
    municipio: String(formData.get("municipio") ?? "").trim() || null,
    uf: String(formData.get("uf") ?? "").trim().toUpperCase() || null,
    avaliacao_media: formData.get("avaliacao_media") ? Number(formData.get("avaliacao_media")) : null,
  };
}

// Fase Onda-2 (benchmark TicketLog, item #5) — CRUD do catálogo nacional de
// oficinas credenciadas, restrito ao admin (ver RLS na migração
// rede_oficinas_credenciadas: só perfil_usuario_atual()='admin' escreve).
export async function criarOficinaAcao(_prev: OficinaFormState, formData: FormData): Promise<OficinaFormState> {
  const supabase = await createClient();
  const campos = camposComuns(formData);
  if (!campos.nome) return { erro: "Nome é obrigatório." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("oficinas_credenciadas").insert({ ...campos, criado_por: user?.email ?? null });
  if (error) return { erro: `Não foi possível cadastrar: ${error.message}` };

  revalidatePath("/administracao/oficinas-credenciadas");
  return { ok: true };
}

export async function atualizarOficinaAcao(id: string, _prev: OficinaFormState, formData: FormData): Promise<OficinaFormState> {
  const supabase = await createClient();
  const campos = camposComuns(formData);
  if (!campos.nome) return { erro: "Nome é obrigatório." };

  const { error } = await supabase
    .from("oficinas_credenciadas")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/administracao/oficinas-credenciadas");
  revalidatePath("/oficinas");
  return { ok: true };
}

export async function alternarAtivoOficinaAcao(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("oficinas_credenciadas")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/oficinas-credenciadas");
  revalidatePath("/oficinas");
}

export async function excluirOficinaAcao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("oficinas_credenciadas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/oficinas-credenciadas");
}
