"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularHashDedupe, parseExtrato, sugerirContas, type ContaEmAberto } from "@/lib/conciliacaoBancaria";

export type ConciliacaoFormState = { erro?: string; sucesso?: string } | undefined;

// Fase Grupo 1 Rodopar item 3 (03/08/2026) — importa um arquivo de extrato
// (OFX ou CSV) e insere os lançamentos como pendentes, com dedupe por
// hash(empresa+data+valor+descricao) — reimportar o mesmo período não
// duplica (usa upsert com onConflict ignorando duplicatas).
export async function importarExtratoAcao(empresaId: string, _prev: ConciliacaoFormState, formData: FormData): Promise<ConciliacaoFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const arquivo = formData.get("arquivo");
  const contaBancaria = String(formData.get("conta_bancaria") ?? "").trim() || null;
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo OFX ou CSV." };

  const conteudo = await arquivo.text();
  const lancamentos = parseExtrato(arquivo.name, conteudo);

  if (lancamentos.length === 0) {
    return { erro: "Não foi possível reconhecer nenhum lançamento nesse arquivo. Confira se é um OFX válido ou um CSV com colunas Data/Descrição/Valor." };
  }

  const linhas = lancamentos.map((l) => {
    const valorComSinal = l.tipo === "debito" ? -l.valor : l.valor;
    return {
      empresa_id: empresaId,
      data: l.data,
      descricao: l.descricao,
      valor: valorComSinal,
      tipo: l.tipo,
      conta_bancaria: contaBancaria,
      identificador_externo: l.identificadorExterno,
      hash_dedupe: calcularHashDedupe({ empresaId, data: l.data, valor: valorComSinal, descricao: l.descricao }),
      arquivo_origem: arquivo.name,
      importado_por: user?.email ?? null,
    };
  });

  // Dedupe explícito: busca os hashes já existentes da empresa e filtra em
  // memória antes do insert, em vez de depender do comportamento do
  // upsert(ignoreDuplicates) pra contar precisamente quantos eram novos —
  // reimportar "últimos 90 dias" toda semana é o caso comum aqui.
  const { data: existentes } = await supabase
    .from("extrato_bancario_lancamentos")
    .select("hash_dedupe")
    .eq("empresa_id", empresaId)
    .in("hash_dedupe", linhas.map((l) => l.hash_dedupe));
  const hashesExistentes = new Set((existentes ?? []).map((e) => e.hash_dedupe));
  const linhasNovas = linhas.filter((l) => !hashesExistentes.has(l.hash_dedupe));
  const duplicados = linhas.length - linhasNovas.length;

  if (linhasNovas.length > 0) {
    const { error } = await supabase.from("extrato_bancario_lancamentos").insert(linhasNovas);
    if (error) return { erro: `Não foi possível importar: ${error.message}` };
  }

  revalidatePath("/conciliacao-bancaria");
  return {
    sucesso: `${linhasNovas.length} lançamento${linhasNovas.length === 1 ? "" : "s"} importado${linhasNovas.length === 1 ? "" : "s"}.${duplicados > 0 ? ` (${duplicados} já existia${duplicados === 1 ? "" : "m"} e foi${duplicados === 1 ? "" : "ram"} ignorado${duplicados === 1 ? "" : "s"}.)` : ""}`,
  };
}

// Confirma o vínculo sugerido (ou escolhido manualmente): dá baixa na conta
// (reaproveitando as RPCs baixar_conta_pagar/baixar_conta_receber já usadas
// em /financeiro, que cuidam da transição de status aberto → baixado_parcial
// /pago) e marca o lançamento do extrato como conciliado. A baixa usa o
// MENOR valor entre o lançamento do extrato e o saldo em aberto da conta
// (evita erro de "baixa maior que o saldo" quando o extrato já vem líquido
// de alguma tarifa, por exemplo).
export async function conciliarLancamentoAcao(
  lancamentoId: string,
  contaTipo: "contas_pagar" | "contas_receber",
  contaId: string,
  valorLancamento: number,
  saldoConta: number
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const valorBaixa = Math.min(Math.abs(valorLancamento), saldoConta);
  if (valorBaixa <= 0) return { erro: "Valor de baixa inválido." };

  const { error: erroBaixa } =
    contaTipo === "contas_pagar"
      ? await supabase.rpc("baixar_conta_pagar", {
          p_conta_id: contaId,
          p_valor: valorBaixa,
          p_forma: "conciliacao_bancaria",
          p_observacao: "Conciliado a partir do extrato bancário importado.",
        })
      : await supabase.rpc("baixar_conta_receber", {
          p_conta_id: contaId,
          p_valor: valorBaixa,
          p_forma: "conciliacao_bancaria",
          p_gateway_ref: null,
          p_observacao: "Conciliado a partir do extrato bancário importado.",
        });

  if (erroBaixa) return { erro: erroBaixa.message };

  const { error: erroLancamento } = await supabase
    .from("extrato_bancario_lancamentos")
    .update({
      status: "conciliado",
      conciliado_com_tipo: contaTipo,
      conciliado_com_id: contaId,
      conciliado_em: new Date().toISOString(),
      conciliado_por: user?.email ?? null,
    })
    .eq("id", lancamentoId);

  if (erroLancamento) return { erro: `Baixa confirmada, mas não foi possível marcar o extrato: ${erroLancamento.message}` };

  revalidatePath("/conciliacao-bancaria");
  revalidatePath("/financeiro");
  return {};
}

