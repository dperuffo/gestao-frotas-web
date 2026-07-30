"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLASSIFICACAO, type Classificacao, TIPO_PORTE_VEICULO, type TipoPorteVeiculo } from "@/lib/constants";
import { alocarVeiculoCentroCusto } from "@/lib/centroCusto";
import { normalizarCNPJ } from "@/lib/utils";

export type VeiculoFormState = { erro?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function montarPayloadBase(formData: FormData) {
  const classificacaoBruta = String(formData.get("classificacao") ?? "Próprio");
  const classificacao: Classificacao = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
    ? (classificacaoBruta as Classificacao)
    : "Próprio";

  // Fase 27.124 — porte do veículo (Leve/Pesado); campo opcional, sem valor
  // padrão forçado (diferente de classificacao) porque nem todo veículo
  // legado tem esse dado ainda.
  const tipoBruto = String(formData.get("tipo") ?? "").trim();
  const tipo: TipoPorteVeiculo | null = TIPO_PORTE_VEICULO.includes(tipoBruto as TipoPorteVeiculo)
    ? (tipoBruto as TipoPorteVeiculo)
    : null;

  return {
    placa: String(formData.get("placa") ?? "").trim().toUpperCase(),
    marca: String(formData.get("marca") ?? "").trim() || null,
    modelo: String(formData.get("modelo") ?? "").trim() || null,
    motor: String(formData.get("motor") ?? "").trim() || null,
    ano_modelo: numeroOuNull(formData.get("ano_modelo")),
    ano_fabricacao: numeroOuNull(formData.get("ano_fabricacao")),
    hodometro_atual: numeroOuNull(formData.get("hodometro_atual")),
    combustivel: String(formData.get("combustivel") ?? "").trim() || null,
    tanque: numeroOuNull(formData.get("tanque")),
    autonomia: numeroOuNull(formData.get("autonomia")),
    cor: String(formData.get("cor") ?? "").trim() || null,
    chassi: String(formData.get("chassi") ?? "").trim() || null,
    renavam: String(formData.get("renavam") ?? "").trim() || null,
    municipio: String(formData.get("municipio") ?? "").trim() || null,
    tipo_veiculo: String(formData.get("tipo_veiculo") ?? "").trim() || null,
    uf_veiculo: String(formData.get("uf_veiculo") ?? "").trim() || null,
    numero_eixos: numeroOuNull(formData.get("numero_eixos")),
    classificacao,
    tipo,
    // Fase TCO (29/07/2026) — opcionais, usados só pra calcular depreciação
    // no módulo de TCO (tco_veiculo/tco_frota_resumo).
    valor_aquisicao: numeroOuNull(formData.get("valor_aquisicao")),
    data_aquisicao: String(formData.get("data_aquisicao") ?? "").trim() || null,
    valor_residual_estimado: numeroOuNull(formData.get("valor_residual_estimado")),
  };
}

export async function criarVeiculo(_prev: VeiculoFormState, formData: FormData): Promise<VeiculoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const centroCustoId = String(formData.get("centro_custo_id") ?? "") || null;
  const payload = montarPayloadBase(formData);

  if (!payload.placa || !empresaId) {
    return { erro: "Placa e cliente são obrigatórios." };
  }

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("cnpj")
    .eq("id", empresaId)
    .maybeSingle();
  if (empresaError || !empresa?.cnpj) {
    return { erro: "Não foi possível identificar o CNPJ do cliente selecionado." };
  }

  // Fase 27.3 — achado real: a mesma placa conseguia ser cadastrada mais de
  // uma vez (a comparação crua de cnpj_frota não pegava formatos diferentes
  // do mesmo CNPJ). Checa aqui ANTES de tentar o insert pra dar uma mensagem
  // clara; o índice único normalizado no banco é a trava definitiva caso
  // essa checagem seja contornada (ex.: duas requisições simultâneas).
  const { data: duplicado } = await supabase.rpc("veiculo_duplicado", {
    p_cnpj_frota: empresa.cnpj,
    p_placa: payload.placa,
  });
  if (duplicado) {
    return { erro: `Já existe um veículo cadastrado com a placa ${payload.placa} para este cliente.` };
  }

  const { data, error } = await supabase
    .from("cadastro_veiculos")
    .insert({
      ...payload,
      cnpj_frota: empresa.cnpj,
      ativo: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { erro: `Já existe um veículo cadastrado com a placa ${payload.placa} para este cliente.` };
    }
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  // Aloca o veículo ao centro de custo escolhido (se houver), já registrando
  // o início da alocação no histórico (centros_custo_veiculos).
  if (centroCustoId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const resultadoAlocacao = await alocarVeiculoCentroCusto(supabase, {
      placa: payload.placa,
      centroCustoId,
      empresaId,
      criadoPor: user?.email ?? undefined,
    });
    if (resultadoAlocacao.erro) return { erro: resultadoAlocacao.erro };
  }

  revalidatePath("/veiculos");
  redirect(`/veiculos/${data.id}`);
}

export async function atualizarVeiculo(
  id: string,
  _prev: VeiculoFormState,
  formData: FormData
): Promise<VeiculoFormState> {
  const supabase = await createClient();
  const centroCustoId = String(formData.get("centro_custo_id") ?? "") || null;
  const ativo = formData.get("ativo") === "on";
  const payload = montarPayloadBase(formData);

  if (!payload.placa) {
    return { erro: "Placa é obrigatória." };
  }

  const { data: existente } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota")
    .eq("id", id)
    .maybeSingle();

  if (existente?.cnpj_frota) {
    const { data: duplicado } = await supabase.rpc("veiculo_duplicado", {
      p_cnpj_frota: existente.cnpj_frota,
      p_placa: payload.placa,
      p_excluir_id: id,
    });
    if (duplicado) {
      return { erro: `Já existe outro veículo cadastrado com a placa ${payload.placa} para este cliente.` };
    }
  }

  // Fase auto-cadastro-abastecimento — qualquer edição manual aqui já conta
  // como o cliente tendo revisado/completado o cadastro, mesmo que o
  // registro tenha nascido automaticamente de uma importação.
  const { error } = await supabase
    .from("cadastro_veiculos")
    .update({ ...payload, ativo, pendente_revisao: false })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { erro: `Já existe outro veículo cadastrado com a placa ${payload.placa} para este cliente.` };
    }
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  // Realoca (ou desaloca, se centroCustoId for null) o veículo, preservando
  // o histórico em centros_custo_veiculos em vez de sobrescrever a alocação.
  //
  // Achado real (30/07/2026, investigando "new row violates row-level
  // security policy for table centros_custo_veiculos" ao trocar centro de
  // custo): a busca da empresa aqui comparava `cnpj` cru
  // (`.eq("cnpj", existente.cnpj_frota)`), sem normalizar pontuação/caixa —
  // mesmo tipo de inconsistência de formato entre `empresas.cnpj` e
  // `cadastro_veiculos.cnpj_frota` que [id]/page.tsx já trata com
  // normalizarCNPJ (e que a RLS de centros_custo_veiculos também normaliza
  // via SQL). Quando os dois campos representam o mesmo CNPJ mas com
  // formatação diferente, a comparação crua não achava a empresa,
  // `empresaId` chegava `null` em alocarVeiculoCentroCusto, e o insert
  // subsequente violava o WITH CHECK da política (que exige empresa_id
  // presente na lista do usuário — null nunca casa). Corrigido buscando
  // todas as empresas e comparando normalizado, igual ao resto do app.
  if (existente?.cnpj_frota) {
    const { data: empresas } = await supabase.from("empresas").select("id, cnpj");
    const cnpjFrotaNormalizado = normalizarCNPJ(existente.cnpj_frota);
    const empresa = empresas?.find((e) => normalizarCNPJ(e.cnpj) === cnpjFrotaNormalizado) ?? null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const resultadoAlocacao = await alocarVeiculoCentroCusto(supabase, {
      placa: payload.placa,
      centroCustoId,
      empresaId: empresa?.id ?? null,
      criadoPor: user?.email ?? undefined,
    });
    if (resultadoAlocacao.erro) return { erro: resultadoAlocacao.erro };
  }

  revalidatePath("/veiculos");
  revalidatePath(`/veiculos/${id}`);
  return { erro: undefined };
}

export async function alternarAtivoVeiculo(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase.from("cadastro_veiculos").update({ ativo }).eq("id", id);
  revalidatePath("/veiculos");
}
