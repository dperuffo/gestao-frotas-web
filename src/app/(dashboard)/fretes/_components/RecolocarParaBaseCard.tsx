"use client";

import { useState, useTransition } from "react";
import { recolocarFreteParaBaseAcao } from "../actions";

// Fase Fretes-Público-Alvo (23/07/26) — pedido do Daniel: se o frete
// enviado pra fora da base não for pego por nenhum motorista (ou o cliente
// tiver recusado as propostas), ele pode editar a solicitação e recolocar
// pra base — aberta pra todos os motoristas próprios ou direto pra um deles.
type MotoristaBase = { id: string; nome: string };

export function RecolocarParaBaseCard({
  freteId,
  empresaId,
  motoristas,
}: {
  freteId: string;
  empresaId: string;
  motoristas: MotoristaBase[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [modo, setModo] = useState<"aberta" | "direto">("aberta");
  const [motoristaId, setMotoristaId] = useState("");

  function handleClick() {
    setErro(undefined);
    if (modo === "direto" && !motoristaId) {
      setErro("Escolha o motorista da base.");
      return;
    }
    startTransition(async () => {
      const resultado = await recolocarFreteParaBaseAcao(freteId, empresaId, modo === "direto" ? motoristaId : null);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="card mb-6 border border-amber-200 bg-amber-50/50 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">↩️ Recolocar para a minha base</h2>
      <p className="mb-3 text-xs text-slate-600">
        Ninguém de fora pegou (ou você recusou as propostas)? Recoloque a solicitação para os seus motoristas
        próprios. As propostas abertas de fora são encerradas.
      </p>

      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="mb-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" checked={modo === "aberta"} onChange={() => setModo("aberta")} className="h-4 w-4" />
          Abrir para todos os motoristas da base
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" checked={modo === "direto"} onChange={() => setModo("direto")} className="h-4 w-4" />
          Atribuir direto a um motorista da base
        </label>
        {modo === "direto" && (
          <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className="input">
            <option value="">Selecione...</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        )}
        {modo === "direto" && motoristas.length === 0 && (
          <p className="text-xs text-slate-500">Nenhum motorista próprio ativo cadastrado.</p>
        )}
      </div>

      <button type="button" onClick={handleClick} disabled={isPending} className="btn-primary text-sm">
        {isPending ? "Recolocando..." : "Recolocar para a base"}
      </button>
    </div>
  );
}
