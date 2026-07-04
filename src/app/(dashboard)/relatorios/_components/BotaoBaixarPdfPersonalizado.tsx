"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { RelatorioPersonalizadoPdf, type ColunaPdf, type LinhaPdf } from "./RelatorioPersonalizadoPdf";

// Mesmo padrão de BotaoBaixarPdfExecutivo — @react-pdf/renderer só funciona
// no client (Canvas/Blob do navegador), por isso este componente é sempre
// carregado via next/dynamic com ssr:false (ver BotaoBaixarPdfPersonalizadoLazy.tsx).
//
// Fase 27.33 — achado real: pra incluir o gráfico no PDF (pedido do
// Daniel), a imagem precisa ser capturada do gráfico já desenhado na tela
// (ver capturarGrafico, implementado em RelatoriosPersonalizados.tsx) — uma
// operação assíncrona. O `PDFDownloadLink` (usado até aqui) monta o
// documento de forma síncrona a cada render, então não dava pra esperar
// essa captura antes de gerar o PDF. Trocado por um botão comum: ao
// clicar, primeiro captura o gráfico, monta o documento já com a imagem, e
// gera o arquivo manualmente via `pdf(...).toBlob()` + download por link
// temporário (mesmo truque já usado pro CSV).
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
  capturarGrafico,
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
  capturarGrafico: () => Promise<string | null>;
  colunaChave: string;
  colunas: ColunaPdf[];
  linhas: LinhaPdf[];
}) {
  const [gerando, setGerando] = useState(false);

  async function baixarPdf() {
    setGerando(true);
    try {
      const imagemGraficoUrl = await capturarGrafico();
      // Fase 27.32 — cabeçalho com usuário/cargo/data-hora de emissão.
      const geradoEm = new Date().toLocaleString("pt-BR");
      const blob = await pdf(
        <RelatorioPersonalizadoPdf
          nomeEmpresa={nomeEmpresa}
          titulo={titulo}
          subtitulo={subtitulo}
          fonteLabel={fonteLabel}
          dimensaoLabel={dimensaoLabel}
          metricasLabels={metricasLabels}
          nomeUsuario={nomeUsuario}
          cargoUsuario={cargoUsuario}
          imagemGraficoUrl={imagemGraficoUrl}
          colunaChave={colunaChave}
          colunas={colunas}
          linhas={linhas}
          geradoEm={geradoEm}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[BotaoBaixarPdfPersonalizado] falha ao gerar PDF:", e);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button type="button" onClick={baixarPdf} disabled={gerando} className="btn-secondary text-sm">
      {gerando ? "Gerando PDF..." : "📄 Exportar PDF"}
    </button>
  );
}
