"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase Gestao-Pneus (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Módulo dedicado de Gestão de Pneus"). CRUD
// direto (RLS tenant_all cobre a autorização), exceto registrar recapagem
// que passa pela RPC registrar_recapagem_pneu (soma concorrente seguro).

export type PneuFormState = { erro?: string } | undefined;

function montarPayload(formData: FormData) {
  return {
    placa: String(formData.get("placa") ?? "").trim().toUpperCase(),
    posicao: String(formData.get("posicao") ?? "").trim(),
    numero_fogo: String(formData.get("numero_fogo") ?? "").trim() || null,
    marca: String(formData.get("marca") ?? "").trim() || null,
    modelo: String(formData.get("modelo") ?? "").trim() || null,
    medida: String(formData.get("medida") ?? "").trim() || null,
    data_instalacao: String(formData.get("data_instalacao") ?? "").trim(),
    hodometro_instalacao: Number(formData.get("hodometro_instalacao") ?? 0) || 0,
    valor_aquisicao: formData.get("valor_aquisicao") ? Number(formData.get("valor_aquisicao")) : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}

export async function criarPneuAcao(
  empresaId: string,
  _prev: PneuFormState,
  formData: FormData
): Promise<PneuFormState> {
  const payload = montarPayload(formData);
  if (!payload.placa) return { erro: "Placa é obrigatória." };
  if (!payload.posicao) return { erro: "Posição no veículo é obrigatória." };
  if (!payload.data_instalacao) return { erro: "Data de instalação é obrigatória." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("pneus").insert({
    empresa_id: empresaId,
    ...payload,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/pneus");
  redirect(`/pneus?empresa=${empresaId}`);
}

export async function atualizarPneuAcao(
  id: string,
  _prev: PneuFormState,
  formData: FormData
): Promise<PneuFormState> {
  const payload = montarPayload(formData);
  if (!payload.placa) return { erro: "Placa é obrigatória." };
  if (!payload.posicao) return { erro: "Posição no veículo é obrigatória." };
  if (!payload.data_instalacao) return { erro: "Data de instalação é obrigatória." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pneus")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/pneus");
  redirect("/pneus");
}

export async function registrarRecapagemAcao(id: string, valor: number): Promise<{ erro?: string }> {
  if (!Number.isFinite(valor) || valor < 0) return { erro: "Valor inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_recapagem_pneu", { p_pneu_id: id, p_valor: valor });
  if (error) return { erro: error.message };

  revalidatePath("/pneus");
  return {};
}

export async function removerPneuAcao(
  id: string,
  status: "Removido" | "Descartado",
  dataRemocao: string,
  hodometroRemocao: number | null,
  motivo: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pneus")
    .update({
      status,
      data_remocao: dataRemocao || new Date().toISOString().slice(0, 10),
      hodometro_remocao: hodometroRemocao,
      motivo_remocao: motivo.trim() || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/pneus");
  return {};
}

export async function excluirPneuAcao(id: string) {
  const supabase = await createClient();
  await supabase.from("pneus").delete().eq("id", id);
  revalidatePath("/pneus");
}
