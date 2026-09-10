"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { renderMarkdownSimples } from "@/lib/markdownSimples";
import { urlImagemAviso } from "@/lib/avisos/imagemAviso";
import { formatarDataHoraBr } from "@/lib/utils";
import type { AvisoParaUsuario } from "../administracao/central-avisos/actions";

const TIPO_ICONE: Record<AvisoParaUsuario["tipo"], string> = {
  novidade: "🆕",
  correcao: "🐛",
  manutencao: "🔧",
  aviso_geral: "📣",
};

const URGENCIA_BORDA: Record<AvisoParaUsuario["urgencia"], string> = {
  informativo: "border-slate-200",
  atencao: "border-amber-300",
  critico: "border-red-400",
};

// Fase Central-Avisos (28/07/2026) — painel lateral aberto pelo sino
// (AvisosSino, no rodapé do <aside>). Marca todo aviso visível como lido
// assim que o drawer abre (guardado servidor-side em comunicados_leituras,
// não localStorage — funciona entre desktop e celular).
export function AvisosDrawer({
  aberto,
  onFechar,
  avisos,
  onMarcarLido,
}: {
  aberto: boolean;
  onFechar: () => void;
  avisos: AvisoParaUsuario[];
  onMarcarLido: (id: string) => void;
}) {
  useEffect(() => {
    if (!aberto) return;
    avisos.forEach((a) => {
      if (!a.lido) onMarcarLido(a.id);
    });
    // Só quando o drawer abre — não a cada mudança em `avisos`/`onMarcarLido`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Fase Pente-Fino-Performance (10/09/2026) — achado real do Daniel: o
  // painel de Avisos aparecia encolhido dentro do menu lateral (largura de
  // ~280px) em vez de cobrir a tela inteira. Causa: o <aside> do menu
  // (PainelMobile.tsx) tem `transition-[transform]` pra animar a gaveta
  // mobile — qualquer ancestral com `transform` vira a referência de
  // posicionamento pros filhos `fixed`, então o `fixed inset-0` deste
  // painel passava a valer só dentro do <aside>, não da tela toda. Portal
  // pro <body> resolve renderizando fora dessa hierarquia, sem mudar nada
  // do visual/comportamento pretendido (overlay escuro + painel à direita).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!aberto || !montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Avisos</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {avisos.length === 0 && <p className="text-sm text-slate-400">Nenhum aviso no momento.</p>}
          {avisos.map((a) => {
            const urlImagem = urlImagemAviso(a.imagem_path);
            return (
              <details key={a.id} className={`rounded-lg border p-3 ${URGENCIA_BORDA[a.urgencia]}`}>
                <summary className="cursor-pointer text-sm font-medium text-slate-900">
                  <span className="mr-1">{TIPO_ICONE[a.tipo]}</span>
                  {a.titulo}
                  {!a.lido && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-frota-500 align-middle" />}
                </summary>
                <p className="mt-1 text-xs text-slate-400">{formatarDataHoraBr(a.data_publicacao)}</p>
                <p className="mt-2 text-sm text-slate-600">{a.resumo}</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">{renderMarkdownSimples(a.corpo)}</div>
                {urlImagem && (
                  <Image
                    src={urlImagem}
                    alt=""
                    width={0}
                    height={0}
                    sizes="400px"
                    className="mt-2 max-h-48 w-auto rounded-lg border border-slate-200"
                    style={{ width: "auto", height: "auto" }}
                  />
                )}
              </details>
            );
          })}
        </div>
        <div className="border-t border-slate-100 px-5 py-3">
          <Link href="/central-avisos" onClick={onFechar} className="text-xs font-medium text-frota-600 hover:underline">
            Ver histórico completo
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
