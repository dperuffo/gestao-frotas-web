"use client";

import { useState, useTransition } from "react";
import { adicionarSocioAcao, removerSocioAcao } from "../actions";
import { SlotDocumento } from "./SlotDocumento";
import { TIPOS_DOCUMENTO_SOCIO, LABEL_TIPO_DOCUMENTO, type Socio, type DocumentoEmpresa } from "@/lib/empresasDocumentos";

// Fase 27.149 — lista dinâmica de sócios (o usuário adiciona quantos
// quiser, refletindo o quadro societário do Contrato Social), cada um com
// seus 3 documentos pessoais (CPF, RG/CNH, comprovante de endereço).
export function SecaoSocios({
  empresaId,
  socios,
  documentosPorSocio,
  urlsPorDocumento,
}: {
  empresaId: string;
  socios: Socio[];
  documentosPorSocio: Map<string, DocumentoEmpresa[]>;
  urlsPorDocumento: Map<string, string | null>;
}) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function adicionar() {
    setErro(null);
    startTransition(async () => {
      try {
        await adicionarSocioAcao(empresaId, nome, cpf);
        setNome("");
        setCpf("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao adicionar sócio.");
      }
    });
  }

  function remover(socioId: string) {
    setErro(null);
    startTransition(async () => {
      try {
        await removerSocioAcao(socioId);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover sócio.");
      }
    });
  }

  return (
    <div className="card mt-6 p-6">
      <h2 className="text-sm font-semibold text-slate-900">Sócios</h2>
      <p className="mt-1 text-xs text-slate-500">
        Cadastre cada sócio do quadro societário — cada um precisa enviar CPF, RG ou CNH, e comprovante de
        endereço pessoal atualizado.
      </p>

      <div className="mt-4 space-y-4">
        {socios.map((s) => {
          const docs = documentosPorSocio.get(s.id) ?? [];
          return (
            <div key={s.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                  <p className="text-xs text-slate-500">CPF: {s.cpf}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remover(s.id)}
                  disabled={isPending}
                  className="shrink-0 text-xs text-red-600 hover:underline"
                >
                  Remover sócio
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {TIPOS_DOCUMENTO_SOCIO.map((tipo) => {
                  const doc = docs.find((d) => d.tipo === tipo) ?? null;
                  return (
                    <SlotDocumento
                      key={tipo}
                      empresaId={empresaId}
                      tipo={tipo}
                      socioId={s.id}
                      label={LABEL_TIPO_DOCUMENTO[tipo]}
                      documento={doc ? { id: doc.id, nomeArquivo: doc.nomeArquivo, url: urlsPorDocumento.get(doc.id) ?? null } : null}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {socios.length === 0 && <p className="text-sm text-slate-400">Nenhum sócio cadastrado ainda.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome do sócio</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">CPF</label>
          <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Só números" className="input" />
        </div>
        <button
          type="button"
          onClick={adicionar}
          disabled={isPending || !nome.trim() || !cpf.trim()}
          className="btn-secondary"
        >
          + Adicionar sócio
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
