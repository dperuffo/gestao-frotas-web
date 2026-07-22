"use client";

import { useState, useTransition, type FormEvent } from "react";
import { gerarFaturaFreteAcao } from "../actions";

export type TomadorPendente = {
  tomadorCnpj: string;
  tomadorNome: string | null;
  quantidade: number;
  valorTotal: number;
  dataMin: string;
  dataMax: string;
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ListaTomadoresPendentes({ empresaId, tomadores }: { empresaId: string; tomadores: TomadorPendente[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (tomadores.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        Nenhum CT-e autorizado pendente de faturamento no momento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tomadores.map((t) => (
        <div key={t.tomadorCnpj} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{t.tomadorNome ?? "Tomador sem nome cadastrado"}</h3>
              <p className="text-xs text-slate-500">{t.tomadorCnpj}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">{t.quantidade} CT-e(s)</span>
              <span className="font-semibold text-slate-900">{formatoMoeda.format(t.valorTotal)}</span>
              <button
                type="button"
                onClick={() => setExpandido(expandido === t.tomadorCnpj ? null : t.tomadorCnpj)}
                className="btn-primary text-xs"
              >
                {expandido === t.tomadorCnpj ? "Fechar" : "Gerar fatura"}
              </button>
            </div>
          </div>

          {expandido === t.tomadorCnpj && (
            <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
              <FormGerarFatura empresaId={empresaId} tomador={t} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FormGerarFatura({ empresaId, tomador }: { empresaId: string; tomador: TomadorPendente }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await gerarFaturaFreteAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <input type="hidden" name="tomador_cnpj" value={tomador.tomadorCnpj} />
      <input type="hidden" name="tomador_nome" value={tomador.tomadorNome ?? ""} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Período — início</label>
          <input type="date" name="periodo_inicio" required defaultValue={tomador.dataMin} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Período — fim</label>
          <input type="date" name="periodo_fim" required defaultValue={tomador.dataMax} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Vencimento</label>
          <input type="date" name="vencimento" required className="input text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Observações</label>
        <textarea name="observacoes" rows={2} className="input text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
        {isPending ? "Gerando..." : "Confirmar geração da fatura"}
      </button>
    </form>
  );
}
