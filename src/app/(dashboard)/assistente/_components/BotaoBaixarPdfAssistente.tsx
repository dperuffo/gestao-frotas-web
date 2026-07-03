"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { AssistentePdf, type MensagemPdf } from "./AssistentePdf";

// @react-pdf/renderer só funciona no client — carregado via next/dynamic
// com ssr:false (ver BotaoBaixarPdfAssistenteLazy.tsx), mesmo padrão do
// Rotograma e dos Relatórios.
export function BotaoBaixarPdfAssistente({
  mensagens,
  usuarioEmail,
}: {
  mensagens: MensagemPdf[];
  usuarioEmail?: string;
}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <PDFDownloadLink
      document={<AssistentePdf mensagens={mensagens} geradoEm={geradoEm} usuarioEmail={usuarioEmail} />}
      fileName={`assistente-fni-conversa-${Date.now()}.pdf`}
      className="btn-secondary inline-block text-sm"
    >
      {({ loading }) => (loading ? "Gerando PDF..." : "📄 Baixar conversa em PDF")}
    </PDFDownloadLink>
  );
}
