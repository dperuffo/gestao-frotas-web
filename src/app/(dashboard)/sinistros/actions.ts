"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SinistroFormState = { erro?: string; ok?: boolean } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// Fase Indicadores-da-Frota — Sinistros (30/07/2026). Alimenta o KPI de
// índice de sinistralidade (kpis_frota_resumo.indice_sinistralidade =
// sinistros / veículos ativos no período). Mesmo padrão de criarMultaAcao:
// cnpj_frota resolvido por lookup direto na placa (sem comparação de CNPJ
// entre tabelas — não repete a classe de bug corrigida em atualizarVeiculo).
export async function criarSinistroAcao(empresaId: string, _prev: SinistroFormState, formData: FormData): Promise<SinistroFormState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const dataSinistro = String(formData.get("data_sinistro") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const gravidade = String(formData.get("gravidade") ?? "").trim() || null;
  const motoristaNome = String(formData.get("motorista_nome") ?? "").trim() || null;
  const houveVitima = formData.get("houve_vitima") === "on";
  const custoEstimado = numeroOuNull(formData.get("custo_estimado"));
  const localOcorrencia = String(formData.get("local_ocorrencia") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;

  if (!placa) return { erro: "Placa é obrigatória." };
  if (!dataSinistro) return { erro: "Data do sinistro é obrigatória." };
  if (!tipo) return { erro: "Tipo do sinistro é obrigatório." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: veiculo } = await supabase.from("cadastro_veiculos").select("cnpj_frota").eq("placa", placa).maybeSingle();

  const { error } = await supabase.from("sinistros_veiculos").insert({
    empresa_id: empresaId,
    cnpj_frota: veiculo?.cnpj_frota ?? "",
    placa,
    motorista_nome: motoristaNome,
    data_sinistro: dataSinistro,
    tipo,
    gravidade,
    houve_vitima: houveVitima,
    custo_estimado: custoEstimado,
    local_ocorrencia: localOcorrencia,
    descricao,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível registrar: ${error.message}` };

  revalidatePath("/sinistros");
  return { ok: true };
}

export async function excluirSinistroAcao(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("sinistros_veiculos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sinistros");
}
