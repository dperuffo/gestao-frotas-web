"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  type TipoVeiculoFipe,
  type FipeHistorico,
  listarMarcasFipe,
  listarModelosFipe,
  listarAnosFipe,
  buscarPrecoFipe,
  buscarPrecoFipePorCodigo,
  buscarHistoricoFipe,
  parsePrecoFipe,
} from "@/lib/fipe";

export type FipeActionState = { erro?: string } | undefined;

// As 3 funções abaixo só repassam pra API pública da FIPE — existem como
// server actions (em vez de a UI chamar fetch direto no browser) só pra
// centralizar erro/timeout num lugar só e não expor a URL/token da FIPE no
// client bundle.
export async function listarMarcasFipeAcao(tipo: TipoVeiculoFipe) {
  try {
    return { dados: await listarMarcasFipe(tipo) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível buscar as marcas." };
  }
}

export async function listarModelosFipeAcao(tipo: TipoVeiculoFipe, marcaCode: string) {
  try {
    return { dados: await listarModelosFipe(tipo, marcaCode) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível buscar os modelos." };
  }
}

export async function listarAnosFipeAcao(tipo: TipoVeiculoFipe, marcaCode: string, modeloCode: string) {
  try {
    return { dados: await listarAnosFipe(tipo, marcaCode, modeloCode) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível buscar os anos." };
  }
}

// Grava o histórico de preço (até 3 meses, free tier) numa tabela à parte —
// usa upsert (ON CONFLICT do unique cadastro_veiculo_id + mes_referencia)
// pra ser seguro chamar de novo sem duplicar linha. Sempre a partir do
// endpoint /history (não do preço "avulso"), porque só ele devolve o campo
// "reference" (código sequencial, cresce 1 por mês) que permite ordenar os
// meses cronologicamente sem parsear texto em português — sem ele não dá
// pra saber com segurança qual registro é mais recente que outro em SQL.
async function gravarHistorico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { veiculoId: string; cnpjFrota: string; placa: string; codigoFipe: string; historico: FipeHistorico }
) {
  if (params.historico.priceHistory.length === 0) return;
  await supabase.from("cadastro_veiculos_fipe_historico").upsert(
    params.historico.priceHistory.map((item) => ({
      cadastro_veiculo_id: params.veiculoId,
      cnpj_frota: params.cnpjFrota,
      placa: params.placa,
      codigo_fipe: params.codigoFipe,
      mes_referencia: item.month,
      referencia_codigo: Number(item.reference) || null,
      valor: parsePrecoFipe(item.price),
    })),
    { onConflict: "cadastro_veiculo_id,mes_referencia" }
  );
}

// Vincula o veículo a um código FIPE (escolhido via cascata tipo→marca→
// modelo→ano na UI), grava o preço atual no próprio cadastro_veiculos
// (mesmas colunas valor_fipe/codigo_fipe/combustivel_fipe/mes_referencia já
// usadas em outros pontos do sistema) e faz backfill imediato de até 3 meses
// de histórico, pra já ter alguma curva sem esperar 3 meses de cron.
export async function vincularFipeAcao(
  veiculoId: string,
  tipo: TipoVeiculoFipe,
  marcaCode: string,
  modeloCode: string,
  anoCode: string
): Promise<FipeActionState> {
  const supabase = await createClient();

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota, placa")
    .eq("id", veiculoId)
    .maybeSingle();
  if (!veiculo?.cnpj_frota) {
    return { erro: "Veículo não encontrado." };
  }

  let preco;
  try {
    preco = await buscarPrecoFipe(tipo, marcaCode, modeloCode, anoCode);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível buscar o preço FIPE." };
  }

  const valorAtual = parsePrecoFipe(preco.price);

  const { error } = await supabase
    .from("cadastro_veiculos")
    .update({
      codigo_fipe: preco.codeFipe,
      valor_fipe: valorAtual,
      combustivel_fipe: preco.fuel,
      mes_referencia: preco.referenceMonth,
      fipe_tipo_veiculo: tipo,
      fipe_ano_codigo: anoCode,
    })
    .eq("id", veiculoId);
  if (error) {
    return { erro: `Não foi possível salvar o vínculo FIPE: ${error.message}` };
  }

  // Backfill de histórico — best-effort: se o /history falhar (ex.: 429), o
  // vínculo principal acima já foi salvo com sucesso, então só avisa e segue
  // (o cron mensal preenche o resto ao longo do tempo).
  try {
    const historico = await buscarHistoricoFipe(tipo, preco.codeFipe, anoCode);
    await gravarHistorico(supabase, {
      veiculoId,
      cnpjFrota: veiculo.cnpj_frota,
      placa: veiculo.placa,
      codigoFipe: preco.codeFipe,
      historico,
    });
  } catch {
    // best-effort — não bloqueia o vínculo.
  }

  revalidatePath(`/veiculos/${veiculoId}`);
  return undefined;
}

// Refresh manual/cron: já sabemos codigo_fipe/tipo/ano — busca direto sem
// repetir a cascata marca>modelo>ano.
export async function atualizarFipeAgoraAcao(veiculoId: string): Promise<FipeActionState> {
  const supabase = await createClient();

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota, placa, codigo_fipe, fipe_tipo_veiculo, fipe_ano_codigo")
    .eq("id", veiculoId)
    .maybeSingle();

  if (!veiculo?.codigo_fipe || !veiculo.fipe_tipo_veiculo || !veiculo.fipe_ano_codigo || !veiculo.cnpj_frota) {
    return { erro: "Este veículo ainda não está vinculado a um código FIPE." };
  }

  let preco;
  try {
    preco = await buscarPrecoFipePorCodigo(
      veiculo.fipe_tipo_veiculo as TipoVeiculoFipe,
      veiculo.codigo_fipe,
      veiculo.fipe_ano_codigo
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível atualizar o preço FIPE." };
  }

  const valorAtual = parsePrecoFipe(preco.price);

  const { error } = await supabase
    .from("cadastro_veiculos")
    .update({ valor_fipe: valorAtual, combustivel_fipe: preco.fuel, mes_referencia: preco.referenceMonth })
    .eq("id", veiculoId);
  if (error) {
    return { erro: `Não foi possível atualizar: ${error.message}` };
  }

  // Busca de novo pelo /history (não só o preço avulso) pra sempre gravar
  // com referencia_codigo — de quebra também recupera meses que porventura
  // tenham ficado sem histórico (ex.: cron que falhou num mês anterior).
  try {
    const historico = await buscarHistoricoFipe(veiculo.fipe_tipo_veiculo as TipoVeiculoFipe, veiculo.codigo_fipe, veiculo.fipe_ano_codigo);
    await gravarHistorico(supabase, {
      veiculoId,
      cnpjFrota: veiculo.cnpj_frota,
      placa: veiculo.placa,
      codigoFipe: veiculo.codigo_fipe,
      historico,
    });
  } catch {
    // best-effort — o valor atual em cadastro_veiculos já foi salvo.
  }

  revalidatePath(`/veiculos/${veiculoId}`);
  return undefined;
}
