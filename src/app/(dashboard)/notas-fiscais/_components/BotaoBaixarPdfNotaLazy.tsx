"use client";

import dynamic from "next/dynamic";

const BotaoBaixarPdfNota = dynamic(() => import("./BotaoBaixarPdfNota").then((m) => m.BotaoBaixarPdfNota), {
  ssr: false,
  loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span>,
});

export default function BotaoBaixarPdfNotaLazy(props: {
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
  return <BotaoBaixarPdfNota {...props} />;
}
