"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AbastecimentoFormState = { erro?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Campos que o usuário preenche num lançamento manual. Os campos "técnicos"
// da integração (identificador, sync_key, item_tipo, status_autorizacao,
// importado_em, empresa_id) são preenchidos automaticamente pela action —
// quem lança manualmente não precisa entender essa parte.
function montarPayloadBase(formData: FormData) {
  const dataHora = String(formData.get("data_abastecimento") ?? "");

  return {
    data_abastecimento: dataHora ? new Date(dataHora).toISOString() : null,
    hodometro: numeroOuNull(formData.get("hodometro")),
    veiculo_placa: String(formData.get("veiculo_placa") ?? "").trim().toUpperCase() || null,
    motorista_nome: String(formData.get("motorista_nome") ?? "").trim() || null,
    pv_razao_social: String(formData.get("pv_razao_social") ?? "").trim() || null,
    pv_municipio: String(formData.get("pv_municipio") ?? "").trim() || null,
    pv_uf: String(formData.get("pv_uf") ?? "").trim() || null,
    item_nome: String(formData.get("item_nome") ?? "").trim() || null,
    item_quantidade: numeroOuNull(formData.get("item_quantidade")),
    item_valor_unitario: numeroOuNull(formData.get("item_valor_unitario")),
    item_valor_total: numeroOuNull(formData.get("item_valor_total")),
  };
}

export async function criarAbastecimento(
  _prev: AbastecimentoFormState,
  formData: FormData
): Promise<AbastecimentoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const payload = montarPayloadBase(formData);

  if (!empresaId) {
    return { erro: "Cliente é obrigatório." };
  }

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("cnpj, nome")
    .eq("id", empresaId)
    .maybeSingle();
  if (empresaError || !empresa?.cnpj) {
    return { erro: "Não foi possível identificar o CNPJ do cliente selecionado." };
  }

  // Gera um "identificador" único (números negativos) para não colidir com os
  // IDs reais que vêm da integração com o PróFrotas.
  const { data: seq, error: seqError } = await supabase.rpc("nextval_identificador_manual");
  if (seqError || seq == null) {
    return { erro: "Não foi possível gerar o identificador do lançamento manual." };
  }
  const identificador = seq as number;

  const { data, error } = await supabase
    .from("profrotas_abastecimentos")
    .insert({
      ...payload,
      cnpj_frota: empresa.cnpj,
      frota_cnpj: empresa.cnpj,
      frota_razao_social: empresa.nome,
      empresa_id: empresaId,
      identificador,
      sync_key: `manual-${identificador}`,
      abastecimento_estornado: 0,
      status_autorizacao: 1,
      item_tipo: 1,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/abastecimentos");
  redirect(`/abastecimentos/${data.id}`);
}

export async function atualizarAbastecimento(
  id: number,
  _prev: AbastecimentoFormState,
  formData: FormData
): Promise<AbastecimentoFormState> {
  const supabase = await createClient();
  const payload = montarPayloadBase(formData);

  const { error } = await supabase.from("profrotas_abastecimentos").update(payload).eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/abastecimentos");
  revalidatePath(`/abastecimentos/${id}`);
  return { erro: undefined };
}

export async function excluirAbastecimento(id: number) {
  const supabase = await createClient();
  await supabase.from("profrotas_abastecimentos").delete().eq("id", id);
  revalidatePath("/abastecimentos");
}
