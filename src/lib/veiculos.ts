import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type VeiculoRow = Database["public"]["Tables"]["cadastro_veiculos"]["Row"];

// Fase 27.38 — achado real (reportado pelo Daniel, com uma frota de teste de
// mais de 2000 veículos): uma alocação em massa pro centro de custo
// "Matriz - SP" só moveu 1000 dos 2357 veículos da empresa. Causa raiz: o
// Supabase/PostgREST tem um limite PADRÃO de 1000 linhas por resposta (a
// configuração "db-max-rows" da API), aplicado silenciosamente a QUALQUER
// consulta sem paginação explícita — inclusive a RPCs que devolvem
// conjuntos de linhas, como `veiculos_da_empresa`. Sem erro nenhum, a
// consulta simplesmente devolve só as primeiras 1000 linhas.
//
// Essa RPC é usada em vários pontos do app pra listar TODA a frota de um
// cliente (Dashboard, /veiculos, Roteirizador Inteligente, Rotograma, a API
// de integração de veículos) — qualquer cliente com mais de 1000 veículos
// ativos seria afetado em TODOS esses lugares, não só na alocação de
// centro de custo. Esta função centraliza a busca com paginação via
// `.range()` em lotes de 1000 (o mesmo tamanho do limite do PostgREST, só
// que repetido em loop até esgotar os resultados), garantindo que a frota
// inteira sempre volte, não importa o tamanho.
const TAMANHO_LOTE = 1000;

export async function buscarTodosVeiculosDaEmpresa(
  supabase: Supabase,
  empresaId: string
): Promise<{ data: VeiculoRow[]; error: string | null }> {
  const todos: VeiculoRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .rpc("veiculos_da_empresa", { p_empresa_id: empresaId })
      .range(offset, offset + TAMANHO_LOTE - 1);

    if (error) return { data: todos, error: error.message };
    if (!data || data.length === 0) break;

    todos.push(...data);
    if (data.length < TAMANHO_LOTE) break; // último lote, não precisa buscar mais
    offset += TAMANHO_LOTE;
  }

  return { data: todos, error: null };
}
