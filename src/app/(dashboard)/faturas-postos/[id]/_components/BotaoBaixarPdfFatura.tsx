"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { FaturaPdf, type ItemExtratoFaturaPdf } from "./FaturaPdf";

// @react-pdf/renderer só funciona no client — carregado via next/dynamic
// com ssr:false (ver BotaoBaixarPdfFaturaLazy.tsx), mesmo padrão já usado em
// Rotograma/Roteirização/Relatórios/Assistente.
export function BotaoBaixarPdfFatura({
  nomeArquivo,
  postoNome,
  clienteNome,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  volumeTotal,
  quantidadeAbastecimentos,
  itens,
}: {
  nomeArquivo: string;
  postoNome: string;
  clienteNome: string;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  volumeTotal: number;
  quantidadeAbastecimentos: number;
  itens: ItemExtratoFaturaPdf[];
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <FaturaPdf
          postoNome={postoNome}
          clienteNome={clienteNome}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          vencimento={vencimento}
          status={status}
          valorTotal={valorTotal}
          volumeTotal={volumeTotal}
          quantidadeAbastecimentos={quantidadeAbastecimentos}
          itens={itens}
          geradoEm={geradoEm}
        />
      }
      fileName={nomeArquivo}
      className="btn-primary inline-block"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar PDF")}
    </PDFDownloadLink>
  );
}
