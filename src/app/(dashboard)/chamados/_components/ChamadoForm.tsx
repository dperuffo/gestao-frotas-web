"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarChamadoAcao } from "../actions";
import { PRIORIDADES_TICKET, TIPOS_TICKET } from "@/lib/chamados";
import type { EmpresaOpcao } from "@/lib/empresaAtual";

export function ChamadoForm({
  empresas,
  empresaSelecionadaInicial,
}: {
  empresas: EmpresaOpcao[];
  empresaSelecionadaInicial: string | null;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarChamadoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="max-w-lg rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <section className="card max-w-lg space-y-4 p-6">
        {empresas.length > 1 ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select name="empresa_id" required defaultValue={empresaSelecionadaInicial ?? ""} className="input">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="empresa_id" value={empresas[0]?.id ?? ""} />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {TIPOS_TICKET.map((t) => (
              <label key={t.valor} className="flex items-center gap-1.5 text-sm">
                <input type="radio" name="tipo" value={t.valor} required defaultChecked={t.valor === "incidente"} />
                {t.icone} {t.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Título <span className="text-red-500">*</span>
          </label>
          <input name="titulo" required maxLength={150} className="input" placeholder="Resuma o problema/sugestão em poucas palavras" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Descrição <span className="text-red-500">*</span>
          </label>
          <textarea name="descricao" required rows={5} className="input" placeholder="Descreva com o máximo de detalhes possível" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prioridade</label>
          <select name="prioridade" defaultValue="media" className="input">
            {PRIORIDADES_TICKET.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Anexo (opcional)</label>
          <input type="file" name="arquivo" className="input" />
        </div>
      </section>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Enviando..." : "Abrir Chamado"}
        </button>
      </div>
    </form>
  );
}