// Fase Conciliacao-IA (27/08/2026, pedido do Daniel: "treinar um matching
// automático (valor + data + fornecedor aproximado) com revisão humana só
// nas exceções acelera o fechamento financeiro do mês") — varre todos os
// pendentes da empresa e concilia de uma vez só os que têm EXATAMENTE 1
// candidato de "alta confiança" (ver calcularConfianca em
// conciliacaoBancaria.ts). 0 ou 2+ candidatos de alta confiança = ambíguo,
// fica pendente pra revisão manual (a "exceção" do pedido). Reaproveita as
// mesmas RPCs de baixa que o vínculo manual usa — não duplica lógica de
// baixa nem pula validação nenhuma, só decide sozinho QUAL conta vincular
// quando a confiança já é alta o bastante.
export async function conciliarAutomaticoAcao(empresaId: string): Promise<{ erro?: string; sucesso?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pendentesData }, { data: pagarData }, { data: receberData }] = await Promise.all([
    supabase
      .from("extrato_bancario_lancamentos")
      .select("id, data, descricao, valor, tipo")
      .eq("empresa_id", empresaId)
      .eq("status", "pendente"),
    supabase
      .from("contas_pagar")
      .select("id, credor_nome, descricao, valor_original, valor_pago, vencimento")
      .eq("empresa_id", empresaId)
      .in("status", ["aberto", "baixado_parcial"]),
    supabase
      .from("contas_receber")
      .select("id, devedor_nome, descricao, valor_original, valor_pago, vencimento")
      .eq("empresa_id", empresaId)
      .in("status", ["aberto", "baixado_parcial"]),
  ]);

  const contasPagar: ContaEmAberto[] = (pagarData ?? []).map((c) => ({
    id: c.id,
    nome: c.credor_nome ?? "Credor não identificado",
    descricao: c.descricao,
    saldoEmAberto: c.valor_original - c.valor_pago,
    vencimento: c.vencimento,
  }));
  const contasReceber: ContaEmAberto[] = (receberData ?? []).map((c) => ({
    id: c.id,
    nome: c.devedor_nome ?? "Devedor não identificado",
    descricao: c.descricao,
    saldoEmAberto: c.valor_original - c.valor_pago,
    vencimento: c.vencimento,
  }));

  let conciliados = 0;
  for (const l of pendentesData ?? []) {
    const contaTipo: "contas_pagar" | "contas_receber" = l.tipo === "debito" ? "contas_pagar" : "contas_receber";
    const candidatas = l.tipo === "debito" ? contasPagar : contasReceber;
    const sugestoes = sugerirContas({ data: l.data, valor: Math.abs(l.valor), descricao: l.descricao }, candidatas);
    const altaConfianca = sugestoes.filter((s) => s.confianca === "alta");
    if (altaConfianca.length !== 1) continue;

    const conta = altaConfianca[0];
    const valorBaixa = Math.min(Math.abs(l.valor), conta.saldoEmAberto);
    if (valorBaixa <= 0) continue;

    const { error: erroBaixa } =
      contaTipo === "contas_pagar"
        ? await supabase.rpc("baixar_conta_pagar", {
            p_conta_id: conta.id,
            p_valor: valorBaixa,
            p_forma: "conciliacao_bancaria",
            p_observacao: "Conciliado automaticamente (alta confiança: valor + data + fornecedor).",
          })
        : await supabase.rpc("baixar_conta_receber", {
            p_conta_id: conta.id,
            p_valor: valorBaixa,
            p_forma: "conciliacao_bancaria",
            p_gateway_ref: null,
            p_observacao: "Conciliado automaticamente (alta confiança: valor + data + fornecedor).",
          });
    if (erroBaixa) continue;

    const { error: erroLancamento } = await supabase
      .from("extrato_bancario_lancamentos")
      .update({
        status: "conciliado",
        conciliado_com_tipo: contaTipo,
        conciliado_com_id: conta.id,
        conciliado_em: new Date().toISOString(),
        conciliado_por: user?.email ? `${user.email} (automático)` : "automático",
      })
      .eq("id", l.id);
    if (!erroLancamento) conciliados++;
  }

  revalidatePath("/conciliacao-bancaria");
  revalidatePath("/financeiro");
  return {
    sucesso:
      conciliados > 0
        ? `${conciliados} lançamento${conciliados === 1 ? "" : "s"} conciliado${conciliados === 1 ? "" : "s"} automaticamente.`
        : "Nenhum lançamento de alta confiança encontrado.",
  };
}

// Marca como ignorado — pra transferências entre contas próprias, saques,
// tarifas já cobertas em outro lançamento etc., que não correspondem a
// nenhuma conta a pagar/receber e não deveriam continuar aparecendo como
// pendentes.
export async function ignorarLancamentoAcao(lancamentoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("extrato_bancario_lancamentos").update({ status: "ignorado" }).eq("id", lancamentoId);
  if (error) return { erro: error.message };
  revalidatePath("/conciliacao-bancaria");
  return {};
}

export async function reabrirLancamentoAcao(lancamentoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("extrato_bancario_lancamentos")
    .update({ status: "pendente", conciliado_com_tipo: null, conciliado_com_id: null, conciliado_em: null, conciliado_por: null })
    .eq("id", lancamentoId);
  if (error) return { erro: error.message };
  revalidatePath("/conciliacao-bancaria");
  return {};
}

export async function excluirLancamentoAcao(lancamentoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("extrato_bancario_lancamentos").delete().eq("id", lancamentoId);
  if (error) return { erro: error.message };
  revalidatePath("/conciliacao-bancaria");
  return {};
}
