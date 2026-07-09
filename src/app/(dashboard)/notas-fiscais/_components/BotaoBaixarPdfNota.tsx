"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { NotaFiscalPdf } from "./NotaFiscalPdf";

// Fase 27.94 — mesmo padrão de BotaoBaixarPdfFatura (Fase 27.76/27.92):
// @react-pdf/renderer só funciona no client, carregado via next/dynamic com
// ssr:false (ver BotaoBaixarPdfNotaLazy.tsx).
export function BotaoBaixarPdfNota({
  nomeArquivo,
  numeroNf,
  serieNf,
  chaveAcesso,
  dataEmissao,
  emitente,
  destinatario,
  produtoNome,
  produtoCodigoAnp,
  produtoDescricaoAnp,
  quantidade,
  valorUnitario,
  valorTotal,
  abastecimentoData,
  veiculoPlaca,
  motoristaNome,
}: {
  nomeArquivo: string;
  numeroNf: number;
  serieNf: string;
  chaveAcesso: string;
  dataEmissao: string;
  emitente: { nome: string; cnpj: string };
  destinatario: { nome: string; cnpj: string };
  produtoNome: string;
  produtoCodigoAnp: string;
  produtoDescricaoAnp: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  abastecimentoData: string;
  veiculoPlaca: string | null;
  motoristaNome: string | null;
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <NotaFiscalPdf
          numeroNf={numeroNf}
          serieNf={serieNf}
          chaveAcesso={chaveAcesso}
          dataEmissao={dataEmissao}
          emitente={emitente}
          destinatario={destinatario}
          produtoNome={produtoNome}
          produtoCodigoAnp={produtoCodigoAnp}
          produtoDescricaoAnp={produtoDescricaoAnp}
          quantidade={quantidade}
          valorUnitario={valorUnitario}
          valorTotal={valorTotal}
          abastecimentoData={abastecimentoData}
          veiculoPlaca={veiculoPlaca}
          motoristaNome={motoristaNome}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar NF-e (PDF)")}
    </PDFDownloadLink>
  );
}
