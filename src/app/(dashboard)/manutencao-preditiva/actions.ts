"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ManutencaoFormState = { erro?: string; ok?: boolean } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Registra uma manutenção realizada — mesma tabela (manutencoes_realizadas)
// e mesmo formato de itens_realizados (texto livre, um array de serviços)
// já usados pelo app Flutter de produção, pra manter os dois apps
// compatíveis com o mesmo histórico.
export async function registrarManutencaoAcao(
  empresaId: string,
  _prev: ManutencaoFormState,
  formData: FormData
): Promise<ManutencaoFormState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const dataManutencao = String(formData.get("data_manutencao") ?? "").trim();
  const hodometro = numeroOuNull(formData.get("hodometro"));
  const tecnico = String(formData.get("tecnico") ?? "").trim() || null;
  const oficina = String(formData.get("oficina") ?? "").trim() || null;
  const custoTotal = numeroOuNull(formData.get("custo_total"));
  const obsGerais = String(formData.get("obs_gerais") ?? "").trim() || null;
  const itens = formData.getAll("itens_realizados").map((v) => String(v));

  if (!placa) return { erro: "Placa é obrigatória." };
  if (!dataManutencao) return { erro: "Data da manutenção é obrigatória." };
  if (itens.length === 0) return { erro: "Selecione ao menos um item realizado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota")
    .eq("placa", placa)
    .maybeSingle();

  const { error } = await supabase.from("manutencoes_realizadas").insert({
    empresa_id: empresaId,
    cnpj_frota: veiculo?.cnpj_frota ?? "",
    placa,
    data_manutencao: dataManutencao,
    hodometro,
    tecnico,
    oficina,
    custo_total: custoTotal,
    itens_realizados: itens,
    obs_gerais: obsGerais,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível registrar: ${error.message}` };

  revalidatePath(`/manutencao-preditiva/${placa}`);
  revalidatePath("/manutencao-preditiva");
  return { ok: true };
}

export async function excluirManutencaoAcao(id: number, placa: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("manutencoes_realizadas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manutencao-preditiva/${placa}`);
  revalidatePath("/manutencao-preditiva");
}
