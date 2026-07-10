"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase 27.120 — pedido do Daniel: tela de "Parâmetros de Uso" pra que o
// cliente configure regras que balizam abastecimentos feitos por outras
// soluções de automação de posto/meios de pagamento (consultadas depois via
// API — ver src/app/api/integracoes/parametros/vinculo/route.ts).
//
// Este é o primeiro dos 10 tipos de regra planejados (ver anexo do Daniel):
// Vínculo Motorista ↔ Veículo. Os outros 9 (Intervalo, Valor Diário, Volume
// Diário, Produto, Hodômetro Leve/Pesado, Dias/Horários, Postos, Serviços,
// Cotas) entram em fases seguintes, replicando este mesmo padrão de
// schema/ação/tela/API.

export type VinculoFormState = { erro?: string } | undefined;

function montarPayload(formData: FormData) {
  return {
    placa: String(formData.get("placa") ?? "")
      .trim()
      .toUpperCase(),
    motorista_id: String(formData.get("motorista_id") ?? "").trim(),
    data_inicio: String(formData.get("data_inicio") ?? "") || null,
    data_fim: String(formData.get("data_fim") ?? "") || null,
    observacao: String(formData.get("observacao") ?? "").trim() || null,
  };
}

export async function criarVinculo(_prev: VinculoFormState, formData: FormData): Promise<VinculoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const payload = montarPayload(formData);

  if (!payload.placa || !payload.motorista_id || !empresaId) {
    return { erro: "Veículo (placa), motorista e cliente são obrigatórios." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("parametros_vinculo_motorista_veiculo").insert({
    ...payload,
    data_inicio: payload.data_inicio ?? new Date().toISOString().slice(0, 10),
    empresa_id: empresaId,
    status: "Ativo",
    criado_por: user?.email ?? null,
  });

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/parametros-uso");
  redirect("/parametros-uso");
}

export async function atualizarVinculo(
  id: string,
  _prev: VinculoFormState,
  formData: FormData
): Promise<VinculoFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);
  const status = formData.get("ativo") === "on" ? "Ativo" : "Inativo";

  if (!payload.placa || !payload.motorista_id) {
    return { erro: "Veículo (placa) e motorista são obrigatórios." };
  }

  const { error } = await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .update({
      placa: payload.placa,
      motorista_id: payload.motorista_id,
      data_inicio: payload.data_inicio ?? new Date().toISOString().slice(0, 10),
      data_fim: payload.data_fim,
      observacao: payload.observacao,
      status,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/parametros-uso");
  redirect("/parametros-uso");
}

export async function alternarStatusVinculo(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirVinculo(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_vinculo_motorista_veiculo").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}
