"use client";

import { useRef, useState, useTransition } from "react";
import { enviarDocumentoAcao, removerDocumentoAcao } from "../actions";
import type { TipoDocumento } from "@/lib/empresasDocumentos";

type DocumentoAtual = { id: string; nomeArquivo: string; url: string | null };

// Fase 27.149 — um "slot" de upload por tipo de documento (Contrato Social,
// comprovante de endereço, ou um dos 3 documentos de um sócio). Envio
// substitui o anterior do mesmo tipo (mesmo path no Storage, ver
// enviarDocumento em src/lib/empresasDocumentos.ts) — não precisa de botão
// "trocar" separado, só escolher outro arquivo já reenvia.
export function SlotDocumento({
  empresaId,
  tipo,
  socioId,
  label,
  documento,
}: {
  empresaId: string;
  tipo: TipoDocumento;
  socioId: string | null;
  label: string;
  documento: DocumentoAtual | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;
    setErro(null);
    const fd = new FormData();
    fd.set("empresa_id", empresaId);
    fd.set("tipo", tipo);
    if (socioId) fd.set("socio_id", socioId);
    fd.set("arquivo", arquivo);
    startTransition(async () => {
      const resultado = await enviarDocumentoAcao(fd);
      if (resultado.erro) setErro(resultado.erro);
      else if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remover() {
    if (!documento) return;
    setErro(null);
    startTransition(async () => {
      try {
        await removerDocumentoAcao(documento.id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {documento ? (
          <p className="truncate text-xs text-slate-500">
            {documento.url ? (
              <a href={documento.url} target="_blank" rel="noreferrer" className="text-frota-600 hover:underline">
                {documento.nomeArquivo}
              </a>
            ) : (
              documento.nomeArquivo
            )}
          </p>
        ) : (
          <p className="text-xs text-amber-600">Não enviado</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          onChange={enviar}
          disabled={isPending}
          accept=".pdf,.jpg,.jpeg,.png"
          className="text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
        />
        {documento && (
          <button type="button" onClick={remover} disabled={isPending} className="text-xs text-red-600 hover:underline">
            Remover
          </button>
        )}
      </div>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </div>
  );
}
