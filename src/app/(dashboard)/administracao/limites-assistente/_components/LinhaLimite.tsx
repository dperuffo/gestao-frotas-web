"use client";

import { useState, useTransition } from "react";

// Campo de limite com botão Salvar. `valorInicial` null = sem exceção (cliente usa o plano).
export function LinhaLimite({
  valorInicial,
  permitirVazio = false,
  placeholder,
  onSalvar,
}: {
  valorInicial: number | null;
  permitirVazio?: boolean;
  placeholder?: string;
  onSalvar: (valor: number | null) => Promise<{ ok: true } | { ok: false; erro: string }>;
}) {
  const [texto, setTexto] = useState(valorInicial === null ? "" : String(valorInicial));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const mudou = texto.trim() !== (valorInicial === null ? "" : String(valorInicial));

  function salvar() {
    setMsg(null);
    const limpo = texto.trim().replace(/\./g, "");
    if (limpo === "") {
      if (!permitirVazio) return setMsg({ ok: false, texto: "Informe o limite." });
      startTransition(async () => {
        const r = await onSalvar(null);
        setMsg(r.ok ? { ok: true, texto: "Salvo" } : { ok: false, texto: r.erro });
      });
      return;
    }
    const n = Number(limpo);
    if (!Number.isFinite(n)) return setMsg({ ok: false, texto: "Número inválido." });
    startTransition(async () => {
      const r = await onSalvar(n);
      setMsg(r.ok ? { ok: true, texto: "Salvo" } : { ok: false, texto: r.erro });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        inputMode="numeric"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setMsg(null);
        }}
        placeholder={placeholder}
        aria-label="Limite de tokens por mês"
        className="input w-36 text-right text-sm tabular-nums"
      />
      <button type="button" onClick={salvar} disabled={pending || !mudou} className="btn-secondary text-sm">
        {pending ? "Salvando…" : "Salvar"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.texto}</span>}
    </div>
  );
}
