"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { RotogramaPdf } from "./RotogramaPdf";
import type { RotogramaParada, RotogramaRisco } from "../tipos";

// @react-pdf/renderer só funciona no client — carregado via next/dynamic
// com ssr:false (ver BotaoBaixarPdfRotogramaLazy.tsx), mesmo padrão das
// Fases 15/16.
export function BotaoBaixarPdfRotograma({
  nomeArquivo,
  origem,
  destino,
  motorista,
  placa,
  dataViagem,
  numero,
  riscos,
  paradas,
}: {
  nomeArquivo: string;
  origem: string;
  destino: string;
  motorista?: string;
  placa?: string;
  dataViagem?: string;
  numero: number;
  riscos: RotogramaRisco[];
  paradas: RotogramaParada[];
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={
        <RotogramaPdf
          origem={origem}
          destino={destino}
          motorista={motorista}
          placa={placa}
          dataViagem={dataViagem}
          numero={numero}
          riscos={riscos}
          paradas={paradas}
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
