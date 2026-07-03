"use client";

import { useState, useTransition, type FormEvent } from "react";
import { registrarManutencaoAcao } from "../actions";
import { ITENS_MANUTENCAO } from "@/lib/manutencaoPreditiva";

export function RegistrarManutencaoForm({
  empresaId,
  placa,
  kmAtual,
}: {
  empresaId: string;
  placa: string;
  kmAtual: number;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await registrarManutencaoAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Manutenção registrada com sucesso.
        </div>
      )}
      <input type="hidden" name="placa" value={placa} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="data_manutencao"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hodômetro (km)</label>
          <input type="number" name="hodometro" min={0} defaultValue={kmAtual > 0 ? Math.round(kmAtual) : ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Custo total (R$)</label>
          <input type="number" name="custo_total" min={0} step="0.01" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Técnico</label>
          <input name="tecnico" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Oficina</label>
          <input name="oficina" className="input" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Itens realizados <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ITENS_MANUTENCAO.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="itens_realizados" value={item} className="h-4 w-4 rounded border-slate-300" />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="obs_gerais" rows={3} className="input" placeholder="Condições, peças substituídas, pendências..." />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Registrando..." : "Registrar Manutenção"}
        </button>
      </div>
    </form>
  );
}
