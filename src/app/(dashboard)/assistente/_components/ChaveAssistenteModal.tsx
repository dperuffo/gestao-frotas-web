"use client";

import { useState, useTransition } from "react";
import { KeyRound, X } from "lucide-react";
import { salvarChaveAssistenteAcao, removerChaveAssistenteAcao } from "../actions";

// Cadastro da chave de IA (Anthropic) da própria empresa: o consumo passa a ser dela
// e não usa a franquia do plano. A chave não volta ao navegador (só os 4 últimos dígitos).
export function ChaveAssistenteModal({
  empresaId,
  chavePropria,
  ultimos4,
}: {
  empresaId: string;
  chavePropria: boolean;
  ultimos4: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarChaveAssistenteAcao(empresaId, chave);
      if (r.ok) {
        setChave("");
        setAberto(false);
      } else setErro(r.erro);
    });
  }

  function remover() {
    setErro(null);
    startTransition(async () => {
      const r = await removerChaveAssistenteAcao(empresaId);
      if (r.ok) setAberto(false);
      else setErro(r.erro);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary inline-flex items-center gap-1 text-sm">
        <KeyRound className="h-4 w-4" aria-hidden />
        {chavePropria ? `Chave própria ativa (…${ultimos4 ?? ""})` : "Usar minha chave de IA"}
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setAberto(false)}>
          <div role="dialog" aria-label="Chave de IA da empresa" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Chave de IA da sua empresa</h2>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Com a sua própria chave da Anthropic, o consumo do Assistente é cobrado direto na sua conta da Anthropic e
              <strong> não usa a franquia do plano</strong>. A chave fica guardada criptografada e nunca é exibida de novo.
              Crie uma chave no console da Anthropic e cole abaixo.
            </p>
            {chavePropria && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700">
                Chave atual terminada em <code>…{ultimos4}</code>. Cole outra para substituir ou remova para voltar à franquia do plano.
              </p>
            )}
            <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="chave-ia">
              Chave da Anthropic
            </label>
            <input
              id="chave-ia"
              type="password"
              autoComplete="off"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="sk-ant-…"
              className="input mt-1"
            />
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {chavePropria && (
                <button type="button" onClick={remover} disabled={pending} className="btn-secondary text-red-700">
                  Remover chave
                </button>
              )}
              <button type="button" onClick={salvar} disabled={pending || !chave.trim()} className="btn-primary">
                {pending ? "Validando…" : "Validar e salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
