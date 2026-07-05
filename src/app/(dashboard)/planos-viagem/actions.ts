"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_PLANO_VIAGEM, type StatusPlanoViagem } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type PlanoViagemUpdate = Database["public"]["Tables"]["planos_viagem"]["Update"];

function statusValido(valor: string): StatusPlanoViagem {
  return (STATUS_PLANO_VIAGEM as readonly string[]).includes(valor) ? (valor as StatusPlanoViagem) : "rascunho";
}

export type PlanoViagemFormState = { erro?: string } | undefined;

// Fase 27.48 — Planos de Viagem. Os campos "calculados" (custo_diarias,
// custo_manutencao_estimado, custo_combustivel_estimado, pedagios_total,
// custo_total_estimado) são recalculados aqui no servidor a partir dos
// valores brutos enviados pelo formulário — nunca confiamos no total que o
// client mostrou (poderia ter sido adulterado no FormData).
function numero(formData: FormData, campo: string): number {
  const raw = formData.get(campo);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function textoOuNull(formData: FormData, campo: string): string | null {
  const raw = String(formData.get(campo) ?? "").trim();
  return raw || null;
}

export type PedagioInput = { praca_nome: string; valor: number };

// Os pedágios chegam como JSON serializado num campo hidden (lista dinâmica
// no client) — mais simples que tentar reconstruir arrays indexados do
// FormData nativo.
function parsearPedagios(formData: FormData): PedagioInput[] {
  const raw = String(formData.get("pedagios_json") ?? "[]");
  try {
    const lista = JSON.parse(raw);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((p) => ({ praca_nome: String(p?.praca_nome ?? "").trim(), valor: Number(p?.valor) || 0 }))
      .filter((p) => p.praca_nome);
  } catch {
    return [];
  }
}

function montarPayload(formData: FormData, pedagiosTotal: number) {
  const kmEstimado = numero(formData, "km_estimado");
  const consumoKmL = numero(formData, "consumo_km_l");
  const precoCombustivel = numero(formData, "preco_combustivel");
  const custoCombustivelEstimado = consumoKmL > 0 ? (kmEstimado / consumoKmL) * precoCombustivel : 0;

  const nDiarias = Math.max(0, Math.round(numero(formData, "n_diarias")));
  const valorRefeicao = numero(formData, "valor_refeicao_dia");
  const valorPernoite = numero(formData, "valor_pernoite_dia");
  const valorBanho = numero(formData, "valor_banho_dia");
  const valorLavagem = numero(formData, "valor_lavagem_dia");
  const custoDiarias = nDiarias * (valorRefeicao + valorPernoite + valorBanho + valorLavagem);

  const custoManutencaoKm = numero(formData, "custo_manutencao_km");
  const custoManutencaoEstimado = kmEstimado * custoManutencaoKm;

  const custoTotalEstimado = custoCombustivelEstimado + pedagiosTotal + custoDiarias + custoManutencaoEstimado;

  const custoTotalRealRaw = formData.get("custo_total_real");
  const custoTotalReal = custoTotalRealRaw && String(custoTotalRealRaw).trim() ? Number(custoTotalRealRaw) : null;

  return {
    nome: String(formData.get("nome") ?? "").trim(),
    status: statusValido(String(formData.get("status") ?? "rascunho")),
    placa: textoOuNull(formData, "placa"),
    motorista_id: textoOuNull(formData, "motorista_id"),
    rotograma_id: textoOuNull(formData, "rotograma_id"),
    rota_salva_id: textoOuNull(formData, "rota_salva_id"),
    centro_custo_id: textoOuNull(formData, "centro_custo_id"),
    data_saida: textoOuNull(formData, "data_saida"),
    retorno_previsto: textoOuNull(formData, "retorno_previsto"),
    km_estimado: kmEstimado,
    consumo_km_l: consumoKmL,
    preco_combustivel: precoCombustivel,
    custo_combustivel_estimado: custoCombustivelEstimado,
    n_diarias: nDiarias,
    valor_refeicao_dia: valorRefeicao,
    valor_pernoite_dia: valorPernoite,
    valor_banho_dia: valorBanho,
    valor_lavagem_dia: valorLavagem,
    custo_diarias: custoDiarias,
    custo_manutencao_km: custoManutencaoKm,
    custo_manutencao_estimado: custoManutencaoEstimado,
    receita_viagem: numero(formData, "receita_viagem"),
    pedagios_total: pedagiosTotal,
    custo_total_estimado: custoTotalEstimado,
    custo_total_real: custoTotalReal,
    observacoes: textoOuNull(formData, "observacoes"),
  };
}

export async function criarPlanoViagem(
  empresaId: string,
  _prev: PlanoViagemFormState,
  formData: FormData
): Promise<PlanoViagemFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pedagios = parsearPedagios(formData);
  const pedagiosTotal = pedagios.reduce((soma, p) => soma + p.valor, 0);
  const payload = montarPayload(formData, pedagiosTotal);

  if (!payload.nome) {
    return { erro: "O nome do plano é obrigatório." };
  }
  if (!empresaId) {
    return { erro: "Selecione um cliente antes de salvar." };
  }

  const { data, error } = await supabase
    .from("planos_viagem")
    .insert({ ...payload, empresa_id: empresaId, criado_por: user?.email ?? null })
    .select("id")
    .single();

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  if (pedagios.length > 0) {
    const { error: erroPedagios } = await supabase.from("planos_viagem_pedagios").insert(
      pedagios.map((p, i) => ({
        plano_viagem_id: data.id,
        praca_nome: p.praca_nome,
        valor: p.valor,
        ordem: i,
      }))
    );
    if (erroPedagios) {
      // Best-effort: o plano já foi criado, não vale a pena reverter só por
      // causa dos pedágios — apenas loga pro Daniel investigar se acontecer.
      console.error("[planos-viagem] falha ao salvar pedágios:", erroPedagios.message);
    }
  }

  revalidatePath("/planos-viagem");
  redirect(`/planos-viagem/${data.id}/editar`);
}

