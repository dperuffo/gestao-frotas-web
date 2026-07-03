"use client";

import dynamic from "next/dynamic";
import type { RotogramaParada, RotogramaRisco } from "../tipos";

const BotaoBaixarPdfRotograma = dynamic(
  () => import("./BotaoBaixarPdfRotograma").then((m) => m.BotaoBaixarPdfRotograma),
  {
    ssr: false,
    loading: () => <span className="btn-primary inline-block opacity-60">Carregando...</span>,
  }
);

export default function BotaoBaixarPdfRotogramaLazy(props: {
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
  return <BotaoBaixarPdfRotograma {...props} />;
}
