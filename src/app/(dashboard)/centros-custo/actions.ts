"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { alocarVeiculoCentroCusto } from "@/lib/centroCusto";

export type CentroCustoFormState = { erro?: string } | undefined;

export async function criarCentroCusto(
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const responsavel = String(formData.get("responsavel") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const empresaId = String(formData.get("empresa_id") ?? "").trim() || null;

  if (!nome) return { erro: "Nome do centro de custo é obrigatório." };
  if (!empresaId) return { erro: "Cliente é obrigatório." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("centros_custo")
    .insert({
      nome,
      codigo,
      responsavel,
      descricao,
      empresa_id: empresaId,
      ativo: true,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/centros-custo");
  redirect(`/centros-custo/${data.id}`);
}

export async function atualizarCentroCusto(
  id: string,
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const responsavel = String(formData.get("responsavel") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  if (!nome) return { erro: "Nome do centro de custo é obrigatório." };

  const { error } = await supabase
    .from("centros_custo")
    .update({ nome, codigo, responsavel, descricao, ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/centros-custo");
  revalidatePath(`/centros-custo/${id}`);
  return { erro: undefined };
}

// Aloca um veículo (por placa) a este centro de custo, preservando o
// histórico de alocações anteriores (ver src/lib/centroCusto.ts).
export async function alocarVeiculoAcao(centroCustoId: string, empresaId: string | null, placa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await alocarVeiculoCentroCusto(supabase, {
    placa,
    centroCustoId,
    empresaId,
    criadoPor: user?.email ?? undefined,
  });
  if (resultado.erro) throw new Error(resultado.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");
}

// Desaloca (remove) o veículo deste centro de custo, fechando a alocação
// ativa no histórico — o veículo fica sem centro de custo até ser realocado.
export async function desalocarVeiculoAcao(centroCustoId: string, empresaId: string | null, placa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await alocarVeiculoCentroCusto(supabase, {
    placa,
    centroCustoId: null,
    empresaId,
    criadoPor: user?.email ?? undefined,
  });
  if (resultado.erro) throw new Error(resultado.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");
}
