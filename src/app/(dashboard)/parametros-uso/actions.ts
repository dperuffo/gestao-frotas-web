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

// Fase 27.121 — os outros 9 tipos do anexo do Daniel. Diferente do Vínculo
// (que tem página própria de criar/editar com redirect), estes usam modal
// inline na própria /parametros-uso — por isso as ações aqui NÃO fazem
// redirect, só devolvem {erro} (ou undefined em caso de sucesso) pro modal
// fechar sozinho e a lista atualizar via revalidatePath.
export type RegraFormState = { erro?: string } | undefined;

function textoOuNull(formData: FormData, campo: string): string | null {
  const v = String(formData.get(campo) ?? "").trim();
  return v || null;
}

function numeroOuNull(formData: FormData, campo: string): number | null {
  const v = String(formData.get(campo) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function classificacaoOuNull(formData: FormData, campo: string): "Leve" | "Pesado" | null {
  const v = String(formData.get(campo) ?? "").trim();
  return v === "Leve" || v === "Pesado" ? v : null;
}

// --- Intervalo entre Abastecimentos -----------------------------------
export async function criarIntervalo(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const intervaloMinimo = numeroOuNull(formData, "intervalo_minimo");
  if (!empresaId || (tipo !== "Veiculo" && tipo !== "Motorista") || !intervaloMinimo) {
    return { erro: "Tipo (Veículo/Motorista) e intervalo mínimo são obrigatórios." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_intervalo_abastecimento").insert({
    empresa_id: empresaId,
    tipo,
    placa: tipo === "Veiculo" ? textoOuNull(formData, "placa")?.toUpperCase() ?? null : null,
    motorista_id: tipo === "Motorista" ? textoOuNull(formData, "motorista_id") : null,
    intervalo_minimo: intervaloMinimo,
    unidade: (String(formData.get("unidade") ?? "Horas") === "Dias" ? "Dias" : "Horas") as "Horas" | "Dias",
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusIntervalo(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_intervalo_abastecimento")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirIntervalo(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_intervalo_abastecimento").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Valor Diário Permitido — Motorista --------------------------------
export async function criarValorDiario(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const valorMaximo = numeroOuNull(formData, "valor_maximo");
  if (!empresaId || !valorMaximo) {
    return { erro: "Valor máximo diário é obrigatório." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_valor_diario_motorista").insert({
    empresa_id: empresaId,
    motorista_id: textoOuNull(formData, "motorista_id"),
    valor_maximo: valorMaximo,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusValorDiario(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_valor_diario_motorista")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirValorDiario(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_valor_diario_motorista").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Volume Diário Permitido — Veículo ---------------------------------
export async function criarVolumeDiario(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const volumeMaximo = numeroOuNull(formData, "volume_maximo");
  if (!empresaId || !volumeMaximo) {
    return { erro: "Volume máximo diário é obrigatório." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_volume_diario_veiculo").insert({
    empresa_id: empresaId,
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    volume_maximo: volumeMaximo,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusVolumeDiario(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_volume_diario_veiculo")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirVolumeDiario(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_volume_diario_veiculo").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Produto Abastecido --------------------------------------------------
export async function criarProduto(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Cliente é obrigatório." };
  const combustiveis = formData.getAll("combustiveis_permitidos").map(String);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_produto_abastecido").insert({
    empresa_id: empresaId,
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    combustiveis_permitidos: combustiveis,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusProduto(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_produto_abastecido")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirProduto(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_produto_abastecido").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Variação Máx. de Hodômetro (Leve/Pesado — 2 abas, 1 tabela) -------
export async function criarVariacaoHodometro(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const classificacao = String(formData.get("classificacao") ?? "");
  const variacaoMaxima = numeroOuNull(formData, "variacao_maxima_km");
  if (!empresaId || (classificacao !== "Leve" && classificacao !== "Pesado") || !variacaoMaxima) {
    return { erro: "Classificação e variação máxima (km) são obrigatórias." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_variacao_hodometro").insert({
    empresa_id: empresaId,
    classificacao,
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    variacao_maxima_km: variacaoMaxima,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusVariacaoHodometro(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_variacao_hodometro")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirVariacaoHodometro(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_variacao_hodometro").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Dias e Horários Permitidos ------------------------------------------
export async function criarDiasHorarios(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const dias = formData.getAll("dias_permitidos").map(String);
  const horaInicio = String(formData.get("hora_inicio") ?? "");
  const horaFim = String(formData.get("hora_fim") ?? "");
  if (!empresaId || dias.length === 0 || !horaInicio || !horaFim) {
    return { erro: "Ao menos um dia da semana e o horário de início/fim são obrigatórios." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_dias_horarios").insert({
    empresa_id: empresaId,
    classificacao: classificacaoOuNull(formData, "classificacao"),
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    motorista_id: textoOuNull(formData, "motorista_id"),
    dias_permitidos: dias,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusDiasHorarios(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_dias_horarios")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirDiasHorarios(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_dias_horarios").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Postos Permitidos para Abastecimento --------------------------------
export async function criarPostosPermitidos(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const postos = formData.getAll("postos_cnpj").map(String);
  if (!empresaId || postos.length === 0) {
    return { erro: "Selecione ao menos um posto permitido." };
  }
  const tipoLimiteBruto = String(formData.get("tipo_limite") ?? "Sem limite");
  const tipoLimite: "Sem limite" | "Valor" | "Volume" =
    tipoLimiteBruto === "Valor" || tipoLimiteBruto === "Volume" ? tipoLimiteBruto : "Sem limite";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_postos_permitidos").insert({
    empresa_id: empresaId,
    classificacao: classificacaoOuNull(formData, "classificacao"),
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    motorista_id: textoOuNull(formData, "motorista_id"),
    postos_cnpj: postos,
    tipo_limite: tipoLimite,
    valor_maximo: tipoLimite === "Sem limite" ? null : numeroOuNull(formData, "valor_maximo"),
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusPostosPermitidos(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_postos_permitidos")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirPostosPermitidos(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_postos_permitidos").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Limite Permitido — Serviços ------------------------------------------
export async function criarLimiteServicos(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Cliente é obrigatório." };

  const servicos = formData.getAll("servico").map(String);
  const qtds = formData.getAll("qtd_maxima").map(String);
  const valores = formData.getAll("valor_maximo_servico").map(String);
  const limites = servicos
    .map((servico, i) => ({
      servico,
      qtd_maxima: qtds[i] ? Number(qtds[i]) : null,
      valor_maximo: valores[i] ? Number(valores[i]) : null,
    }))
    .filter((l) => l.servico && (l.qtd_maxima !== null || l.valor_maximo !== null));

  if (limites.length === 0) {
    return { erro: "Preencha ao menos um serviço com quantidade ou valor máximo." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("parametros_limite_servicos").insert({
    empresa_id: empresaId,
    placa: textoOuNull(formData, "placa")?.toUpperCase() ?? null,
    motorista_id: textoOuNull(formData, "motorista_id"),
    postos_cnpj: formData.getAll("postos_cnpj").map(String),
    limites,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusLimiteServicos(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_limite_servicos")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirLimiteServicos(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_limite_servicos").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}

// --- Cota por Veículo ------------------------------------------------------
export async function criarCota(_prev: RegraFormState, formData: FormData): Promise<RegraFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const placa = textoOuNull(formData, "placa")?.toUpperCase();
  const tipo = String(formData.get("tipo") ?? "");
  const limite = numeroOuNull(formData, "limite");
  if (!empresaId || !placa || (tipo !== "Valor" && tipo !== "Volume") || !limite) {
    return { erro: "Veículo, tipo de cota (Valor/Volume) e limite são obrigatórios." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const periodicidadeBruta = String(formData.get("periodicidade") ?? "Mes");
  const periodicidade: "Abastecimento" | "Semana" | "Quinzena" | "Mes" = (
    ["Abastecimento", "Semana", "Quinzena", "Mes"] as const
  ).includes(periodicidadeBruta as "Abastecimento" | "Semana" | "Quinzena" | "Mes")
    ? (periodicidadeBruta as "Abastecimento" | "Semana" | "Quinzena" | "Mes")
    : "Mes";
  const { error } = await supabase.from("parametros_cota_veiculo").insert({
    empresa_id: empresaId,
    placa,
    tipo,
    limite,
    periodicidade,
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
}

export async function alternarStatusCota(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_cota_veiculo")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-uso");
}

export async function excluirCota(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_cota_veiculo").delete().eq("id", id);
  revalidatePath("/parametros-uso");
}
