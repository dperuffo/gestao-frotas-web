"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CICLOS_COMBUSTIVEL } from "@/lib/constants";

export type ClienteFormState = { erro?: string } | undefined;

function montarVolumePotencial(formData: FormData): Record<string, number> {
  const volume: Record<string, number> = {};
  for (const { key } of CICLOS_COMBUSTIVEL) {
    const raw = formData.get(`volume_${key}`);
    const n = raw ? Number(raw) : 0;
    volume[key] = Number.isFinite(n) ? n : 0;
  }
  return volume;
}

function montarPayload(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim() || null,
    status: String(formData.get("status") ?? "trial"),
    porte: String(formData.get("porte") ?? "") || null,
    segmento_transporte: String(formData.get("segmento_transporte") ?? "") || null,
    logradouro: String(formData.get("logradouro") ?? "") || null,
    numero: String(formData.get("numero") ?? "") || null,
    complemento: String(formData.get("complemento") ?? "") || null,
    bairro: String(formData.get("bairro") ?? "") || null,
    municipio: String(formData.get("municipio") ?? "") || null,
    uf: String(formData.get("uf") ?? "") || null,
    cep: String(formData.get("cep") ?? "") || null,
    telefone_contato: String(formData.get("telefone_contato") ?? "") || null,
    email_contato: String(formData.get("email_contato") ?? "") || null,
    volume_potencial: montarVolumePotencial(formData),
  };
}

export async function criarCliente(_prev: ClienteFormState, formData: FormData): Promise<ClienteFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);

  if (!payload.nome) {
    return { erro: "Razão Social é obrigatória." };
  }

  const { data, error } = await supabase.from("empresas").insert(payload).select("id").single();

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function atualizarCliente(
  id: string,
  _prev: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);

  if (!payload.nome) {
    return { erro: "Razão Social é obrigatória." };
  }

  const { error } = await supabase.from("empresas").update(payload).eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { erro: undefined };
}

export async function alternarAtivoCliente(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("empresas")
    .update({ status: ativo ? "ativo" : "suspenso" })
    .eq("id", id);
  revalidatePath("/clientes");
}
