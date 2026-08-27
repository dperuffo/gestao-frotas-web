"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase Apolices-Seguro (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Gestão de Apólices de Seguro"). CRUD direto
// contra a tabela (RLS de configuracoes_regras/regras_antifraude é o mesmo
// padrão — tenant_all) sem RPC própria: não há regra de negócio especial
// além de "só a empresa dona pode ver/editar a apólice dela", que a RLS já
// cobre sozinha.

export type ApoliceFormState = { erro?: string } | undefined;

function montarPayload(formData: FormData) {
  return {
    placa: String(formData.get("placa") ?? "").trim().toUpperCase() || null,
    seguradora: String(formData.get("seguradora") ?? "").trim(),
    numero_apolice: String(formData.get("numero_apolice") ?? "").trim(),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    vigencia_fim: String(formData.get("vigencia_fim") ?? ""),
    cobertura: String(formData.get("cobertura") ?? "").trim() || null,
    valor_franquia: formData.get("valor_franquia") ? Number(formData.get("valor_franquia")) : null,
    valor_premio: formData.get("valor_premio") ? Number(formData.get("valor_premio")) : null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}

export async function criarApoliceAcao(
  empresaId: string,
  _prev: ApoliceFormState,
  formData: FormData
): Promise<ApoliceFormState> {
  const payload = montarPayload(formData);
  if (!payload.seguradora || !payload.numero_apolice || !payload.vigencia_inicio || !payload.vigencia_fim) {
    return { erro: "Seguradora, número da apólice e vigência (início e fim) são obrigatórios." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("apolices_seguro").insert({
    empresa_id: empresaId,
    placa: payload.placa,
    seguradora: payload.seguradora,
    numero_apolice: payload.numero_apolice,
    vigencia_inicio: payload.vigencia_inicio,
    vigencia_fim: payload.vigencia_fim,
    cobertura: payload.cobertura,
    valor_franquia: payload.valor_franquia,
    valor_premio: payload.valor_premio,
    observacoes: payload.observacoes,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/apolices-seguro");
  redirect(`/apolices-seguro?empresa=${empresaId}`);
}

export async function atualizarApoliceAcao(
  id: string,
  _prev: ApoliceFormState,
  formData: FormData
): Promise<ApoliceFormState> {
  const payload = montarPayload(formData);
  if (!payload.seguradora || !payload.numero_apolice || !payload.vigencia_inicio || !payload.vigencia_fim) {
    return { erro: "Seguradora, número da apólice e vigência (início e fim) são obrigatórios." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("apolices_seguro")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/apolices-seguro");
  redirect("/apolices-seguro");
}

export async function excluirApoliceAcao(id: string) {
  const supabase = await createClient();
  await supabase.from("apolices_seguro").delete().eq("id", id);
  revalidatePath("/apolices-seguro");
}
