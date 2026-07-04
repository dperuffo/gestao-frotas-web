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
  fonteLabel,
  dimensaoLabel,
  metricasLabels,
  nomeUsuario,
  cargoUsuario,
  colunaChave,
  colunas,
  linhas,
}: {
  nomeArquivo: string;
  nomeEmpresa: string;
  titulo: string;
  subtitulo: string;
  fonteLabel: string;
  dimensaoLabel: string;
  metricasLabels: string[];
  nomeUsuario: string;
  cargoUsuario: string | null;
  colunaChave: string;
  colunas: ColunaPdf[];
  linhas: LinhaPdf[];
}) {
  // Fase 27.32 — achado real: o PDF só trazia "Gerado em {data}" no rodapé,
  // sem dizer QUEM emitiu nem exatamente quais dimensão/métricas foram
  // usadas (o campo `titulo`, que já continha isso, nem era exibido). Agora
  // o cabeçalho traz usuário + cargo + data/hora de emissão, e a dimensão e
  // as métricas usadas explicitamente — importante pra um relatório que
  // pode circular fora da plataforma (impresso, anexado a e-mail etc.) sem
  // perder o contexto de quem gerou e como.
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <RelatorioPersonalizadoPdf
          nomeEmpresa={nomeEmpresa}
          titulo={titulo}
          subtitulo={subtitulo}
          fonteLabel={fonteLabel}
          dimensaoLabel={dimensaoLabel}
          metricasLabels={metricasLabels}
          nomeUsuario={nomeUsuario}
          cargoUsuario={cargoUsuario}
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
