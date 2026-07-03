"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS_ORCAMENTO, TIPOS_CUSTO_FIXO, type CategoriaOrcamento, type TipoCustoFixo } from "@/lib/financeiro";

export type FinanceiroFormState = { erro?: string; sucesso?: string } | undefined;

// Orçamento planejado: upsert manual (em vez de .upsert() com onConflict)
// porque o UNIQUE da tabela envolve centro_custo_id, que é nullable —
// Postgres trata NULLs como valores distintos num UNIQUE, então duas linhas
// com centro_custo_id nulo não colidiriam sozinhas. Aqui procuramos a linha
// existente explicitamente (com "is null" quando for o caso) antes de
// decidir entre update e insert.
export async function salvarOrcamentoAcao(_prev: FinanceiroFormState, formData: FormData): Promise<FinanceiroFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const centroCustoId = String(formData.get("centro_custo_id") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "geral") as CategoriaOrcamento;
  const ano = Number(formData.get("ano"));
  const mes = Number(formData.get("mes"));
  const valorPlanejado = Number(formData.get("valor_planejado"));
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (!empresaId) return { erro: "Selecione o cliente." };
  if (!CATEGORIAS_ORCAMENTO.includes(categoria)) return { erro: "Categoria inválida." };
  if (!Number.isInteger(ano) || ano < 2020) return { erro: "Ano inválido." };
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { erro: "Mês inválido." };
  if (!Number.isFinite(valorPlanejado) || valorPlanejado < 0) return { erro: "Valor planejado inválido." };

  let query = supabase
    .from("orcamentos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("categoria", categoria)
    .eq("ano", ano)
    .eq("mes", mes);
  query = centroCustoId ? query.eq("centro_custo_id", centroCustoId) : query.is("centro_custo_id", null);
  const { data: existente } = await query.maybeSingle();

  const { error } = existente
    ? await supabase
        .from("orcamentos")
        .update({ valor_planejado: valorPlanejado, observacoes, atualizado_em: new Date().toISOString() })
        .eq("id", existente.id)
    : await supabase.from("orcamentos").insert({
        empresa_id: empresaId,
        centro_custo_id: centroCustoId,
        categoria,
        ano,
        mes,
        valor_planejado: valorPlanejado,
        observacoes,
        criado_por: user.email,
      });

  if (error) return { erro: `Não foi possível salvar o orçamento: ${error.message}` };

  revalidatePath("/financeiro");
  return { sucesso: "Orçamento salvo." };
}

export async function excluirOrcamentoAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamentos").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/financeiro");
  return {};
}

// Edição de um orçamento já existente (linha da tabela "Orçamento do mês por
// categoria"). Diferente de salvarOrcamentoAcao (que faz upsert por
// categoria/centro/mês/ano pro formulário de criação), aqui já se sabe o
// `id` da linha — update direto, sem precisar procurar. RLS garante que só
// dá pra atualizar orçamento da própria empresa (ou admin).
export async function atualizarOrcamentoAcao(
  id: string,
  valorPlanejado: number,
  observacoes: string | null
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  if (!Number.isFinite(valorPlanejado) || valorPlanejado < 0) return { erro: "Valor planejado inválido." };

  const { error } = await supabase
    .from("orcamentos")
    .update({ valor_planejado: valorPlanejado, observacoes, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: error.message };
  revalidatePath("/financeiro");
  return {};
}

// Custo fixo lançado manualmente pelo próprio cliente (origem="manual" por
// padrão na coluna — a API externa em /api/integracoes/custos-fixos grava
// origem="api").
export async function salvarCustoFixoAcao(_prev: FinanceiroFormState, formData: FormData): Promise<FinanceiroFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as TipoCustoFixo;
  const valor = Number(formData.get("valor"));
  const competencia = String(formData.get("competencia") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase() || null;
  const centroCustoId = String(formData.get("centro_custo_id") ?? "").trim() || null;
  const recorrente = formData.get("recorrente") === "on";

  if (!empresaId) return { erro: "Selecione o cliente." };
  if (!TIPOS_CUSTO_FIXO.includes(tipo)) return { erro: "Tipo de custo inválido." };
  if (!Number.isFinite(valor) || valor < 0) return { erro: "Valor inválido." };
  if (!competencia) return { erro: "Informe a competência (mês do custo)." };

  const { error } = await supabase.from("custos_fixos").insert({
    empresa_id: empresaId,
    tipo,
    valor,
    competencia,
    descricao,
    placa,
    centro_custo_id: centroCustoId,
    recorrente,
    origem: "manual",
    criado_por: user.email,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/financeiro");
  return { sucesso: "Custo fixo lançado." };
}

export async function excluirCustoFixoAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/financeiro");
  return {};
}

// Edição de um custo fixo já lançado (linha da tabela "Últimos custos fixos
// lançados"). A tela só oferece essa edição pra lançamentos dentro do mês
// vigente (checado no componente, antes de mostrar o botão "Editar") — não
// altera a lógica aqui, que é só o update em si; RLS continua sendo a
// barreira de segurança real (dono da empresa ou admin).
export async function atualizarCustoFixoAcao(
  id: string,
  campos: {
    tipo: TipoCustoFixo;
    valor: number;
    competencia: string;
    descricao: string | null;
    placa: string | null;
    centro_custo_id: string | null;
    recorrente: boolean;
  }
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  if (!TIPOS_CUSTO_FIXO.includes(campos.tipo)) return { erro: "Tipo de custo inválido." };
  if (!Number.isFinite(campos.valor) || campos.valor < 0) return { erro: "Valor inválido." };
  if (!campos.competencia) return { erro: "Informe a competência (mês do custo)." };

  const { error } = await supabase
    .from("custos_fixos")
    .update({
      tipo: campos.tipo,
      valor: campos.valor,
      competencia: campos.competencia,
      descricao: campos.descricao,
      placa: campos.placa,
      centro_custo_id: campos.centro_custo_id,
      recorrente: campos.recorrente,
    })
    .eq("id", id);

  if (error) return { erro: error.message };
  revalidatePath("/financeiro");
  return {};
}
