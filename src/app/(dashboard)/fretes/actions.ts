"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verificarAcessoFretes, MENSAGEM_FRETES_BLOQUEADO } from "@/lib/limitePlano";

// Fretes (Fase Fretes) — mecanismo de contratação de frete entre cliente e
// motorista, dois modos:
//   - Direto: cliente já define o motorista (próprio, via `empresa_id`, ou
//     agregado/terceiro, via empresas_motoristas_parceiros ativo) — frete
//     nasce com status "aguardando_confirmacao", só o motorista escolhido
//     vê, sem negociação (valor já combinado).
//   - Mercado aberto: cliente não define motorista — frete nasce
//     "disponivel", visível pra rede toda, com negociação de valor
//     (fretes_negociacoes/fretes_negociacoes_rodadas, RPCs SECURITY DEFINER).
// Mesmo padrão de autorização de /parcerias-locais: RLS já protege de
// verdade, esta checagem só devolve mensagem amigável antes de bater nela.

export type FreteFormState = { erro?: string } | undefined;

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

export async function criarFrete(empresaId: string, _prev: FreteFormState, formData: FormData): Promise<FreteFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para publicar fretes nesta empresa." };
  }

  // Gestão de Fretes é exclusiva do plano Enterprise (com exceção do
  // período de trial) — pedido do Daniel (18/07). Checado aqui (não só na
  // tela) porque é o ponto real de escrita; RLS não sabe de plano.
  const acesso = await verificarAcessoFretes(supabase, empresaId);
  if (!acesso.ok) {
    return { erro: MENSAGEM_FRETES_BLOQUEADO };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const origemLabel = String(formData.get("origem_label") ?? "").trim();
  const origemLat = Number(formData.get("origem_lat") ?? "");
  const origemLon = Number(formData.get("origem_lon") ?? "");
  const destinoLabel = String(formData.get("destino_label") ?? "").trim();
  const destinoLat = Number(formData.get("destino_lat") ?? "");
  const destinoLon = Number(formData.get("destino_lon") ?? "");
  const tipoCarga = String(formData.get("tipo_carga") ?? "").trim() || null;
  const pesoCargaRaw = String(formData.get("peso_carga_kg") ?? "").trim();
  const pesoCarga = pesoCargaRaw ? Number(pesoCargaRaw) : null;
  const kmEstimadoRaw = String(formData.get("km_estimado") ?? "").trim();
  const kmEstimado = kmEstimadoRaw ? Number(kmEstimadoRaw) : null;
  const valorOferecido = Number(formData.get("valor_oferecido") ?? "");
  const motoristaId = String(formData.get("motorista_id") ?? "").trim() || null;
  // Fase Fretes-Público-Alvo (23/07/26) — no mercado aberto o cliente
  // escolhe o alvo da solicitação: fora da base (rede/parceiros) ou base
  // (motoristas próprios). No modo direto o campo não vem — default
  // fora_base, irrelevante (visibilidade é pelo motorista_id).
  const publicoAlvoRaw = String(formData.get("publico_alvo") ?? "").trim();
  const publicoAlvo = publicoAlvoRaw === "base" || publicoAlvoRaw === "fora_base" ? publicoAlvoRaw : "fora_base";

  // Fase Fretes-Dados-Completos — pedido do Daniel: motorista precisa de
  // endereço completo, horário exato e dimensões pra decidir se aceita o
  // frete. Campos estruturados (não mais um texto livre de origem/destino
  // só pra cidade, que continua existindo pro cálculo de km/mapa).
  const campoTexto = (nome: string) => String(formData.get(nome) ?? "").trim() || null;
  const campoNumero = (nome: string) => {
    const raw = String(formData.get(nome) ?? "").trim();
    return raw ? Number(raw) : null;
  };
  const coletaRua = campoTexto("coleta_rua");
  const coletaNumero = campoTexto("coleta_numero");
  const coletaBairro = campoTexto("coleta_bairro");
  const coletaCidade = campoTexto("coleta_cidade");
  const coletaUf = campoTexto("coleta_uf");
  const coletaCep = campoTexto("coleta_cep");
  const coletaReferencia = campoTexto("coleta_referencia");
  const coletaData = campoTexto("coleta_data");
  const coletaHora = campoTexto("coleta_hora");
  const coletaContatoNome = campoTexto("coleta_contato_nome");
  const coletaContatoTelefone = campoTexto("coleta_contato_telefone");
  const entregaRua = campoTexto("entrega_rua");
  const entregaNumero = campoTexto("entrega_numero");
  const entregaBairro = campoTexto("entrega_bairro");
  const entregaCidade = campoTexto("entrega_cidade");
  const entregaUf = campoTexto("entrega_uf");
  const entregaCep = campoTexto("entrega_cep");
  const entregaReferencia = campoTexto("entrega_referencia");
  const entregaData = campoTexto("entrega_data");
  const entregaHora = campoTexto("entrega_hora");
  const entregaContatoNome = campoTexto("entrega_contato_nome");
  const entregaContatoTelefone = campoTexto("entrega_contato_telefone");
  const cargaComprimento = campoNumero("carga_comprimento_m");
  const cargaLargura = campoNumero("carga_largura_m");
  const cargaAltura = campoNumero("carga_altura_m");
  // data_saida_prevista/prazo_entrega (colunas antigas, só DATA) continuam
  // preenchidas a partir da coleta/entrega novas, pra quem ainda lê elas
  // (cards antigos, apps que não foram atualizados) não ficar sem nada.
  const dataSaida = coletaData;
  const prazoEntrega = entregaData;
  // Fase Fretes-Dados-Completos-2 — checkboxes de mesmo `name` chegam como
  // múltiplos valores no FormData; getAll() traz todos marcados.
  const veiculosAceitos = formData.getAll("veiculos_aceitos").map(String);
  const carroceriasAceitas = formData.getAll("carrocerias_aceitas").map(String);

  // Fase Fretes-Adiantamento-Combustível (19/07) — pedido do Daniel:
  // entrada/saldo final (default 30/70, gerado automaticamente quando o
  // frete é aceito — ver trigger trg_gerar_pagamentos_frete) e, opcional,
  // uma reserva de combustível que o motorista consome primeiro (antes da
  // cota do veículo — ver alocar_abastecimento_saldo).
  const percentualAdiantamentoRaw = String(formData.get("percentual_adiantamento") ?? "").trim();
  const percentualAdiantamento = percentualAdiantamentoRaw ? Number(percentualAdiantamentoRaw) : 30;
  const saldoCombustivelTipoRaw = String(formData.get("saldo_combustivel_tipo") ?? "").trim();
  const saldoCombustivelTipo = saldoCombustivelTipoRaw === "Valor" || saldoCombustivelTipoRaw === "Volume" ? saldoCombustivelTipoRaw : null;
  const saldoCombustivelAlocadoRaw = String(formData.get("saldo_combustivel_alocado") ?? "").trim();
  const saldoCombustivelAlocado = saldoCombustivelTipo && saldoCombustivelAlocadoRaw ? Number(saldoCombustivelAlocadoRaw) : null;

  if (!titulo) return { erro: "Título é obrigatório." };
  if (!Number.isFinite(percentualAdiantamento) || percentualAdiantamento < 0 || percentualAdiantamento > 100) {
    return { erro: "Percentual de adiantamento precisa estar entre 0 e 100." };
  }
  if (saldoCombustivelTipo && (!Number.isFinite(saldoCombustivelAlocado) || (saldoCombustivelAlocado as number) <= 0)) {
    return { erro: "Informe um valor válido pra reserva de combustível." };
  }
  if (!origemLabel || !Number.isFinite(origemLat) || !Number.isFinite(origemLon)) {
    return { erro: "Escolha a origem na lista de sugestões." };
  }
  if (!destinoLabel || !Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) {
    return { erro: "Escolha o destino na lista de sugestões." };
  }
  if (!Number.isFinite(valorOferecido) || valorOferecido <= 0) {
    return { erro: "Informe um valor de frete válido." };
  }
  if (pesoCargaRaw && (!Number.isFinite(pesoCarga) || (pesoCarga as number) <= 0)) {
    return { erro: "Peso da carga precisa ser maior que zero." };
  }

  // Modo direto exige que o motorista escolhido seja próprio (empresa_id
  // igual) ou parceiro ativo — a RLS não valida isso sozinha (motorista_id
  // é só uma FK solta), então checamos aqui antes de gravar.
  if (motoristaId) {
    const { data: proprio } = await supabase
      .from("motoristas")
      .select("id")
      .eq("id", motoristaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!proprio) {
      const { data: parceiro } = await supabase
        .from("empresas_motoristas_parceiros")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("motorista_id", motoristaId)
        .eq("status", "ativo")
        .maybeSingle();
      if (!parceiro) {
        return { erro: "Esse motorista não é da sua empresa nem um parceiro ativo." };
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fretes").insert({
    empresa_id: empresaId,
    titulo,
    descricao,
    origem_label: origemLabel,
    origem_lat: origemLat,
    origem_lon: origemLon,
    destino_label: destinoLabel,
    destino_lat: destinoLat,
    destino_lon: destinoLon,
    tipo_carga: tipoCarga,
    peso_carga_kg: pesoCarga,
    data_saida_prevista: dataSaida,
    prazo_entrega: prazoEntrega,
    km_estimado: kmEstimado,
    valor_oferecido: valorOferecido,
    motorista_id: motoristaId,
    status: motoristaId ? "aguardando_confirmacao" : "disponivel",
    publico_alvo: publicoAlvo,
    criado_por: user?.email ?? null,
    coleta_rua: coletaRua,
    coleta_numero: coletaNumero,
    coleta_bairro: coletaBairro,
    coleta_cidade: coletaCidade,
    coleta_uf: coletaUf,
    coleta_cep: coletaCep,
    coleta_referencia: coletaReferencia,
    coleta_data: coletaData,
    coleta_hora: coletaHora,
    coleta_contato_nome: coletaContatoNome,
    coleta_contato_telefone: coletaContatoTelefone,
    entrega_rua: entregaRua,
    entrega_numero: entregaNumero,
    entrega_bairro: entregaBairro,
    entrega_cidade: entregaCidade,
    entrega_uf: entregaUf,
    entrega_cep: entregaCep,
    entrega_referencia: entregaReferencia,
    entrega_data: entregaData,
    entrega_hora: entregaHora,
    entrega_contato_nome: entregaContatoNome,
    entrega_contato_telefone: entregaContatoTelefone,
    carga_comprimento_m: cargaComprimento,
    carga_largura_m: cargaLargura,
    carga_altura_m: cargaAltura,
    veiculos_aceitos: veiculosAceitos,
    carrocerias_aceitas: carroceriasAceitas,
    percentual_adiantamento: percentualAdiantamento,
    saldo_combustivel_tipo: saldoCombustivelTipo,
    saldo_combustivel_alocado: saldoCombustivelAlocado,
  });
  if (error) return { erro: `Não foi possível publicar o frete: ${error.message}` };

  revalidatePath("/fretes");
  redirect(`/fretes?empresa=${empresaId}`);
}

export async function cancelarFrete(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fretes").update({ status: "cancelado", atualizado_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/fretes");
}

