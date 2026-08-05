"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase Central-Avisos-Por-Empresa (04/08/2026) — achado real: o Daniel
// liberou, como admin, a permissão "aba_central_avisos" pro perfil
// gestor_frota esperando que isso deixasse esse perfil criar avisos — mas
// Central de Avisos (/administracao/central-avisos) é uma ferramenta de
// BROADCAST DA PLATAFORMA (deixar segmentos_alvo/planos_alvo/empresas_alvo
// vazios manda pra TODOS os clientes). Perguntado como resolver, ele
// escolheu: liberar, mas travado a aparecer só pra própria empresa de quem
// cria. Este arquivo é o lado "empresa" (server actions finas, toda a regra
// de permissão/escopo mora nas RPCs SECURITY DEFINER no banco — mesmo
// motivo de sempre: a RLS de `comunicados` só libera escrita pra admin, um
// não-admin só consegue gravar através dessas RPCs) — diferente de
// administracao/central-avisos/actions.ts, que é o lado admin (avisos
// oficiais, sem escopo de empresa).

export type AvisoEmpresaFormState = { erro?: string; sucesso?: boolean } | undefined;

export type AvisoDaMinhaEmpresa = {
  id: string;
  tipo: string;
  urgencia: string;
  titulo: string;
  resumo: string;
  corpo: string;
  ativo: boolean;
  data_publicacao: string;
  criado_em: string;
};

export async function listarAvisosDaMinhaEmpresaAcao(): Promise<AvisoDaMinhaEmpresa[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_avisos_da_minha_empresa");
  if (error) {
    console.error("[central-avisos/empresa] falha ao listar (ignorado):", error);
    return [];
  }
  return data ?? [];
}

export async function criarAvisoEmpresaAcao(
  _prev: AvisoEmpresaFormState,
  formData: FormData
): Promise<AvisoEmpresaFormState> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const resumo = String(formData.get("resumo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "aviso_geral");
  const urgencia = String(formData.get("urgencia") ?? "informativo");

  if (!titulo || !resumo || !corpo) {
    return { erro: "Título, resumo e corpo são obrigatórios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_aviso_empresa", {
    p_titulo: titulo,
    p_resumo: resumo,
    p_corpo: corpo,
    p_tipo: tipo,
    p_urgencia: urgencia,
  });

  if (error) {
    return { erro: error.message };
  }

  revalidatePath("/central-avisos/gerenciar");
  revalidatePath("/central-avisos");
  return { sucesso: true };
}

export async function editarAvisoEmpresaAcao(
  id: string,
  _prev: AvisoEmpresaFormState,
  formData: FormData
): Promise<AvisoEmpresaFormState> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const resumo = String(formData.get("resumo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "aviso_geral");
  const urgencia = String(formData.get("urgencia") ?? "informativo");

  if (!titulo || !resumo || !corpo) {
    return { erro: "Título, resumo e corpo são obrigatórios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_aviso_empresa", {
    p_id: id,
    p_titulo: titulo,
    p_resumo: resumo,
    p_corpo: corpo,
    p_tipo: tipo,
    p_urgencia: urgencia,
  });

  if (error) {
    return { erro: error.message };
  }

  revalidatePath("/central-avisos/gerenciar");
  revalidatePath("/central-avisos");
  redirect("/central-avisos/gerenciar");
}

export async function alternarAtivoAvisoEmpresaAcao(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("alternar_ativo_aviso_empresa", { p_id: id, p_ativo: ativo });
  if (error) throw new Error(error.message);
  revalidatePath("/central-avisos/gerenciar");
  revalidatePath("/central-avisos");
}

export async function excluirAvisoEmpresaAcao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_aviso_empresa", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/central-avisos/gerenciar");
  revalidatePath("/central-avisos");
}
