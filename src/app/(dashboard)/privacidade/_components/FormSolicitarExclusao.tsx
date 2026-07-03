"use client";

import { useRef, useState, useTransition } from "react";
import { solicitarExclusaoDados } from "../actions";

export function FormSolicitarExclusao({ empresas }: { empresas: { id: string; nome: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await solicitarExclusaoDados(undefined, formData);
      if (resultado?.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else if (resultado?.sucesso) {
        setMensagem({ tipo: "sucesso", texto: resultado.sucesso });
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      {empresas.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
          <select name="empresa_id" required className="input text-sm" defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      {empresas.length === 1 && <input type="hidden" name="empresa_id" value={empresas[0].id} />}
      <button type="submit" disabled={isPending || empresas.length === 0} className="btn-secondary text-sm disabled:opacity-50">
        {isPending ? "Enviando..." : "Solicitar exclusão dos meus dados"}
      </button>
      {mensagem && (
        <p className={`w-full text-xs ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>
      )}
    </form>
  );
}
