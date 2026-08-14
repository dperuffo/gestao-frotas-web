"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { logger } from "@/lib/logger";

// Fase Duplicidade-Placas-Grupo (05/08/2026) — pedido do Daniel, a partir de
// um erro real ao editar um veículo ("Já existe outro veículo cadastrado
// com a placa SUT8I32..."). A RPC `veiculo_duplicado` (04/08) já bloqueia
// CRIAR/EDITAR um veículo com placa colidindo com outra empresa do mesmo
// grupo econômico ativo — mas não é retroativa, e não cobre o caso de duas
// empresas que já tinham veículos cadastrados independentemente e só DEPOIS
// entraram pro mesmo grupo (a colisão nasce sem passar por create/edit).
// Achados 9 pares assim no banco. Pedido do Daniel: "resolver na aplicacao
// estes casos e casos novos se houverem" — esta tela lista e resolve
// (corrigir placa ou inativar) tudo isso, sem precisar de mim rodando SQL
// manualmente cada vez.

export type VeiculoDuplicado = {
  placaNorm: string;
  veiculoId: string;
  placa: string;
  empresaId: string;
  empresaNome: string;
  marca: string | null;
  modelo: string | null;
  anoFabricacao: number | null;
  tipoVeiculo: string | null;
  ativo: boolean;
  criadoEm: string;
  qtdAbastecimentos: number;
};

export async function listarDuplicidadesPlacaGrupoAcao(empresaId: string): Promise<VeiculoDuplicado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_duplicidades_placa_grupo", { p_empresa_id: empresaId });
  if (error) {
    void logger.error("duplicidade-placas-grupo", "Falha ao listar (ignorado)", error);
    return [];
  }
  return (data ?? []).map((d) => ({
    placaNorm: d.placa_norm,
    veiculoId: d.veiculo_id,
    placa: d.placa,
    empresaId: d.empresa_id,
    empresaNome: d.empresa_nome,
    marca: d.marca,
    modelo: d.modelo,
    anoFabricacao: d.ano_fabricacao,
    tipoVeiculo: d.tipo_veiculo,
    ativo: d.ativo,
    criadoEm: d.criado_em,
    qtdAbastecimentos: d.qtd_abastecimentos,
  }));
}

// Bolinha do menu — mesmo critério de contarCadastrosPendentesAcao (só soma
// pra quem tem exatamente 1 empresa resolvida, evita ambiguidade multi-
// empresa) e mesma blindagem "falha vira 0" (ver layout.tsx).
export async function contarDuplicidadesPlacaGrupoAcao(): Promise<number> {
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase);
  if (!empresaSelecionada) return 0;
  const lista = await listarDuplicidadesPlacaGrupoAcao(empresaSelecionada);
  const placas = new Set(lista.map((l) => l.placaNorm));
  return placas.size;
}

export async function corrigirPlacaVeiculoAcao(veiculoId: string, novaPlaca: string): Promise<{ erro?: string }> {
  const placa = novaPlaca.trim().toUpperCase();
  if (!placa) return { erro: "Informe a placa correta." };

  const supabase = await createClient();
  const { data: existente } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota")
    .eq("id", veiculoId)
    .maybeSingle();
  if (!existente?.cnpj_frota) return { erro: "Veículo não encontrado." };

  // Mesma checagem de sempre (veiculo_duplicado) — corrigir pra uma placa
  // que já colide com outro veículo do grupo só trocaria de duplicata.
  const { data: duplicado } = await supabase.rpc("veiculo_duplicado", {
    p_cnpj_frota: existente.cnpj_frota,
    p_placa: placa,
    p_excluir_id: veiculoId,
  });
  if (duplicado) {
    return {
      erro: `Já existe outro veículo cadastrado com a placa ${placa} nesta empresa ou em uma empresa do mesmo grupo econômico.`,
    };
  }

  const { error } = await supabase.from("cadastro_veiculos").update({ placa }).eq("id", veiculoId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/duplicidade-placas-grupo");
  revalidatePath("/veiculos");
  return {};
}

// Soft-delete (ativo=false) — mesmo padrão de alternarAtivoVeiculo em
// veiculos/actions.ts. Nunca apaga o histórico de abastecimentos/
// manutenções, só tira o veículo de circulação.
export async function inativarVeiculoDuplicadoAcao(veiculoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cadastro_veiculos").update({ ativo: false }).eq("id", veiculoId);
  if (error) return { erro: `Não foi possível inativar: ${error.message}` };

  revalidatePath("/duplicidade-placas-grupo");
  revalidatePath("/veiculos");
  return {};
}
