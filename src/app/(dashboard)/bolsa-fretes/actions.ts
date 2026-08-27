"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Bolsa-Fretes-Grupo (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Bolsa de fretes / marketplace de retorno",
// restrito ao Grupo Econômico por decisão explícita do Daniel). CRUD direto
// da capacidade ociosa (RLS tenant_all cobre escrita — só a própria
// empresa); a leitura cruzada com o grupo é feita pela policy de SELECT da
// tabela (empresas do mesmo grupo) e pela RPC bolsa_fretes_grupo (fretes
// "disponivel" de outras empresas do grupo).

export type CapacidadeFormState = { erro?: string } | undefined;

export async function criarCapacidadeOciosaAcao(
  empresaId: string,
  _prev: CapacidadeFormState,
  formData: FormData
): Promise<CapacidadeFormState> {
  const origemCidade = String(formData.get("origem_cidade") ?? "").trim();
  const origemUf = String(formData.get("origem_uf") ?? "").trim().toUpperCase();
  const disponivelAPartir = String(formData.get("disponivel_a_partir") ?? "").trim();

  if (!origemCidade) return { erro: "Cidade de origem é obrigatória." };
  if (!origemUf || origemUf.length !== 2) return { erro: "UF de origem inválida." };
  if (!disponivelAPartir) return { erro: "Data de disponibilidade é obrigatória." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("capacidade_ociosa_frota").insert({
    empresa_id: empresaId,
    placa: String(formData.get("placa") ?? "").trim().toUpperCase() || null,
    tipo_veiculo: String(formData.get("tipo_veiculo") ?? "").trim() || null,
    origem_cidade: origemCidade,
    origem_uf: origemUf,
    destino_pretendido: String(formData.get("destino_pretendido") ?? "").trim() || null,
    disponivel_a_partir: disponivelAPartir,
    capacidade_kg: formData.get("capacidade_kg") ? Number(formData.get("capacidade_kg")) : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/bolsa-fretes");
  return {};
}

export async function atualizarStatusCapacidadeAcao(
  id: string,
  status: "ativo" | "utilizada" | "cancelada"
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("capacidade_ociosa_frota")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/bolsa-fretes");
  return {};
}

export async function excluirCapacidadeOciosaAcao(id: string) {
  const supabase = await createClient();
  await supabase.from("capacidade_ociosa_frota").delete().eq("id", id);
  revalidatePath("/bolsa-fretes");
}
