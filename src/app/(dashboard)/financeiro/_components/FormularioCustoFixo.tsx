"use client";

import { useState, useTransition, type FormEvent } from "react";
import { salvarCustoFixoAcao } from "../actions";
import { TIPOS_CUSTO_FIXO, TIPO_CUSTO_FIXO_LABEL } from "@/lib/financeiro";

export function FormularioCustoFixo({
  empresaId,
  centrosCusto,
}: {
  empresaId: string;
  centrosCusto: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await salvarCustoFixoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(resultado?.sucesso);
        (document.getElementById("form-custo-fixo") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="form-custo-fixo" onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="empresa_id" value={empresaId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" required className="input" defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {TIPOS_CUSTO_FIXO.map((t) => (
              <option key={t} value={t}>
                {TIPO_CUSTO_FIXO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
          <input type="number" name="valor" step="0.01" min={0} required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Competência</label>
          <input type="date" name="competencia" required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Placa (opcional)</label>
          <input type="text" name="placa" className="input" placeholder="ABC1D23" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Centro de custo (opcional)</label>
          <select name="centro_custo_id" className="input" defaultValue="">
            <option value="">Nenhum</option>
            {centrosCusto.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição (opcional)</label>
          <input type="text" name="descricao" className="input" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="recorrente" className="accent-frota-500" />
        Custo recorrente (se repete todo mês)
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Lançar custo fixo"}
      </button>
    </form>
  );
}
