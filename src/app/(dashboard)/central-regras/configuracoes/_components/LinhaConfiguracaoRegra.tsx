"use client";

import { useState, useTransition } from "react";
import { salvarConfiguracaoRegraAcao, restaurarConfiguracaoRegraPadraoAcao } from "../actions";
import type { DefinicaoRegraConfiguravel } from "@/lib/regrasConfiguraveis";

export function LinhaConfiguracaoRegra({
  empresaId,
  definicao,
  valorAtual,
  personalizado,
}: {
  empresaId: string;
  definicao: DefinicaoRegraConfiguravel;
  valorAtual: number;
  personalizado: boolean;
}) {
  const [valor, setValor] = useState(String(valorAtual));
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | undefined>();
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    setErro(undefined);
    setSalvo(false);
    const numero = Number(valor.replace(",", "."));
    if (!Number.isFinite(numero) || numero < definicao.min) {
      setErro(`Valor mínimo: ${definicao.min}`);
      return;
    }
    iniciar(async () => {
      const resultado = await salvarConfiguracaoRegraAcao(empresaId, definicao.chave, numero);
      if (resultado?.erro) setErro(resultado.erro);
      else setSalvo(true);
    });
  }

  function restaurarPadrao() {
    setErro(undefined);
    setSalvo(false);
    iniciar(async () => {
      const resultado = await restaurarConfiguracaoRegraPadraoAcao(empresaId, definicao.chave);
      if (resultado?.erro) setErro(resultado.erro);
      else setValor(String(definicao.padrao));
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{definicao.label}</p>
          {personalizado && <span className="badge-atencao">Personalizado</span>}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{definicao.ajuda}</p>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
        {salvo && !erro && <p className="mt-1 text-xs text-status-ativo">Salvo.</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="input w-24 text-sm"
        />
        <button type="button" disabled={pendente} onClick={salvar} className="btn-secondary text-xs">
          Salvar
        </button>
        {personalizado && (
          <button
            type="button"
            disabled={pendente}
            onClick={restaurarPadrao}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Padrão ({definicao.padrao})
          </button>
        )}
      </div>
    </div>
  );
}
