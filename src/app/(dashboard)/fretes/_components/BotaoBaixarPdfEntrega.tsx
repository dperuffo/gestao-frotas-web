"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { ComprovanteEntregaPdf } from "./ComprovanteEntregaPdf";

// Fase P0.4 — mesmo padrão de BotaoBaixarPdfNota.tsx: @react-pdf/renderer só
// funciona no client, carregado via next/dynamic com ssr:false (ver
// BotaoBaixarPdfEntregaLazy.tsx).
export function BotaoBaixarPdfEntrega({
  nomeArquivo,
  freteTitulo,
  origemLabel,
  destinoLabel,
  nomeRecebedor,
  documentoRecebedor,
  dataConfirmacao,
  fotoCanhotoUrl,
  assinaturaUrl,
}: {
  nomeArquivo: string;
  freteTitulo: string;
  origemLabel: string;
  destinoLabel: string;
  nomeRecebedor: string;
  documentoRecebedor: string | null;
  dataConfirmacao: string;
  fotoCanhotoUrl: string | null;
  assinaturaUrl: string | null;
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <ComprovanteEntregaPdf
          freteTitulo={freteTitulo}
          origemLabel={origemLabel}
          destinoLabel={destinoLabel}
          nomeRecebedor={nomeRecebedor}
          documentoRecebedor={documentoRecebedor}
          dataConfirmacao={dataConfirmacao}
          fotoCanhotoUrl={fotoCanhotoUrl}
          assinaturaUrl={assinaturaUrl}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block text-xs"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar comprovante (PDF)")}
    </PDFDownloadLink>
  );
}
