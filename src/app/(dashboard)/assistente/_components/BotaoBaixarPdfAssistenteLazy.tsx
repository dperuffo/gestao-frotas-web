"use client";

import dynamic from "next/dynamic";
import type { MensagemPdf } from "./AssistentePdf";

const BotaoBaixarPdfAssistente = dynamic(
  () => import("./BotaoBaixarPdfAssistente").then((m) => m.BotaoBaixarPdfAssistente),
  {
    ssr: false,
    loading: () => <span className="btn-secondary inline-block text-sm opacity-60">Carregando...</span>,
  }
);

export default function BotaoBaixarPdfAssistenteLazy(props: { mensagens: MensagemPdf[]; usuarioEmail?: string }) {
  return <BotaoBaixarPdfAssistente {...props} />;
}
