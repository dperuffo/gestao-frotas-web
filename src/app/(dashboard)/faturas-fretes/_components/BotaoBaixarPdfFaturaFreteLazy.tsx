"use client";

import dynamic from "next/dynamic";
import type { ItemFaturaFretePdf, ParteFaturaFretePdf } from "./FaturaFretePdf";

const BotaoBaixarPdfFaturaFrete = dynamic(
  () => import("./BotaoBaixarPdfFaturaFrete").then((m) => m.BotaoBaixarPdfFaturaFrete),
  {
    ssr: false,
    loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span>,
  }
);

export default function BotaoBaixarPdfFaturaFreteLazy(props: {
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
  return <BotaoBaixarPdfFaturaFrete {...props} />;
}
