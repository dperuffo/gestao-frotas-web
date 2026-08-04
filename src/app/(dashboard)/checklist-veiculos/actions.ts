"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ITENS_INSPECAO, ITENS_CRITICOS } from "@/lib/checklist";
import { empresaDonaDoVeiculoAcao, empresaOuIrmaDoGrupo } from "@/lib/empresasGrupo";

export type InspecaoFormState = { erro?: string; ok?: boolean } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Registra uma inspeção completa (checklist inteiro, item por item) — mesmo
// padrão de registrarManutencaoAcao: cnpj_frota resolvido a partir da
// própria placa (lookup direto, sem comparação de CNPJ entre tabelas).
export async function registrarInspecaoAcao(
  empresaId: string,
  _prev: InspecaoFormState,
  formData: FormData
): Promise<InspecaoFormState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const dataInspecao = String(formData.get("data_inspecao") ?? "").trim();
  const hodometro = numeroOuNull(formData.get("hodometro"));
  const responsavel = String(formData.get("responsavel") ?? "").trim() || null;

  if (!placa) return { erro: "Placa é obrigatória." };
  if (!dataInspecao) return { erro: "Data da inspeção é obrigatória." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota")
    .eq("placa", placa)
    .maybeSingle();

  // Fase Reuso-Operacional-Grupo (Fase 2) — o custo/registro da inspeção
  // fica com a empresa DONA do cadastro do veículo, mesma decisão já usada
  // em TCO/KPIs e agora em Multas. Se a placa pertencer a uma empresa fora
  // do grupo econômico da empresa selecionada, rejeita.
  const empresaDonaId = await empresaDonaDoVeiculoAcao(supabase, placa);
  let empresaFinalId = empresaId;
  if (empresaDonaId) {
    const pertenceAoGrupo = await empresaOuIrmaDoGrupo(supabase, empresaId, empresaDonaId);
    if (!pertenceAoGrupo) {
      return { erro: "Essa placa não pertence à sua empresa nem a uma empresa do mesmo grupo econômico." };
    }
    empresaFinalId = empresaDonaId;
  }

  const { data: inspecao, error } = await supabase
    .from("inspecoes_veiculos")
    .insert({
      empresa_id: empresaFinalId,
      cnpj_frota: veiculo?.cnpj_frota ?? "",
      placa,
      data_inspecao: dataInspecao,
      hodometro,
      responsavel,
      criado_por: user?.email ?? null,
      origem: "gestor",
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível registrar: ${error.message}` };

  const itens = ITENS_INSPECAO.map((item) => {
    const conforme = formData.get(`item_${item}`) === "conforme";
    const observacao = String(formData.get(`obs_${item}`) ?? "").trim() || null;
    return {
      inspecao_id: inspecao.id,
      empresa_id: empresaFinalId,
      item,
      critico: ITENS_CRITICOS.includes(item),
      conforme,
      observacao,
    };
  });

  const { error: erroItens } = await supabase.from("inspecoes_veiculos_itens").insert(itens);
  if (erroItens) return { erro: `Inspeção registrada, mas não foi possível salvar os itens: ${erroItens.message}` };

  revalidatePath(`/checklist-veiculos/${placa}`);
  revalidatePath("/checklist-veiculos");
  return { ok: true };
}

// Marca uma não conformidade como resolvida — alimenta o TMRNC
// (kpis_frota_resumo.tmrnc_horas = média de resolvido_em - criado_em).
export async function resolverItemInspecaoAcao(id: number, placa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("inspecoes_veiculos_itens")
    .update({ resolvido_em: new Date().toISOString(), resolvido_por: user?.email ?? null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/checklist-veiculos/${placa}`);
  revalidatePath("/checklist-veiculos");
}

export async function excluirInspecaoAcao(id: number, placa: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inspecoes_veiculos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/checklist-veiculos/${placa}`);
  revalidatePath("/checklist-veiculos");
}
