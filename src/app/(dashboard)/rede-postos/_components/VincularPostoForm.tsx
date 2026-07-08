"use client";

import { useState, useTransition } from "react";
import { vincularPosto, desvincularPosto } from "../actions";

type PostoOpcao = { id: string; nome: string };
type Vinculo = { id: string; empresa: PostoOpcao | null };

// Fase 27.87 — espelha /grupo-economico/_components/VincularEmpresaForm.tsx.
export function VincularPostoForm({
  redeId,
  postosDisponiveis,
  vinculos,
}: {
  redeId: string;
  postosDisponiveis: PostoOpcao[];
  vinculos: Vinculo[];
}) {
  const [postoId, setPostoId] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!postoId) return;
    setErro(undefined);
    startTransition(async () => {
      try {
        await vincularPosto(redeId, postoId);
        setPostoId("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao vincular posto.");
      }
    });
  }

  function handleRemove(vinculoId: string) {
    startTransition(async () => {
      try {
        await desvincularPosto(redeId, vinculoId);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover vínculo.");
      }
    });
  }

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Postos vinculados a esta Rede</h2>
      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="mb-4 flex gap-2">
        <select value={postoId} onChange={(e) => setPostoId(e.target.value)} className="input">
          <option value="">Selecione um posto para vincular...</option>
          {postosDisponiveis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !postoId}
          className="btn-secondary whitespace-nowrap"
        >
          Vincular
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {vinculos.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-2 text-sm">
            <span>{v.empresa?.nome ?? "(posto removido)"}</span>
            <button
              type="button"
              onClick={() => handleRemove(v.id)}
              disabled={isPending}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Remover
            </button>
          </li>
        ))}
        {vinculos.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">Nenhum posto vinculado ainda.</li>
        )}
      </ul>
    </div>
  );
}
