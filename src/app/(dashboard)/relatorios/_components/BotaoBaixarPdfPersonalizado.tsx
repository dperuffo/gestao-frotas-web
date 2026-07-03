"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPersonalizadoPdf, type ColunaPdf, type LinhaPdf } from "./RelatorioPersonalizadoPdf";

// Mesmo padrão de BotaoBaixarPdfExecutivo — @react-pdf/renderer só funciona
// no client (Canvas/Blob do navegador), por isso este componente é sempre
// carregado via next/dynamic com ssr:false (ver BotaoBaixarPdfPersonalizadoLazy.tsx).
export function BotaoBaixarPdfPersonalizado({
  nomeArquivo,
  nomeEmpresa,
  titulo,
  subtitulo,
  colunaChave,
  colunas,
  linhas,
}: {
  nomeArquivo: string;
  nomeEmpresa: string;
  titulo: string;
  subtitulo: string;
  colunaChave: string;
  colunas: ColunaPdf[];
  linhas: LinhaPdf[];
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <RelatorioPersonalizadoPdf
          nomeEmpresa={nomeEmpresa}
          titulo={titulo}
          subtitulo={subtitulo}
          colunaChave={colunaChave}
          colunas={colunas}
          linhas={linhas}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-secondary text-sm"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Exportar PDF")}
    </PDFDownloadLink>
  );
}
