"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase 4 PDV (02/10/2026) — mesmo padrão de salvarFormaPagamentoPdvAcao
// (ver pdv-formas-pagamento/actions.ts): a RLS de pdv_bicos_catalogo
// (tenant via empresas_do_usuario OU perfil admin) é a proteção real
// contra alguém mexer numa revenda que não é dela — essas Server Actions
// não duplicam essa checagem.
export async function criarBicoCatalogoAcao(
  revendaEmpresaId: string,
  dados: {
    bomba: number;
    lado: string;
    posicao: number;
    numeroBico: number;
    codigoCombustivel: string;
    combustivel: string;
    precoLitroBase: number;
  }
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pdv_bicos_catalogo").insert({
    revenda_empresa_id: revendaEmpresaId,
    bomba: dados.bomba,
    lado: dados.lado,
    posicao: dados.posicao,
    numero_bico: dados.numeroBico,
    codigo_combustivel: dados.codigoCombustivel,
    combustivel: dados.combustivel,
    preco_litro_base: dados.precoLitroBase,
  });
  if (error) {
    return {
      erro: error.message.includes("duplicate")
        ? "Já existe um bico cadastrado nessa bomba/lado/posição."
        : `Não foi possível salvar: ${error.message}`,
    };
  }
  revalidatePath("/pdv-bicos");
  return {};
}

export async function alternarAtivoBicoCatalogoAcao(bicoId: string, ativo: boolean): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pdv_bicos_catalogo").update({ ativo }).eq("id", bicoId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/pdv-bicos");
  return {};
}

export async function atualizarPrecoBicoCatalogoAcao(bicoId: string, precoLitroBase: number): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pdv_bicos_catalogo").update({ preco_litro_base: precoLitroBase }).eq("id", bicoId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/pdv-bicos");
  return {};
}

// Remanejamento de bico pra outro combustível é comum na operação real de
// um posto (ex.: converter um bico de Gasolina Aditivada pra Diesel S10) —
// por isso o combustível é editável, não só o preço.
export async function atualizarCombustivelBicoCatalogoAcao(
  bicoId: string,
  codigoCombustivel: string,
  combustivel: string,
  precoLitroBase: number
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pdv_bicos_catalogo")
    .update({ codigo_combustivel: codigoCombustivel, combustivel, preco_litro_base: precoLitroBase })
    .eq("id", bicoId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/pdv-bicos");
  return {};
}
