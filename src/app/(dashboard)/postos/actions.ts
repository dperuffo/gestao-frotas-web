"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCNPJ } from "@/lib/utils";

export type PostoFormState = { erro?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function montarPayloadBase(formData: FormData) {
  return {
    razao_social: String(formData.get("razao_social") ?? "").trim() || null,
    distribuidora: String(formData.get("distribuidora") ?? "").trim() || null,
    municipio: String(formData.get("municipio") ?? "").trim() || null,
    uf: String(formData.get("uf") ?? "").trim().toUpperCase() || null,
    lat: numeroOuNull(formData.get("lat")),
    lon: numeroOuNull(formData.get("lon")),
    perfil_venda: String(formData.get("perfil_venda") ?? "").trim() || null,
    horario: String(formData.get("horario") ?? "").trim() || null,
    funciona_24h: formData.get("funciona_24h") === "on",
    pista_caminhao: formData.get("pista_caminhao") === "on",
    arla: formData.get("arla") === "on",
    conveniencia: formData.get("conveniencia") === "on",
    atualizado_em: new Date().toISOString(),
  };
}

export async function criarPosto(_prev: PostoFormState, formData: FormData): Promise<PostoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const cnpj = normalizarCNPJ(String(formData.get("cnpj") ?? ""));
  const payload = montarPayloadBase(formData);

  if (!cnpj || !empresaId) {
    return { erro: "CNPJ e cliente são obrigatórios." };
  }

  const { error } = await supabase.from("postos_gf").insert({ ...payload, cnpj, empresa_id: empresaId });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { erro: "Já existe um posto cadastrado com esse CNPJ." };
    }
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/postos");
  redirect(`/postos/${cnpj}`);
}

export async function atualizarPosto(
  cnpj: string,
  _prev: PostoFormState,
  formData: FormData
): Promise<PostoFormState> {
  const supabase = await createClient();
  const payload = montarPayloadBase(formData);

  const { error } = await supabase.from("postos_gf").update(payload).eq("cnpj", cnpj);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/postos");
  revalidatePath(`/postos/${cnpj}`);
  return { erro: undefined };
}

export async function excluirPosto(cnpj: string) {
  const supabase = await createClient();
  await supabase.from("postos_gf").delete().eq("cnpj", cnpj);
  revalidatePath("/postos");
}

export type AtivarPostoState = { erro?: string } | undefined;

// "Ativa" um posto ANP na rede do cliente: copia os dados básicos (razão
// social, município, UF, coordenadas) de anp_postos para postos_gf. Os
// campos específicos do negócio (perfil de venda, horário, ARLA etc.) ficam
// em branco e podem ser preenchidos depois na tela de detalhe do posto.
export async function ativarPosto(cnpjAnp: string, empresaId: string): Promise<AtivarPostoState> {
  if (!empresaId) return { erro: "Selecione o cliente antes de ativar um posto." };

  const supabase = await createClient();
  const { data: anp, error: anpError } = await supabase
    .from("anp_postos")
    .select("cnpj, razao_social, municipio, uf, latitude, longitude")
    .eq("cnpj", cnpjAnp)
    .maybeSingle();

  if (anpError || !anp) return { erro: "Posto ANP não encontrado." };

  const { error } = await supabase.from("postos_gf").insert({
    cnpj: normalizarCNPJ(anp.cnpj),
    empresa_id: empresaId,
    razao_social: anp.razao_social,
    municipio: anp.municipio,
    uf: anp.uf,
    lat: anp.latitude,
    lon: anp.longitude,
    atualizado_em: new Date().toISOString(),
  });

  if (error) return { erro: `Não foi possível ativar o posto: ${error.message}` };

  revalidatePath("/postos");
  return { erro: undefined };
}

// Bloqueio do gestor de frota: NÃO remove o posto da rede (ele continua
// cadastrado, vindo da importação em lote). Só impede que ele apareça como
// liberado para abastecimento — decisão manual do gestor, preservada em
// futuras reimportações da planilha.
export async function bloquearPosto(cnpj: string) {
  const supabase = await createClient();
  await supabase.from("postos_gf").update({ ativo: false }).eq("cnpj", cnpj);
  revalidatePath("/postos");
  revalidatePath(`/postos/${cnpj}`);
}

export async function desbloquearPosto(cnpj: string) {
  const supabase = await createClient();
  await supabase.from("postos_gf").update({ ativo: true }).eq("cnpj", cnpj);
  revalidatePath("/postos");
  revalidatePath(`/postos/${cnpj}`);
}

export type PrecoFormState = { erro?: string } | undefined;

// Registra o preço vigente de um combustível num posto. Cada combinação
// (cnpj, combustivel, data_ref) é única no banco — reenviar a mesma data
// atualiza o preço daquele dia (upsert) em vez de duplicar.
export async function registrarPreco(
  cnpj: string,
  empresaId: string | null,
  _prev: PrecoFormState,
  formData: FormData
): Promise<PrecoFormState> {
  const supabase = await createClient();

  const combustivel = String(formData.get("combustivel") ?? "").trim();
  const precoTexto = String(formData.get("preco") ?? "").trim();
  const dataRef = String(formData.get("data_ref") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const preco = Number(precoTexto);

  if (!combustivel || !precoTexto || !Number.isFinite(preco) || preco <= 0) {
    return { erro: "Combustível e preço (maior que zero) são obrigatórios." };
  }

  const { data: posto } = await supabase
    .from("postos_gf")
    .select("razao_social, municipio, uf")
    .eq("cnpj", cnpj)
    .maybeSingle();

  const { error } = await supabase.from("historico_precos").upsert(
    {
      cnpj,
      combustivel,
      preco,
      data_ref: dataRef,
      fonte: "manual",
      razao_social: posto?.razao_social ?? null,
      municipio: posto?.municipio ?? null,
      uf: posto?.uf ?? null,
      empresa_id: empresaId,
    },
    { onConflict: "cnpj,combustivel,data_ref" }
  );

  if (error) return { erro: `Não foi possível salvar o preço: ${error.message}` };

  revalidatePath(`/postos/${cnpj}`);
  return { erro: undefined };
}

export async function excluirPreco(id: number, cnpj: string) {
  const supabase = await createClient();
  await supabase.from("historico_precos").delete().eq("id", id);
  revalidatePath(`/postos/${cnpj}`);
}
