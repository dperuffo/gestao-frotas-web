"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";

export type MotoristaFormState = { erro?: string } | undefined;

function montarPayload(formData: FormData) {
  const classificacaoBruta = String(formData.get("classificacao") ?? "Próprio");
  const classificacao: Classificacao = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
    ? (classificacaoBruta as Classificacao)
    : "Próprio";

  return {
    nome_completo: String(formData.get("nome_completo") ?? "").trim(),
    cpf: String(formData.get("cpf") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    classificacao,
    cnh: String(formData.get("cnh") ?? "").trim() || null,
    cnh_vencimento: String(formData.get("cnh_vencimento") ?? "") || null,
    centro_custo_id: String(formData.get("centro_custo_id") ?? "") || null,
  };
}

export async function criarMotorista(_prev: MotoristaFormState, formData: FormData): Promise<MotoristaFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const payload = montarPayload(formData);

  if (!payload.nome_completo || !payload.cpf || !empresaId) {
    return { erro: "Nome completo, CPF e cliente são obrigatórios." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase 27.3 — mesmo problema encontrado em veículos: o mesmo CPF conseguia
  // ser cadastrado mais de uma vez dentro da mesma empresa. Checa antes de
  // gravar (mensagem clara); o índice único normalizado no banco
  // (motoristas_empresa_cpf_norm_uidx) é a trava definitiva.
  const { data: duplicado } = await supabase.rpc("motorista_duplicado", {
    p_empresa_id: empresaId,
    p_cpf: payload.cpf,
  });
  if (duplicado) {
    return { erro: `Já existe um motorista cadastrado com o CPF ${payload.cpf} para este cliente.` };
  }

  const { data, error } = await supabase
    .from("motoristas")
    .insert({ ...payload, empresa_id: empresaId, status: "Ativo", criado_por: user?.email ?? null })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { erro: `Já existe um motorista cadastrado com o CPF ${payload.cpf} para este cliente.` };
    }
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/motoristas");
  redirect(`/motoristas/${data.id}`);
}

export async function atualizarMotorista(
  id: string,
  _prev: MotoristaFormState,
  formData: FormData
): Promise<MotoristaFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);
  const status = formData.get("ativo") === "on" ? "Ativo" : "Inativo";

  if (!payload.nome_completo || !payload.cpf) {
    return { erro: "Nome completo e CPF são obrigatórios." };
  }

  const { data: existente } = await supabase
    .from("motoristas")
    .select("empresa_id")
    .eq("id", id)
    .maybeSingle();

  if (existente?.empresa_id) {
    const { data: duplicado } = await supabase.rpc("motorista_duplicado", {
      p_empresa_id: existente.empresa_id,
      p_cpf: payload.cpf,
      p_excluir_id: id,
    });
    if (duplicado) {
      return { erro: `Já existe outro motorista cadastrado com o CPF ${payload.cpf} para este cliente.` };
    }
  }

  const { error } = await supabase
    .from("motoristas")
    .update({ ...payload, status })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { erro: `Já existe outro motorista cadastrado com o CPF ${payload.cpf} para este cliente.` };
    }
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/motoristas");
  revalidatePath(`/motoristas/${id}`);
  return { erro: undefined };
}

export async function alternarAtivoMotorista(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("motoristas")
    .update({ status: ativo ? "Ativo" : "Inativo" })
    .eq("id", id);
  revalidatePath("/motoristas");
}
