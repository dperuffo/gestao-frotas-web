"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase Grupo 2 (Rodopar/Datapar, item 5) — CRM Comercial.

export type CrmFormState = { erro?: string } | undefined;

async function empresaPertenceAoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

function campoTexto(formData: FormData, nome: string): string | null {
  return String(formData.get(nome) ?? "").trim() || null;
}

export async function criarClienteAcao(empresaId: string, _prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para cadastrar clientes nesta empresa." };
  }

  const cnpjCpf = String(formData.get("cnpj_cpf") ?? "").replace(/\D/g, "");
  const razaoSocial = campoTexto(formData, "razao_social");
  if (!cnpjCpf || (cnpjCpf.length !== 11 && cnpjCpf.length !== 14)) return { erro: "Informe um CNPJ ou CPF válido." };
  if (!razaoSocial) return { erro: "Informe a razão social ou nome do cliente." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cliente, error } = await supabase
    .from("cadastros_parceiros")
    .insert({
      empresa_id: empresaId,
      papel: "tomador",
      cnpj_cpf: cnpjCpf,
      razao_social: razaoSocial,
      ie: campoTexto(formData, "ie"),
      endereco_logradouro: campoTexto(formData, "endereco_logradouro"),
      endereco_numero: campoTexto(formData, "endereco_numero"),
      endereco_bairro: campoTexto(formData, "endereco_bairro"),
      endereco_municipio: campoTexto(formData, "endereco_municipio"),
      endereco_uf: campoTexto(formData, "endereco_uf")?.toUpperCase() ?? null,
      endereco_cep: campoTexto(formData, "endereco_cep")?.replace(/\D/g, "") ?? null,
      telefone: campoTexto(formData, "telefone"),
      email: campoTexto(formData, "email"),
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um cliente cadastrado com esse CNPJ/CPF." };
    return { erro: `Não foi possível cadastrar o cliente: ${error.message}` };
  }

  revalidatePath("/crm-comercial");
  redirect(`/crm-comercial/clientes/${cliente.id}?empresa=${empresaId}`);
}

export async function editarClienteAcao(
  clienteId: string,
  empresaId: string,
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const razaoSocial = campoTexto(formData, "razao_social");
  if (!razaoSocial) return { erro: "Informe a razão social ou nome do cliente." };

  const { error } = await supabase
    .from("cadastros_parceiros")
    .update({
      razao_social: razaoSocial,
      ie: campoTexto(formData, "ie"),
      endereco_logradouro: campoTexto(formData, "endereco_logradouro"),
      endereco_numero: campoTexto(formData, "endereco_numero"),
      endereco_bairro: campoTexto(formData, "endereco_bairro"),
      endereco_municipio: campoTexto(formData, "endereco_municipio"),
      endereco_uf: campoTexto(formData, "endereco_uf")?.toUpperCase() ?? null,
      endereco_cep: campoTexto(formData, "endereco_cep")?.replace(/\D/g, "") ?? null,
      telefone: campoTexto(formData, "telefone"),
      email: campoTexto(formData, "email"),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", clienteId)
    .eq("empresa_id", empresaId);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(`/crm-comercial/clientes/${clienteId}`);
  return undefined;
}

export async function criarInteracaoAcao(
  clienteId: string,
  empresaId: string,
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const TIPOS_VALIDOS = ["ligacao", "email", "whatsapp", "reuniao", "visita", "outro"] as const;
  const tipoRaw = campoTexto(formData, "tipo");
  const descricao = campoTexto(formData, "descricao");
  const proximaAcaoData = campoTexto(formData, "proxima_acao_data");
  if (!tipoRaw || !(TIPOS_VALIDOS as readonly string[]).includes(tipoRaw)) return { erro: "Escolha o tipo de interação." };
  if (!descricao) return { erro: "Descreva o que foi conversado/combinado." };
  const tipo = tipoRaw as (typeof TIPOS_VALIDOS)[number];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("clientes_interacoes").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    tipo,
    descricao,
    proxima_acao_data: proximaAcaoData,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível registrar a interação: ${error.message}` };

  revalidatePath(`/crm-comercial/clientes/${clienteId}`);
  return undefined;
}

export async function excluirInteracaoAcao(interacaoId: string, clienteId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  await supabase.from("clientes_interacoes").delete().eq("id", interacaoId).eq("empresa_id", empresaId);
  revalidatePath(`/crm-comercial/clientes/${clienteId}`);
}
