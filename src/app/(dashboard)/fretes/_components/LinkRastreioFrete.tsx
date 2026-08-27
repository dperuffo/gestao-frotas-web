"use client";

import { useState, useTransition } from "react";
import { gerarLinkRastreioAcao, revogarLinkRastreioAcao } from "../actions";
import { Link2, Copy, X } from "lucide-react";

// Fase Rastreio-Publico (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Rastreamento público de carga"). O token em
// si (não o link inteiro) fica só no estado local depois de gerado — a
// prop `token` vinda do servidor também existe, mas priorizamos o valor
// recém-gerado nesta sessão pra evitar um reload só pra mostrar o link.
export function LinkRastreioFrete({
  freteId,
  token,
  expiraEm,
}: {
  freteId: string;
  token: string | null;
  expiraEm: string | null;
}) {
  const [tokenAtual, setTokenAtual] = useState(token);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [pendente, iniciar] = useTransition();

  const expirado = expiraEm ? new Date(expiraEm) < new Date() : false;
  const linkAtivo = tokenAtual && !expirado;
  const url = tokenAtual && typeof window !== "undefined" ? `${window.location.origin}/rastreio/${tokenAtual}` : "";

  function gerar() {
    setErro(undefined);
    iniciar(async () => {
      const resultado = await gerarLinkRastreioAcao(freteId);
      if (resultado?.erro) setErro(resultado.erro);
      else if (resultado.token) setTokenAtual(resultado.token);
    });
  }

  function revogar() {
    if (!confirm("Revogar o link de rastreio? Quem já tinha o link deixa de conseguir acompanhar essa carga.")) return;
    setErro(undefined);
    iniciar(async () => {
      const resultado = await revogarLinkRastreioAcao(freteId);
      if (resultado?.erro) setErro(resultado.erro);
      else setTokenAtual(null);
    });
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="card mb-6 p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <Link2 className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">Link de rastreio público</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Sem login, só leitura, com expiração — mande pro dono da carga acompanhar o status sem precisar ligar.
      </p>
      {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

      {linkAtivo ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{url}</code>
          <button type="button" onClick={copiar} className="btn-secondary flex items-center gap-1 text-xs">
            <Copy className="h-3 w-3" /> {copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={revogar}
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
          >
            <X className="h-3 w-3" /> Revogar
          </button>
        </div>
      ) : (
        <button type="button" disabled={pendente} onClick={gerar} className="btn-primary text-xs">
          {pendente ? "Gerando..." : expirado ? "Gerar novo link (o anterior expirou)" : "Gerar link de rastreio"}
        </button>
      )}
    </div>
  );
}
