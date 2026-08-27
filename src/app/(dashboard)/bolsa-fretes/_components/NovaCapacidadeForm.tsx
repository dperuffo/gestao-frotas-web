"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarCapacidadeOciosaAcao } from "../actions";

// Fase Bolsa-Fretes-Grupo (27/08/2026) — formulário compacto (poucos campos,
// não justifica uma rota /nova separada como em outros módulos desta fase).
export function NovaCapacidadeForm({ empresaId }: { empresaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [pendente, iniciar] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    iniciar(async () => {
      const resultado = await criarCapacidadeOciosaAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-primary text-sm">
        + Declarar capacidade ociosa
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
      <div className="col-span-2 md:col-span-4">
        <h2 className="text-sm font-semibold text-slate-900">Declarar capacidade ociosa</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Visível pra outras empresas do seu Grupo Econômico, pra sugerir carga de volta.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Placa</label>
        <input name="placa" className="input text-sm" placeholder="ABC1D23" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de veículo</label>
        <input name="tipo_veiculo" className="input text-sm" placeholder="Ex.: Truck baú" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Cidade de origem *</label>
        <input name="origem_cidade" required className="input text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">UF *</label>
        <input name="origem_uf" required maxLength={2} className="input text-sm uppercase" placeholder="SP" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Destino pretendido</label>
        <input name="destino_pretendido" className="input text-sm" placeholder="Opcional" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Disponível a partir de *</label>
        <input
          type="date"
          name="disponivel_a_partir"
          required
          className="input text-sm"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Capacidade (kg)</label>
        <input type="number" name="capacidade_kg" min={0} className="input text-sm" />
      </div>
      <div className="col-span-2 md:col-span-4">
        <label className="mb-1 block text-xs font-medium text-slate-500">Observações</label>
        <input name="observacoes" className="input text-sm" />
      </div>
      {erro && <p className="col-span-2 text-xs text-red-600 md:col-span-4">{erro}</p>}
      <div className="col-span-2 flex gap-2 md:col-span-4">
        <button type="submit" disabled={pendente} className="btn-primary text-sm">
          {pendente ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
