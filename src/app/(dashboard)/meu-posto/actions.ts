"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase 27.137 — pedido do Daniel: aba "Meu Posto" com CNPJ, razão social,
// endereço completo, contatos e latitude/longitude, comparados contra a
// base anp_postos na adesão do posto, pra não criar registro sobreposto ou
// duplicado em postos_gf (a mesma tabela que já alimenta consultas e
// roteirização). Toda a lógica de comparação/upsert mora na RPC
// `verificar_e_registrar_posto_anp` (SECURITY DEFINER) — esta action só
// coleta o FormData, chama a RPC e traduz o resultado pro usuário. Nunca
// bloqueia o posto: mesmo com possível duplicidade sinalizada, o cadastro é
// salvo normalmente (decisão do Daniel — só entra numa fila de revisão do
// admin).
export type ResultadoMeuPosto =
  | { status: "confirmado" }
  | { status: "novo_sem_anp" }
  | { status: "possivel_duplicidade" }
  | { status: "erro"; mensagem: string };

const MOTIVO_MENSAGEM: Record<string, string> = {
  sem_permissao: "Você não tem permissão para editar o cadastro deste posto.",
  cnpj_invalido: "CNPJ inválido — confira se digitou os 14 dígitos corretamente.",
  cnpj_ja_vinculado_outro_posto:
    "Este CNPJ já está vinculado a outro posto cadastrado na plataforma. Se isso for um engano, fale com a FNI.",
};

export async function salvarMeuPostoAcao(empresaId: string, formData: FormData): Promise<ResultadoMeuPosto> {
  const supabase = await createClient();

  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();
  if (!razaoSocial) return { status: "erro", mensagem: "Informe a razão social." };
  if (!cnpj) return { status: "erro", mensagem: "Informe o CNPJ." };

  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const latitude = latitudeRaw ? Number(latitudeRaw.replace(",", ".")) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw.replace(",", ".")) : null;
  if ((latitudeRaw && !Number.isFinite(latitude)) || (longitudeRaw && !Number.isFinite(longitude))) {
    return { status: "erro", mensagem: "Latitude/longitude precisam ser números (ex: -23.5505)." };
  }

  const campo = (nome: string) => String(formData.get(nome) ?? "").trim() || null;

  const { data, error } = await supabase.rpc("verificar_e_registrar_posto_anp", {
    p_empresa_id: empresaId,
    p_cnpj: cnpj,
    p_razao_social: razaoSocial,
    p_logradouro: campo("logradouro"),
    p_numero: campo("numero"),
    p_complemento: campo("complemento"),
    p_bairro: campo("bairro"),
    p_municipio: campo("municipio"),
    p_uf: campo("uf"),
    p_cep: campo("cep"),
    p_telefone: campo("telefone_contato"),
    p_email: campo("email_contato"),
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) {
    return { status: "erro", mensagem: `Não foi possível salvar: ${error.message}` };
  }

  const resultado = data as { ok: boolean; motivo?: string; status?: string };
  if (!resultado.ok) {
    return { status: "erro", mensagem: MOTIVO_MENSAGEM[resultado.motivo ?? ""] ?? "Não foi possível salvar o cadastro." };
  }

  revalidatePath("/meu-posto");
  const status = resultado.status as "confirmado" | "novo_sem_anp" | "possivel_duplicidade";
  return { status };
}
