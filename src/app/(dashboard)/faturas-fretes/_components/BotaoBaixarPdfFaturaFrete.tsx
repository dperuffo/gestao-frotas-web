"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { FaturaFretePdf, type ItemFaturaFretePdf, type ParteFaturaFretePdf } from "./FaturaFretePdf";

// @react-pdf/renderer só funciona no client — carregado via next/dynamic
// com ssr:false (ver BotaoBaixarPdfFaturaFreteLazy.tsx), mesmo padrão de
// BotaoBaixarPdfFatura.tsx (faturas-postos).
export function BotaoBaixarPdfFaturaFrete({
  nomeArquivo,
  numeroFatura,
  cedente,
  sacado,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  itens,
  linhaDigitavelSimulada,
  qrCodePixDataUrl,
}: {
  nomeArquivo: string;
  numeroFatura: number;
  cedente: ParteFaturaFretePdf;
  sacado: ParteFaturaFretePdf;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  itens: ItemFaturaFretePdf[];
  linhaDigitavelSimulada?: string | null;
  qrCodePixDataUrl?: string | null;
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <FaturaFretePdf
          numeroFatura={numeroFatura}
          cedente={cedente}
          sacado={sacado}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          vencimento={vencimento}
          status={status}
          valorTotal={valorTotal}
          itens={itens}
          linhaDigitavelSimulada={linhaDigitavelSimulada}
          qrCodePixDataUrl={qrCodePixDataUrl}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar fatura (PDF)")}
    </PDFDownloadLink>
  );
}
