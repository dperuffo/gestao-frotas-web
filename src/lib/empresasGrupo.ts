import type { createClient } from "@/lib/supabase/server";

// Fase Reuso-Operacional-Grupo — motoristas e veículos cadastrados numa
// empresa passam a poder ser usados operacionalmente (Fretes, Planos de
// Viagem, MDF-e) por qualquer empresa irmã do mesmo Grupo Econômico ativo,
// sem precisar duplicar o cadastro em cada empresa (pedido do Daniel: "isso
// já acontece na prática" com clientes que têm várias empresas no grupo).
//
// Reaproveita a mesma RPC já usada em "Replicar para o grupo"
// (listar_empresas_alvo_replicacao) — ela já resolve, com segurança
// (SECURITY DEFINER + checagem de acesso via empresas_do_usuario), quais
// empresas são irmãs de uma empresa de origem num grupo econômico ATIVO.
// Não inclui a própria empresa de origem no retorno.

export type EmpresaGrupo = { id: string; nome: string };

export async function empresasIrmasAcao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<EmpresaGrupo[]> {
  const { data } = await supabase.rpc("listar_empresas_alvo_replicacao", { p_empresa_origem_id: empresaId });
  return (data ?? []).map((e) => ({ id: e.empresa_id, nome: e.nome }));
}

// Helper de validação server-side: confere se `empresaAlvoId` é a própria
// `empresaId` ou uma irmã dela no grupo — usado nas actions que hoje
// exigem "motorista/veículo é da minha empresa" e passam a aceitar
// "é da minha empresa OU de uma irmã do grupo".
export async function empresaOuIrmaDoGrupo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  empresaAlvoId: string | null | undefined
): Promise<boolean> {
  if (!empresaAlvoId) return false;
  if (empresaAlvoId === empresaId) return true;
  const irmas = await empresasIrmasAcao(supabase, empresaId);
  return irmas.some((e) => e.id === empresaAlvoId);
}
