"use client";

import { useState, useTransition } from "react";
import { vincularEmpresa, desvincularEmpresa } from "../actions";

type EmpresaOpcao = { id: string; nome: string };
type Vinculo = { id: string; empresa: EmpresaOpcao | null };

export function VincularEmpresaForm({
  grupoId,
  empresasDisponiveis,
  vinculos,
}: {
  grupoId: string;
  empresasDisponiveis: EmpresaOpcao[];
  vinculos: Vinculo[];
}) {
  const [empresaId, setEmpresaId] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!empresaId) return;
    setErro(undefined);
    startTransition(async () => {
      try {
        await vincularEmpresa(grupoId, empresaId);
        setEmpresaId("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao vincular empresa.");
      }
    });
  }

  function handleRemove(vinculoId: string) {
    startTransition(async () => {
      try {
        await desvincularEmpresa(grupoId, vinculoId);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover vínculo.");
      }
    });
  }

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Clientes vinculados a este grupo</h2>
      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="mb-4 flex gap-2">
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input">
          <option value="">Selecione um cliente para vincular...</option>
          {empresasDisponiveis.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !empresaId}
          className="btn-secondary whitespace-nowrap"
        >
          Vincular
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {vinculos.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-2 text-sm">
            <span>{v.empresa?.nome ?? "(cliente removido)"}</span>
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
        {vinculos.length === 0 && <li className="py-4 text-center text-sm text-slate-400">Nenhum cliente vinculado ainda.</li>}
      </ul>
    </div>
  );
}
