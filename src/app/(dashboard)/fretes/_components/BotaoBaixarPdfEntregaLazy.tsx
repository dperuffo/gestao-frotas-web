"use client";

import dynamic from "next/dynamic";

const BotaoBaixarPdfEntrega = dynamic(() => import("./BotaoBaixarPdfEntrega").then((m) => m.BotaoBaixarPdfEntrega), {
  ssr: false,
  loading: () => <span className="btn-primary inline-block text-xs opacity-60">Carregando...</span>,
});

export default function BotaoBaixarPdfEntregaLazy(props: {
  nomeArquivo: string;
  freteTitulo: string;
  origemLabel: string;
  destinoLabel: string;
  nomeRecebedor: string;
  documentoRecebedor: string | null;
  dataConfirmacao: string;
  fotoCanhotoUrl: string | null;
  assinaturaUrl: string | null;
}) {
  return <BotaoBaixarPdfEntrega {...props} />;
}
