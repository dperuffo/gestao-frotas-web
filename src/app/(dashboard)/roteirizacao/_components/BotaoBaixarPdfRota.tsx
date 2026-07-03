"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioRotaPdf, type ComparativoLinhaPdf, type KpiRota, type ParadaLinhaPdf } from "./RelatorioRotaPdf";

// @react-pdf/renderer manipula Canvas/Blob do navegador — só funciona no
// client, carregado via next/dynamic com ssr:false (ver
// BotaoBaixarPdfRotaLazy.tsx), mesmo padrão do Relatório Executivo (Fase 15).
export function BotaoBaixarPdfRota({
  nomeArquivo,
  origemLabel,
  destinoLabel,
  placa,
  kpis,
  comparativo,
  paradas,
}: {
  nomeArquivo: string;
  origemLabel: string;
  destinoLabel: string;
  placa?: string;
  kpis: KpiRota[];
  comparativo: ComparativoLinhaPdf[];
  paradas: ParadaLinhaPdf[];
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <RelatorioRotaPdf
          origemLabel={origemLabel}
          destinoLabel={destinoLabel}
          placa={placa}
          kpis={kpis}
          comparativo={comparativo}
          paradas={paradas}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Gerar PDF")}
    </PDFDownloadLink>
  );
}
