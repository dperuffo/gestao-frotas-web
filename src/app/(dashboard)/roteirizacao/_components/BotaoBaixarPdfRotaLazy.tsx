"use client";

import dynamic from "next/dynamic";
import type { ComparativoLinhaPdf, KpiRota, ParadaLinhaPdf } from "./RelatorioRotaPdf";

const BotaoBaixarPdfRota = dynamic(() => import("./BotaoBaixarPdfRota").then((m) => m.BotaoBaixarPdfRota), {
  ssr: false,
  loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span>,
});

export default function BotaoBaixarPdfRotaLazy(props: {
  nomeArquivo: string;
  origemLabel: string;
  destinoLabel: string;
  placa?: string;
  kpis: KpiRota[];
  comparativo: ComparativoLinhaPdf[];
  paradas: ParadaLinhaPdf[];
}) {
  return <BotaoBaixarPdfRota {...props} />;
}
