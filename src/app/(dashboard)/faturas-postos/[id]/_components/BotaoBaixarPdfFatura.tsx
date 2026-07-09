"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { FaturaPdf, type ItemExtratoFaturaPdf, type ParteBoletoPdf } from "./FaturaPdf";

// @react-pdf/renderer só funciona no client — carregado via next/dynamic
// com ssr:false (ver BotaoBaixarPdfFaturaLazy.tsx), mesmo padrão já usado em
// Rotograma/Roteirização/Relatórios/Assistente.
//
// Fase 27.92 — props novas (numeroFatura, cedente, sacado, qrCodePixDataUrl)
// pro documento no estilo boleto.
export function BotaoBaixarPdfFatura({
  nomeArquivo,
  numeroFatura,
  cedente,
  sacado,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  volumeTotal,
  quantidadeAbastecimentos,
  itens,
  qrCodePixDataUrl,
}: {
  nomeArquivo: string;
  numeroFatura: number;
  cedente: ParteBoletoPdf;
  sacado: ParteBoletoPdf;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  volumeTotal: number;
  quantidadeAbastecimentos: number;
  itens: ItemExtratoFaturaPdf[];
  qrCodePixDataUrl?: string | null;
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <FaturaPdf
          numeroFatura={numeroFatura}
          cedente={cedente}
          sacado={sacado}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          vencimento={vencimento}
          status={status}
          valorTotal={valorTotal}
          volumeTotal={volumeTotal}
          quantidadeAbastecimentos={quantidadeAbastecimentos}
          itens={itens}
          qrCodePixDataUrl={qrCodePixDataUrl}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar boleto (PDF)")}
    </PDFDownloadLink>
  );
}
