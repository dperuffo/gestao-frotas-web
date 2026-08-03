"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarAjusteAcao } from "../../actions";

const TIPOS = [
  { valor: "reavaliacao", label: "Reavaliação (ajuste do valor contábil)" },
  { valor: "melhoria", label: "Melhoria (capitalização — aumenta a base depreciável)" },
  { valor: "baixa", label: "Baixa (venda / perda total / sinistro)" },
];

export function FormularioAjuste({ veiculoId, placa, empresaId }: { veiculoId: string; placa: string; empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const resultado = await criarAjusteAcao(veiculoId, placa, empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-4">
      {erro && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" required defaultValue="" className="input text-sm">
            <option value="" disabled>
              Selecione...
            </option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
          <input name="valor" type="number" step="0.01" required className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Data</label>
          <input name="data_ajuste" type="date" required className="input text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Motivo (opcional)</label>
        <textarea name="motivo" rows={2} className="input text-sm" placeholder="Ex.: instalação de baú refrigerado, venda para terceiro, sinistro com perda total..." />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
        {isPending ? "Registrando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
