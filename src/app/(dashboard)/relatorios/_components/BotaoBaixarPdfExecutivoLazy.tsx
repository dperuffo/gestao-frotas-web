"use client";

import dynamic from "next/dynamic";
import type { KpiExecutivo, RiscoLinha, SavingLinha } from "./RelatorioExecutivoPdf";

const BotaoBaixarPdfExecutivo = dynamic(
  () => import("./BotaoBaixarPdfExecutivo").then((m) => m.BotaoBaixarPdfExecutivo),
  { ssr: false, loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span> }
);

export default function BotaoBaixarPdfExecutivoLazy(props: {
  nomeArquivo: string;
  nomeEmpresa: string;
  periodo: string;
  kpis: KpiExecutivo[];
  savings: SavingLinha[];
  riscos: RiscoLinha[];
}) {
  return <BotaoBaixarPdfExecutivo {...props} />;
}
