"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioExecutivoPdf, type KpiExecutivo, type RiscoLinha, type SavingLinha } from "./RelatorioExecutivoPdf";

// @react-pdf/renderer manipula Canvas/Blob do navegador — igual ao Leaflet,
// só funciona no client, então é carregado via next/dynamic com ssr:false
// (ver BotaoBaixarPdfExecutivoLazy.tsx) e isolado num componente próprio.
export function BotaoBaixarPdfExecutivo({
  nomeArquivo,
  nomeEmpresa,
  periodo,
  kpis,
  savings,
  riscos,
}: {
  nomeArquivo: string;
  nomeEmpresa: string;
  periodo: string;
  kpis: KpiExecutivo[];
  savings: SavingLinha[];
  riscos: RiscoLinha[];
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <RelatorioExecutivoPdf
          nomeEmpresa={nomeEmpresa}
          periodo={periodo}
          kpis={kpis}
          savings={savings}
          riscos={riscos}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar PDF Executivo")}
    </PDFDownloadLink>
  );
}
