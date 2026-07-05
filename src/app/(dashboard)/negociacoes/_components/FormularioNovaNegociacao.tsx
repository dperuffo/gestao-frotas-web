"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarNegociacaoAcao } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";

// Fase 27.50 — cria a rodada 1 de uma negociação. O mesmo formulário serve
// pro cliente (informa o CNPJ do posto-alvo) e pro posto (informa o CNPJ do
// cliente-alvo, caso ele prefira criar pela tela em vez de usar a API).
export function FormularioNovaNegociacao({ empresaAtualId, souPosto }: { empresaAtualId: string; souPosto: boolean }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await criarNegociacaoAcao(empresaAtualId, souPosto, undefined as never, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {souPosto ? "CNPJ do cliente" : "CNPJ do posto"}
        </label>
        <input
          type="text"
          name={souPosto ? "cliente_cnpj" : "posto_cnpj"}
          required
          className="input"
          placeholder="00.000.000/0000-00"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
          <select name="combustivel" required className="input" defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {PRODUTOS_POSTO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Volume mínimo mensal (L)</label>
          <input type="number" name="volume_minimo_mensal" required min="1" step="1" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Preço por litro (R$)</label>
          <input type="number" name="preco_unitario" required min="0.01" step="0.01" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vigência — início</label>
          <input type="date" name="vigencia_inicio" required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vigência — fim</label>
          <input type="date" name="vigencia_fim" required className="input" />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Enviando..." : "Enviar negociação"}
      </button>
    </form>
  );
}
