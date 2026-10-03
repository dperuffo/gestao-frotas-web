import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import type { AbastecimentoNegado } from "./actions";
import { ListaNegados } from "./_components/ListaNegados";

// Fase 5 PDV (03/10/2026, pedido do Daniel): abastecimentos feitos no PDV de
// um posto que foram NEGADOS por regras do cliente (parâmetros de uso,
// antifraude, bloqueios...). O gestor vê quais regras foram impactadas e, se
// o pedido ainda está dentro da validade, pode liberar o abastecimento (o
// posto então conclui normalmente) ou recusar. A bolinha no menu e o aviso
// flutuante avisam quando entra um novo pendente.
export default async function AbastecimentosNegadosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data } = await supabase.rpc("listar_abastecimentos_negados_pdv", {
    p_empresa_id: empresaSelecionada ?? undefined,
  });
  const itens = (data as unknown as AbastecimentoNegado[] | null) ?? [];
  const pendentes = itens.filter((i) => i.situacao === "pendente").length;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Abastecimentos negados (PDV)"
        descricao={
          nomeEmpresaSelecionada
            ? `${nomeEmpresaSelecionada} — últimos 30 dias. Libere enquanto o pedido estiver dentro da validade.`
            : "Últimos 30 dias. Libere enquanto o pedido estiver dentro da validade."
        }
      />
      {pendentes > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {pendentes === 1
            ? "1 abastecimento aguardando sua decisão."
            : `${pendentes} abastecimentos aguardando sua decisão.`}{" "}
          O motorista e o posto estão esperando.
        </div>
      )}
      <ListaNegados itens={itens} />
    </div>
  );
}
