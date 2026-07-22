"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verificarAcessoFretes, MENSAGEM_FRETES_BLOQUEADO } from "@/lib/limitePlano";
import { calcularFrete, calcularPisoAntt, verificarAlertaPiso, type FaixaPesoFrete } from "@/lib/freteCalculo";

// Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — cotações: simula (via
// tabelas_frete + pisos_antt, motor puro em src/lib/freteCalculo.ts), salva,
// e converte em frete com um clique (pré-preenche fretes + planos_viagem).

export type CotacaoFormState = { erro?: string } | undefined;

async function empresaPertenceAoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

export async function criarCotacao(empresaId: string, _prev: CotacaoFormState, formData: FormData): Promise<CotacaoFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para simular cotações nesta empresa." };
  }

  const acesso = await verificarAcessoFretes(supabase, empresaId);
  if (!acesso.ok) return { erro: MENSAGEM_FRETES_BLOQUEADO };

  const campoTexto = (nome: string) => String(formData.get(nome) ?? "").trim() || null;
  const campoNumero = (nome: string) => {
    const raw = String(formData.get(nome) ?? "").trim();
    return raw ? Number(raw) : null;
  };

  const tabelaFreteId = campoTexto("tabela_frete_id");
  const clienteTomadorId = campoTexto("cliente_tomador_id");
  const origemLabel = campoTexto("origem_label");
  const origemLat = campoNumero("origem_lat");
  const origemLon = campoNumero("origem_lon");
  const destinoLabel = campoTexto("destino_label");
  const destinoLat = campoNumero("destino_lat");
  const destinoLon = campoNumero("destino_lon");
  const kmEstimado = campoNumero("km_estimado");
  const pesoKg = campoNumero("peso_kg");
  const valorCarga = campoNumero("valor_carga") ?? 0;
  const tipoCarga = campoTexto("tipo_carga");
  const numeroEixos = campoNumero("numero_eixos");
  const observacoes = campoTexto("observacoes");

  if (!tabelaFreteId) return { erro: "Escolha uma tabela de frete." };
  if (!origemLabel || origemLat === null || origemLon === null) return { erro: "Escolha a origem na lista de sugestões." };
  if (!destinoLabel || destinoLat === null || destinoLon === null) return { erro: "Escolha o destino na lista de sugestões." };
  if (!pesoKg || pesoKg <= 0) return { erro: "Informe o peso da carga." };

  const { data: tabela } = await supabase
    .from("tabelas_frete")
    .select("*")
    .eq("id", tabelaFreteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!tabela) return { erro: "Tabela de frete não encontrada." };

  const { data: faixasRaw } = await supabase
    .from("tabelas_frete_faixas")
    .select("peso_min_kg, peso_max_kg, valor_por_kg, valor_minimo")
    .eq("tabela_frete_id", tabelaFreteId);
  const faixas: FaixaPesoFrete[] = (faixasRaw ?? []).map((f) => ({
    pesoMinKg: f.peso_min_kg,
    pesoMaxKg: f.peso_max_kg,
    valorPorKg: f.valor_por_kg,
    valorMinimo: f.valor_minimo,
  }));
  if (faixas.length === 0) return { erro: "Essa tabela de frete não tem nenhuma faixa de peso cadastrada." };

  const resultado = calcularFrete({
    pesoKg,
    valorCarga,
    faixas,
    percentualAdValorem: tabela.percentual_ad_valorem,
    percentualGris: tabela.percentual_gris,
    valorTde: tabela.valor_tde,
    valorTda: tabela.valor_tda,
    valorDespacho: tabela.valor_despacho,
    valorPedagio: tabela.valor_pedagio,
    percentualIcms: tabela.percentual_icms,
  });

  // Piso mínimo ANTT — só dá pra calcular com tipo de carga + nº de eixos +
  // distância; qualquer um faltando, a cotação segue sem o alerta (best-effort,
  // não bloqueia a simulação).
  let pisoAnttValor: number | null = null;
  if (tipoCarga && numeroEixos && kmEstimado) {
    const { data: piso } = await supabase
      .from("pisos_antt")
      .select("coeficiente_deslocamento, coeficiente_carga_descarga")
      .eq("tipo_carga", tipoCarga)
      .eq("numero_eixos", numeroEixos)
      .maybeSingle();
    if (piso) {
      pisoAnttValor = calcularPisoAntt(kmEstimado, {
        coeficienteDeslocamento: piso.coeficiente_deslocamento,
        coeficienteCargaDescarga: piso.coeficiente_carga_descarga,
      });
    }
  }
  const pisoAlerta = verificarAlertaPiso(resultado.valorTotal, pisoAnttValor);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cotacao, error } = await supabase
    .from("cotacoes")
    .insert({
      empresa_id: empresaId,
      tabela_frete_id: tabelaFreteId,
      cliente_tomador_id: clienteTomadorId,
      origem_label: origemLabel,
      origem_lat: origemLat,
      origem_lon: origemLon,
      destino_label: destinoLabel,
      destino_lat: destinoLat,
      destino_lon: destinoLon,
      km_estimado: kmEstimado,
      peso_kg: pesoKg,
      valor_carga: valorCarga,
      tipo_carga: tipoCarga,
      numero_eixos: numeroEixos,
      valor_frete_peso: resultado.valorFretePeso,
      valor_ad_valorem: resultado.valorAdValorem,
      valor_gris: resultado.valorGris,
      valor_tde: resultado.valorTde,
      valor_tda: resultado.valorTda,
      valor_despacho: resultado.valorDespacho,
      valor_pedagio: resultado.valorPedagio,
      valor_icms: resultado.valorIcms,
      valor_total: resultado.valorTotal,
      piso_antt_valor: pisoAnttValor,
      piso_antt_alerta: pisoAlerta,
      observacoes,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();
  if (error) return { erro: `Não foi possível salvar a cotação: ${error.message}` };

  revalidatePath("/cotacoes");
  redirect(`/cotacoes/${cotacao.id}?empresa=${empresaId}`);
}

export async function descartarCotacaoAcao(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  await supabase.from("cotacoes").update({ status: "descartada", atualizado_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/cotacoes");
  revalidatePath(`/cotacoes/${id}`);
}

// Converte a cotação em frete com um clique: copia origem/destino/peso/valor
// pra um novo `fretes` (status "disponivel", pronto pra publicar/atribuir) e
// cria um `planos_viagem` já com a receita preenchida — a margem
// (receita tabelada − custo estimado) aparece assim que o usuário completar
// placa/consumo/diárias em Planos de Viagem, sem recontar nada daqui.
export async function converterCotacaoEmFreteAcao(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const acesso = await verificarAcessoFretes(supabase, empresaId);
  if (!acesso.ok) return { erro: MENSAGEM_FRETES_BLOQUEADO };

  const { data: cotacao } = await supabase.from("cotacoes").select("*").eq("id", id).eq("empresa_id", empresaId).maybeSingle();
  if (!cotacao) return { erro: "Cotação não encontrada." };
  if (cotacao.status !== "simulada") return { erro: "Essa cotação já foi convertida ou descartada." };

  const titulo = `${cotacao.origem_label} → ${cotacao.destino_label}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: frete, error: erroFrete } = await supabase
    .from("fretes")
    .insert({
      empresa_id: empresaId,
      titulo,
      origem_label: cotacao.origem_label,
      origem_lat: cotacao.origem_lat,
      origem_lon: cotacao.origem_lon,
      destino_label: cotacao.destino_label,
      destino_lat: cotacao.destino_lat,
      destino_lon: cotacao.destino_lon,
      tipo_carga: cotacao.tipo_carga,
      peso_carga_kg: cotacao.peso_kg,
      km_estimado: cotacao.km_estimado,
      valor_oferecido: cotacao.valor_total,
      status: "disponivel",
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();
  if (erroFrete || !frete) return { erro: `Não foi possível criar o frete: ${erroFrete?.message}` };

  const { data: plano, error: erroPlano } = await supabase
    .from("planos_viagem")
    .insert({
      empresa_id: empresaId,
      nome: titulo,
      km_estimado: cotacao.km_estimado,
      receita_viagem: cotacao.valor_total,
      observacoes: `Gerado a partir da cotação de ${new Date(cotacao.criado_em).toLocaleDateString("pt-BR")}.`,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (!erroPlano && plano) {
    await supabase.from("fretes").update({ plano_viagem_id: plano.id }).eq("id", frete.id);
  }

  await supabase
    .from("cotacoes")
    .update({ status: "convertida", frete_id: frete.id, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/cotacoes");
  revalidatePath(`/cotacoes/${id}`);
  revalidatePath("/fretes");
  redirect(`/fretes/${frete.id}?empresa=${empresaId}`);
}
