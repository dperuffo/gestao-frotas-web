"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type EstoquePecasFormState = { erro?: string; ok?: boolean } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// Fase Grupo 1 Rodopar item 2 (03/08/2026) — cadastro do item do catálogo de
// peças. O saldo (quantidade_atual) NUNCA é editado diretamente aqui — só
// muda via movimentos (entrada/saída), aplicados pelo trigger
// pecas_estoque_aplicar_movimento no banco.
export async function criarPecaAcao(empresaId: string, _prev: EstoquePecasFormState, formData: FormData): Promise<EstoquePecasFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const unidadeMedida = String(formData.get("unidade_medida") ?? "un").trim() || "un";
  const quantidadeMinima = numeroOuNull(formData.get("quantidade_minima")) ?? 0;
  const quantidadeInicial = numeroOuNull(formData.get("quantidade_inicial"));
  const custoUnitario = numeroOuNull(formData.get("custo_unitario"));

  if (!nome) return { erro: "Nome da peça é obrigatório." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: peca, error } = await supabase
    .from("pecas_estoque")
    .insert({
      empresa_id: empresaId,
      nome,
      codigo,
      unidade_medida: unidadeMedida,
      quantidade_minima: quantidadeMinima,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível cadastrar a peça: ${error.message}` };

  // Estoque inicial (opcional) já entra como um movimento de entrada, pra
  // manter o ledger completo desde o dia 1 — nunca escreve direto em
  // quantidade_atual.
  if (quantidadeInicial && quantidadeInicial > 0) {
    const { error: erroMovimento } = await supabase.from("pecas_estoque_movimentos").insert({
      empresa_id: empresaId,
      peca_id: peca.id,
      tipo_movimento: "entrada",
      quantidade: quantidadeInicial,
      custo_unitario: custoUnitario,
      motivo: "Estoque inicial",
      criado_por: user?.email ?? null,
    });
    if (erroMovimento) {
      return { erro: `Peça cadastrada, mas não foi possível lançar o estoque inicial: ${erroMovimento.message}` };
    }
  }

  revalidatePath("/estoque-pecas");
  return { ok: true };
}

// Registra entrada ou saída no ledger — o trigger no banco aplica o efeito
// em quantidade_atual e a CHECK constraint (quantidade_atual >= 0) bloqueia
// qualquer saída que exceda o saldo disponível (impede requisição fantasma /
// fraude no estoque, gap identificado no benchmark Rodopar/Datapar).
export async function registrarMovimentoAcao(
  pecaId: string,
  empresaId: string,
  _prev: EstoquePecasFormState,
  formData: FormData
): Promise<EstoquePecasFormState> {
  // Achado real (13/08/2026, reportado pelo Daniel): clicar em "Registrar
  // Movimento" as vezes cai na tela de erro genérica em vez de mostrar a
  // mensagem inline de sempre — sinal de uma exceção não tratada escapando
  // da Server Action (ex.: falha pontual de rede/sessão ao chamar
  // supabase.auth.getUser() ou o insert), já que o resto da função só
  // RETORNA `{ erro }`, nunca lança. Envolve tudo num try/catch pra
  // qualquer falha inesperada também virar `{ erro }` — o form já sabe
  // mostrar isso como banner vermelho, sem derrubar a tela inteira.
  try {
    const supabase = await createClient();
    const tipoMovimento = String(formData.get("tipo_movimento") ?? "").trim();
    const quantidade = numeroOuNull(formData.get("quantidade"));
    const custoUnitario = numeroOuNull(formData.get("custo_unitario"));
    const placa = String(formData.get("placa") ?? "").trim().toUpperCase() || null;
    const manutencaoId = String(formData.get("manutencao_id") ?? "").trim() || null;
    const motivo = String(formData.get("motivo") ?? "").trim() || null;

    if (tipoMovimento !== "entrada" && tipoMovimento !== "saida") return { erro: "Selecione o tipo de movimento." };
    if (!quantidade || quantidade <= 0) return { erro: "Informe uma quantidade válida." };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("pecas_estoque_movimentos").insert({
      empresa_id: empresaId,
      peca_id: pecaId,
      tipo_movimento: tipoMovimento,
      quantidade,
      custo_unitario: tipoMovimento === "entrada" ? custoUnitario : null,
      placa,
      manutencao_id: manutencaoId ? Number(manutencaoId) : null,
      motivo,
      criado_por: user?.email ?? null,
    });

    if (error) {
      // A CHECK constraint de saldo negativo chega aqui como erro do Postgres
      // (23514) — traduz pra uma mensagem que faz sentido pro usuário.
      if (error.code === "23514") {
        return { erro: "Saída maior que o saldo disponível em estoque." };
      }
      return { erro: `Não foi possível registrar o movimento: ${error.message}` };
    }

    revalidatePath("/estoque-pecas");
    revalidatePath(`/estoque-pecas/${pecaId}`);
    return { ok: true };
  } catch (e) {
    void logger.error("estoque-pecas", "Falha inesperada ao registrar movimento", e);
    return { erro: "Falha pontual ao registrar o movimento. Tente novamente." };
  }
}

export async function editarPecaAcao(pecaId: string, dados: { nome?: string; codigo?: string | null; unidade_medida?: string; quantidade_minima?: number }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pecas_estoque")
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq("id", pecaId);
  if (error) throw new Error(error.message);
  revalidatePath("/estoque-pecas");
  revalidatePath(`/estoque-pecas/${pecaId}`);
}

// Desativação lógica (não exclui — mantém o histórico de movimentos
// íntegro). Não some da tela de detalhe, só sai da lista/autocomplete de
// peças ativas.
export async function desativarPecaAcao(pecaId: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pecas_estoque")
    .update({ ativa, atualizado_em: new Date().toISOString() })
    .eq("id", pecaId);
  if (error) throw new Error(error.message);
  revalidatePath("/estoque-pecas");
  revalidatePath(`/estoque-pecas/${pecaId}`);
}
