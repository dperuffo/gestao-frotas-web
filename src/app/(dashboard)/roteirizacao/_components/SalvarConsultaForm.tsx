"use client";

import { useState, useTransition } from "react";
import { salvarRotaAcao } from "../actions";

export function SalvarConsultaForm({
  tipo,
  empresaId,
  dados,
  nomeSugerido,
}: {
  tipo: "estado" | "rota" | "busca" | "roteirizacao";
  empresaId: string | null;
  dados: Record<string, unknown>;
  nomeSugerido?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeSugerido ?? "");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary">
        Salvar consulta
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da consulta"
        className="input w-56"
      />
      <button
        type="button"
        disabled={isPending}
        className="btn-primary disabled:opacity-50"
        onClick={() => {
          startTransition(async () => {
            const resposta = await salvarRotaAcao({ nome, tipo, empresaId, dados });
            setMensagem(resposta.erro ?? "Salvo!");
            if (!resposta.erro) setAberto(false);
          });
        }}
      >
        {isPending ? "Salvando..." : "Confirmar"}
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-sm text-slate-400 hover:text-slate-600">
        Cancelar
      </button>
      {mensagem && <span className="text-xs text-slate-500">{mensagem}</span>}
    </div>
  );
}
