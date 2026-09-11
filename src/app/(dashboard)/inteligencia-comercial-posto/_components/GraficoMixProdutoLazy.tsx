"use client";

import dynamic from "next/dynamic";
import type { ItemMixProduto } from "./GraficoMixProduto";
export type { ItemMixProduto };

const GraficoMixProduto = dynamic(() => import("./GraficoMixProduto").then((m) => m.GraficoMixProduto), {
  ssr: false,
  loading: () => (
    <div className="flex h-[160px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoMixProdutoLazy({ dados, totalClientes }: { dados: ItemMixProduto[]; totalClientes: number }) {
  return <GraficoMixProduto dados={dados} totalClientes={totalClientes} />;
}