export async function atualizarPlanoViagem(
  id: string,
  _prev: PlanoViagemFormState,
  formData: FormData
): Promise<PlanoViagemFormState> {
  const supabase = await createClient();

  const pedagios = parsearPedagios(formData);
  const pedagiosTotal = pedagios.reduce((soma, p) => soma + p.valor, 0);
  const payload: PlanoViagemUpdate = montarPayload(formData, pedagiosTotal);

  if (!payload.nome) {
    return { erro: "O nome do plano é obrigatório." };
  }

  const { error } = await supabase
    .from("planos_viagem")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  // Substitui a lista inteira de pedágios (mais simples que tentar
  // diff/merge linha a linha — a lista costuma ter poucos itens).
  const { error: erroLimpar } = await supabase.from("planos_viagem_pedagios").delete().eq("plano_viagem_id", id);
  if (!erroLimpar && pedagios.length > 0) {
    await supabase.from("planos_viagem_pedagios").insert(
      pedagios.map((p, i) => ({
        plano_viagem_id: id,
        praca_nome: p.praca_nome,
        valor: p.valor,
        ordem: i,
      }))
    );
  }

  revalidatePath("/planos-viagem");
  revalidatePath(`/planos-viagem/${id}/editar`);
  return {};
}

export async function excluirPlanoViagem(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("planos_viagem").delete().eq("id", id);

  if (error) {
    return { erro: `Não foi possível excluir: ${error.message}` };
  }

  revalidatePath("/planos-viagem");
  return {};
}

export type ResultadoRevisao = { erro?: string; litros?: number; valor?: number };

// "Revisar" combustível real: soma litros/valor dos abastecimentos de
// verdade (abastecimentos_unificado — ProFrotas + lançamento manual/
// importação) daquela placa, entre a data de saída e o retorno previsto
// (ou hoje, se ainda não tiver retorno definido). Reaproveita a mesma view
// já usada em vários indicadores do Dashboard.
export async function revisarCombustivelRealAcao(planoId: string): Promise<ResultadoRevisao> {
  const supabase = await createClient();

  const { data: plano, error: erroPlano } = await supabase
    .from("planos_viagem")
    .select("empresa_id, placa, data_saida, retorno_previsto")
    .eq("id", planoId)
    .single();

  if (erroPlano || !plano) {
    return { erro: "Plano não encontrado." };
  }
  if (!plano.placa) {
    return { erro: "Defina a placa do veículo antes de revisar o combustível real." };
  }
  if (!plano.data_saida) {
    return { erro: "Defina a data de saída antes de revisar o combustível real." };
  }

  const dataFim = plano.retorno_previsto ?? new Date().toISOString().slice(0, 10);

  const { data: resultado, error: erroAbast } = await supabase
    .rpc("combustivel_real_periodo", {
      p_empresa_id: plano.empresa_id,
      p_placa: plano.placa,
      p_data_inicio: plano.data_saida,
      p_data_fim: dataFim,
    })
    .single();

  if (erroAbast) {
    return { erro: `Não foi possível buscar os abastecimentos reais: ${erroAbast.message}` };
  }

  const litros = resultado?.litros ?? 0;
  const valor = resultado?.valor_total ?? 0;

  const { error: erroSalvar } = await supabase
    .from("planos_viagem")
    .update({
      combustivel_real_litros: litros,
      custo_combustivel_real: valor,
      combustivel_real_revisado_em: new Date().toISOString(),
    })
    .eq("id", planoId);

  if (erroSalvar) {
    return { erro: `Não foi possível salvar a revisão: ${erroSalvar.message}` };
  }

  revalidatePath(`/planos-viagem/${planoId}/editar`);
  return { litros, valor };
}
