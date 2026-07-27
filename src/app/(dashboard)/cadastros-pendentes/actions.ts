"use server";

import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";

// Fase auto-cadastro-abastecimento (27/07/2026) — bolinha do menu (mesmo
// padrão de contarDocumentosPendentesAcao/contarAjustesAbastecimentosPendentesAcao
// em layout.tsx), mas SEM gate de admin: quem precisa ver isso é o próprio
// cliente/posto dono dos veículos/motoristas pendentes. Não usa RLS-bypass
// nenhum — a mesma sessão do usuário já só enxerga a própria empresa (RLS
// de cadastro_veiculos/motoristas), então a contagem já sai certa sozinha.
// Só soma pra quem tem exatamente 1 empresa resolvida (mesmo critério de
// resolverEmpresaAtual) — evitar ambiguidade pra quem gerencia várias
// empresas (grupo econômico) e nem sempre está "dentro" de uma delas.
export async function contarCadastrosPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase);
  if (!empresaSelecionada) return 0;

  const { data: veiculos } = await buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada);
  const veiculosPendentes = veiculos.filter((v) => v.pendente_revisao).length;

  const { count: motoristasPendentes } = await supabase
    .from("motoristas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaSelecionada)
    .eq("pendente_revisao", true);

  return veiculosPendentes + (motoristasPendentes ?? 0);
}
