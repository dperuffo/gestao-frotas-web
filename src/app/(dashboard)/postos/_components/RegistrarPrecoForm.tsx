"use client";

import { useRef, useState, useTransition } from "react";
import { registrarPreco } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";

export function RegistrarPrecoForm({ cnpj, empresaId }: { cnpj: string; empresaId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const hoje = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await registrarPreco(cnpj, empresaId, undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Combustível</label>
        <select name="combustivel" required defaultValue="" className="input">
          <option value="" disabled>
            Selecione...
          </option>
          {PRODUTOS_POSTO.map((produto) => (
            <option key={produto} value={produto}>
              {produto}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Preço (R$/L)</label>
        <input type="number" name="preco" step="0.001" required className="input w-32" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Data</label>
        <input type="date" name="data_ref" defaultValue={hoje} className="input" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Registrar preço"}
      </button>
    </form>
  );
}
