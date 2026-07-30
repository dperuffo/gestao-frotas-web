"use client";

import { useState, useTransition, type FormEvent } from "react";
import { registrarInspecaoAcao } from "../actions";
import { ITENS_INSPECAO, ITENS_CRITICOS } from "@/lib/checklist";

export function RegistrarInspecaoForm({
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
      const resultado = await registrarInspecaoAcao(empresaId, undefined, formData);
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
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Inspeção registrada com sucesso.</div>
      )}
      <input type="hidden" name="placa" value={placa} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data <span className="text-red-500">*</span>
          </label>
          <input type="date" name="data_inspecao" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hodômetro (km)</label>
          <input type="number" name="hodometro" min={0} defaultValue={kmAtual > 0 ? Math.round(kmAtual) : ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Responsável</label>
          <input name="responsavel" className="input" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Itens verificados</label>
        <div className="space-y-2">
          {ITENS_INSPECAO.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {item}
                  {ITENS_CRITICOS.includes(item) && (
                    <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      crítico
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name={`item_${item}`} value="conforme" defaultChecked className="h-3.5 w-3.5" />
                    Conforme
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name={`item_${item}`} value="nao_conforme" className="h-3.5 w-3.5" />
                    Não conforme
                  </label>
                </div>
              </div>
              <input
                name={`obs_${item}`}
                placeholder="Observação (opcional)"
                className="input mt-2 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Registrando..." : "Registrar Inspeção"}
        </button>
      </div>
    </form>
  );
}
