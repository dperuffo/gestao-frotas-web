"use client";

import dynamic from "next/dynamic";
import type { ItemExtratoFaturaPdf, ParteBoletoPdf } from "./FaturaPdf";

const BotaoBaixarPdfFatura = dynamic(
  () => import("./BotaoBaixarPdfFatura").then((m) => m.BotaoBaixarPdfFatura),
  {
    ssr: false,
    loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span>,
  }
);

export default function BotaoBaixarPdfFaturaLazy(props: {
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
  return <BotaoBaixarPdfFatura {...props} />;
}