// Reabre pro mercado (limpa motorista_id) — usado quando o motorista
// designado recusa o frete direto e o cliente prefere abrir pra rede.
export async function reabrirFreteParaMercado(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase
    .from("fretes")
    .update({ motorista_id: null, status: "disponivel", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/fretes");
}

// Fase Fretes-Público-Alvo (23/07/26) — frete fora da base sem candidato
// (ou recusado) pode ser recolocado pra base: aberto pra todos os
// motoristas próprios (motoristaId null) ou atribuído direto a um deles.
// Validações (dono, status, motorista da base) e o encerramento das
// propostas abertas acontecem no banco (recolocar_frete_para_base).
export async function recolocarFreteParaBaseAcao(freteId: string, empresaId: string, motoristaId: string | null) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { data, error } = await supabase.rpc("recolocar_frete_para_base", {
    p_frete_id: freteId,
    p_motorista_id: motoristaId,
  });
  if (error) return { erro: error.message };
  const status = (data as { status?: string })?.status;
  if (status !== "recolocado") {
    const mensagens: Record<string, string> = {
      nao_encontrado: "Frete não encontrado.",
      sem_permissao: "Sem permissão.",
      status_invalido: "Esse frete não está mais em situação de ser recolocado (só disponível ou recusado).",
      motorista_fora_da_base: "Esse motorista não é da sua base (precisa ser motorista próprio ativo).",
    };
    return { erro: mensagens[status ?? ""] ?? "Não foi possível recolocar o frete." };
  }
  revalidatePath("/fretes");
  revalidatePath(`/fretes/${freteId}`);
}

export async function aceitarPropostaAcao(negociacaoId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("aceitar_negociacao_frete", { p_negociacao_id: negociacaoId });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

export async function recusarPropostaAcao(negociacaoId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("recusar_negociacao_frete", { p_negociacao_id: negociacaoId });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

export async function contraporPropostaAcao(negociacaoId: string, empresaId: string, valor: number, mensagem: string | null) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("propor_rodada_negociacao", {
    p_negociacao_id: negociacaoId,
    p_valor_proposto: valor,
    p_mensagem: mensagem,
  });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

// Fase Fretes B — postos recomendados, linha do tempo e avaliação.

export async function adicionarPostoRecomendadoAcao(
  freteId: string,
  empresaId: string,
  formData: FormData
): Promise<{ erro?: string } | undefined> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const nomePosto = String(formData.get("nome_posto") ?? "").trim();
  const itemCatalogoId = String(formData.get("item_catalogo_id") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!nomePosto) return { erro: "Digite o nome do posto." };

  const { error } = await supabase.from("fretes_postos_recomendados").insert({
    frete_id: freteId,
    nome_posto: nomePosto,
    item_catalogo_id: itemCatalogoId,
    observacao,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/fretes/${freteId}`);
}

export async function removerPostoRecomendadoAcao(id: string, freteId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fretes_postos_recomendados").delete().eq("id", id);
  revalidatePath(`/fretes/${freteId}`);
}

// Fase Fretes-Adiantamento-Combustível (19/07) — confirma o pagamento de
// uma parcela (adiantamento ou saldo_final). A regra "saldo_final só após
// concluído" é aplicada no banco (marcar_pagamento_frete), aqui só repassa.
export async function marcarPagamentoAcao(freteId: string, tipo: "adiantamento" | "saldo_final") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marcar_pagamento_frete", { p_frete_id: freteId, p_tipo: tipo });
  if (error) return { erro: error.message };
  revalidatePath(`/fretes/${freteId}`);
  return { status: (data as { status?: string })?.status };
}

export async function avaliarMotoristaAcao(
  freteId: string,
  empresaId: string,
  estrelas: number,
  comentario: string | null,
  tags: string[] = []
) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("avaliar_frete", {
    p_frete_id: freteId,
    p_estrelas: estrelas,
    p_comentario: comentario,
    p_tags: tags,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/fretes/${freteId}`);
}
