"use client";

import dynamic from "next/dynamic";
import type { ItemVariacaoPreco } from "./GraficoVariacaoPrecos";

const GraficoVariacaoPrecos = dynamic(
  () => import("./GraficoVariacaoPrecos").then((m) => m.GraficoVariacaoPrecos),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoVariacaoPrecosLazy({ dados }: { dados: ItemVariacaoPreco[] }) {
  return <GraficoVariacaoPrecos dados={dados} />;
}
