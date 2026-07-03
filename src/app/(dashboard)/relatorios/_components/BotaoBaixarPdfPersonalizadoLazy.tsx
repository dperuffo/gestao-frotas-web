"use client";

import dynamic from "next/dynamic";
import type { ColunaPdf, LinhaPdf } from "./RelatorioPersonalizadoPdf";

const BotaoBaixarPdfPersonalizado = dynamic(
  () => import("./BotaoBaixarPdfPersonalizado").then((m) => m.BotaoBaixarPdfPersonalizado),
  { ssr: false, loading: () => <span className="btn-secondary text-sm opacity-60">Carregando...</span> }
);

export default function BotaoBaixarPdfPersonalizadoLazy(props: {
  nomeArquivo: string;
  nomeEmpresa: string;
  titulo: string;
  subtitulo: string;
  colunaChave: string;
  colunas: ColunaPdf[];
  linhas: LinhaPdf[];
}) {
  return <BotaoBaixarPdfPersonalizado {...props} />;
}
