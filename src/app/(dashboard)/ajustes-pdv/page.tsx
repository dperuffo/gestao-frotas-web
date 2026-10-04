import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import type { AjustePdv } from "./actions";
import { ListaAjustes } from "./_components/ListaAjustes";

// #100 — pedidos de ajuste de abastecimentos do PDV. Vale para o cliente
// (frota) e para o posto: cada um pede e a OUTRA parte aprova ou recusa.
export default async function AjustesPdvPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data } = await supabase.rpc("meus_ajustes_pdv", { p_empresa_id: empresaSelecionada ?? undefined });
  const itens = (data as unknown as AjustePdv[] | null) ?? [];
  const aguardandoMim = itens.filter((i) => i.status === "pendente" && i.possoDecidir).length;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Pedidos de ajuste (PDV)"
        descricao={`${nomeEmpresaSelecionada ? `${nomeEmpresaSelecionada} — ` : ""}Correções de abastecimentos feitos no PDV. Quem pede não aprova: a outra parte decide.`}
      />
      {aguardandoMim > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {aguardandoMim === 1 ? "1 pedido aguardando sua decisão." : `${aguardandoMim} pedidos aguardando sua decisão.`}
        </div>
      )}
      <ListaAjustes itens={itens} />
    </div>
  );
}
