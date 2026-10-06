"use client";

import { useState, useTransition } from "react";
import { Check, X, Ban } from "lucide-react";
import { cancelarAjustePdvAcao, decidirAjustePdvAcao, solicitarAjustePdvAcao, type AjustePdv } from "../actions";

const CAMPOS: { chave: string; rotulo: string; numero: boolean }[] = [
  { chave: "placa", rotulo: "Placa", numero: false },
  { chave: "motorista_nome", rotulo: "Motorista", numero: false },
  { chave: "motorista_cpf", rotulo: "CPF do motorista", numero: false },
  { chave: "combustivel", rotulo: "Combustível", numero: false },
  { chave: "litros", rotulo: "Litros", numero: true },
  { chave: "preco_litro", rotulo: "Preço por litro", numero: true },
  { chave: "valor_total_combustivel", rotulo: "Valor do combustível (R$)", numero: true },
  { chave: "valor_total_itens_extra", rotulo: "Valor de itens extra (R$)", numero: true },
  { chave: "forma_pagamento", rotulo: "Forma de pagamento", numero: false },
  { chave: "hodometro", rotulo: "Hodômetro", numero: true },
  { chave: "bomba", rotulo: "Bomba", numero: false },
  { chave: "bico", rotulo: "Bico", numero: false },
  { chave: "data_abastecimento", rotulo: "Data/hora (ISO)", numero: false },
];
const ROTULO: Record<string, string> = { ...Object.fromEntries(CAMPOS.map((c) => [c.chave, c.rotulo])), valor_total_transacao: "Total da transação (R$)" };

const mostrar = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const COR: Record<AjustePdv["status"], string> = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  recusado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  cancelado: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function ListaAjustes({ itens }: { itens: AjustePdv[] }) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [linhas, setLinhas] = useState<{ chave: string; valor: string }[]>([{ chave: "litros", valor: "" }]);
  const [motivo, setMotivo] = useState("");

  function rodar(fn: () => Promise<{ erro?: string }>, ok?: string) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (r.erro) setErro(r.erro);
      else if (ok) setAviso(ok);
    });
  }

  function enviar() {
    const alteracoes: Record<string, string | number | null> = {};
    for (const l of linhas) {
      const campo = CAMPOS.find((c) => c.chave === l.chave);
      if (!campo || l.valor.trim() === "") continue;
      if (campo.numero) {
        const n = Number(l.valor.replace(",", "."));
        if (Number.isNaN(n)) return setErro(`Valor inválido em "${campo.rotulo}".`);
        alteracoes[l.chave] = n;
      } else alteracoes[l.chave] = l.valor.trim();
    }
    rodar(async () => {
      const r = await solicitarAjustePdvAcao(codigo, alteracoes, motivo);
      if (!r.erro) {
        setCodigo("");
        setMotivo("");
        setLinhas([{ chave: "litros", valor: "" }]);
      }
      return r;
    }, "Pedido enviado. A outra parte precisa aprovar.");
  }

  return (
    <div className="space-y-4">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</div>}
      {aviso && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{aviso}</div>}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Novo pedido de ajuste</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Código do abastecimento (confirmado)
            <input className="input mt-1 w-full text-sm" placeholder="4000000033" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </label>
          {linhas.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select
                className="input text-sm"
                value={l.chave}
                onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, chave: e.target.value } : x)))}
              >
                {CAMPOS.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
              <input
                className="input flex-1 text-sm"
                placeholder="Novo valor"
                value={l.valor}
                onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
              />
            </div>
          ))}
          <button type="button" className="text-xs text-frota-600 hover:underline" onClick={() => setLinhas((ls) => [...ls, { chave: "placa", valor: "" }])}>
            + adicionar outro campo
          </button>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Motivo (obrigatório)
            <textarea className="input mt-1 w-full text-sm" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button onClick={enviar} disabled={pendente} className="btn-primary text-sm">
            Enviar pedido
          </button>
        </div>
      </details>

      {itens.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">Nenhum pedido de ajuste.</p>
      ) : (
        itens.map((a) => (
          <div key={a.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Abastecimento {a.codigo ?? a.abastecimentoId} · {a.placa ?? "sem placa"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pedido {a.solicitanteLado === "posto" ? `do posto (${a.postoNome ?? "—"})` : `do cliente (${a.clienteNome ?? "—"})`} por {a.criadoPor} em {dataHora(a.criadoEm)}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR[a.status]}`}>{a.status}</span>
            </div>
            <div className="rounded-lg border border-slate-200 text-sm dark:border-slate-700">
              {Object.keys(a.alteracoes).map((k) => (
                <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5 last:border-0 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">{ROTULO[k] ?? k}</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    <span className="text-slate-400 line-through">{mostrar(a.originais[k])}</span> → <strong>{mostrar(a.alteracoes[k])}</strong>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="text-xs uppercase tracking-wide text-slate-400">Motivo: </span>
              {a.motivo}
            </p>
            {a.decididoPor && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {a.status} por {a.decididoPor} em {dataHora(a.decididoEm)}
                {a.decisaoMotivo ? ` — ${a.decisaoMotivo}` : ""}
              </p>
            )}
            {a.status === "pendente" && (
              <div className="flex flex-wrap justify-end gap-2">
                {a.possoCancelar && (
                  <button disabled={pendente} onClick={() => rodar(() => cancelarAjustePdvAcao(a.id))} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <Ban className="h-4 w-4" /> Cancelar pedido
                  </button>
                )}
                {a.possoDecidir && (
                  <>
                    <button
                      disabled={pendente}
                      onClick={() => {
                        const motivoRecusa = window.prompt("Motivo da recusa (obrigatório — fica registrado no abastecimento):");
                        if (motivoRecusa === null) return; // cancelou
                        if (!motivoRecusa.trim()) {
                          window.alert("Informe o motivo da recusa.");
                          return;
                        }
                        rodar(() => decidirAjustePdvAcao(a.id, false, motivoRecusa.trim()));
                      }}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      <X className="h-4 w-4" /> Recusar
                    </button>
                    <button
                      disabled={pendente}
                      onClick={() => window.confirm("Aprovar este ajuste? O abastecimento será corrigido.") && rodar(() => decidirAjustePdvAcao(a.id, true))}
                      className="btn-primary flex items-center gap-1.5 text-sm"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </button>
                  </>
                )}
                {!a.possoCancelar && !a.possoDecidir && <span className="text-xs text-slate-400">Aguardando a outra parte.</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
