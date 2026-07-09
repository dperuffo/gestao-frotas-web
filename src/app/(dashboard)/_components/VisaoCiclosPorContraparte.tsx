"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import type { LinhaContraparte } from "@/lib/ciclosAbertos";

type Filtro = "todos" | "andamento" | "aberta" | "vencida" | "paga";

// Fase 27.85 — pedido do Daniel: "um posto pode ter muitos ciclos com
// diversos status... precisamos facilitar a visão de postos com um volume
// grande de ciclos, pois possui relacionamento com muitos clientes". Troca
// a lista plana (1 linha por fatura, todos os clientes misturados — Fases
// 27.75/27.84) por 1 linha por CONTRAPARTE, com filtro por status e busca
// por nome — pensado pra escanear dezenas de clientes/postos de uma vez,
// não pra listar toda fatura individual (isso continua disponível no
// drill-down de cada contraparte, via `hrefBase`).
//
// hrefBase + empresaId (em vez de uma função `hrefHistorico`): este é um
// Client Component ("use client"), e os componentes que o chamam
// (financeiro-posto/page.tsx, CobrancaEmAberto.tsx) são Server Components —
// não dá pra passar uma função como prop de Server pra Client Component
// ("Functions cannot be passed directly to Client Components"). O link é
// montado aqui dentro a partir de strings simples.
export function VisaoCiclosPorContraparte({
  linhas,
  rotulo,
  hrefBase,
  empresaId,
}: {
  linhas: LinhaContraparte[];
  rotulo: "posto" | "cliente";
  hrefBase: string;
  empresaId: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const contagens = useMemo(
    () => ({
      todos: linhas.length,
      andamento: linhas.filter((l) => l.cicloAtual).length,
      aberta: linhas.filter((l) => l.contagem.aberta > 0).length,
      vencida: linhas.filter((l) => l.contagem.vencida > 0).length,
      paga: linhas.filter((l) => l.contagem.paga > 0).length,
    }),
    [linhas]
  );

  const linhasFiltradas = useMemo(() => {
    let resultado = linhas;
    if (filtro === "andamento") resultado = resultado.filter((l) => l.cicloAtual);
    else if (filtro === "aberta") resultado = resultado.filter((l) => l.contagem.aberta > 0);
    else if (filtro === "vencida") resultado = resultado.filter((l) => l.contagem.vencida > 0);
    else if (filtro === "paga") resultado = resultado.filter((l) => l.contagem.paga > 0);

    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      resultado = resultado.filter((l) => l.contraparteNome.toLowerCase().includes(q));
    }
    return resultado;
  }, [linhas, filtro, busca]);

  const rotuloColuna = rotulo === "posto" ? "Cliente" : "Posto";

  return (
    <div className="mb-6 card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Ciclos por {rotuloColuna.toLowerCase()}</h2>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar ${rotuloColuna.toLowerCase()}...`}
          className="input w-full max-w-[240px] text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        <FiltroChip label="Todos" contagem={contagens.todos} ativo={filtro === "todos"} onClick={() => setFiltro("todos")} />
        <FiltroChip
          label="Em andamento"
          contagem={contagens.andamento}
          ativo={filtro === "andamento"}
          onClick={() => setFiltro("andamento")}
          cor="azul"
        />
        <FiltroChip label="Em aberto" contagem={contagens.aberta} ativo={filtro === "aberta"} onClick={() => setFiltro("aberta")} />
        <FiltroChip
          label="Vencidas"
          contagem={contagens.vencida}
          ativo={filtro === "vencida"}
          onClick={() => setFiltro("vencida")}
          cor="vermelho"
        />
        <FiltroChip label="Pagas" contagem={contagens.paga} ativo={filtro === "paga"} onClick={() => setFiltro("paga")} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{rotuloColuna}</th>
              <th className="px-4 py-3">Ciclo atual</th>
              <th className="px-4 py-3">Faturas</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhasFiltradas.map((l) => (
              <tr key={l.contraparteId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{l.contraparteNome}</p>
                  {l.cicloFaturamentoDias > 0 && (
                    <p className="text-xs text-slate-400">
                      Ciclo {l.cicloFaturamentoDias}+{l.prazoVencimentoDias} dias
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.cicloAtual ? (
                    <>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Em andamento
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatarDataBr(l.cicloAtual.periodo_inicio)} – {formatarDataBr(l.cicloAtual.periodo_fim_previsto)} ·{" "}
                        {l.cicloAtual.quantidade_abastecimentos} abastecimento
                        {l.cicloAtual.quantidade_abastecimentos === 1 ? "" : "s"} ·{" "}
                        {formatarMoeda(l.cicloAtual.valor_acumulado)}
                      </p>
                      {/* Fase 27.105 — regra do Daniel: só entra na fatura quem
                          tem NF-e vinculada; avisa aqui quando tem valor
                          represado esperando nota. */}
                      {l.cicloAtual.quantidade_pendente_nfe > 0 && (
                        <p className="mt-1 text-xs text-red-600">
                          {formatarMoeda(l.cicloAtual.valor_pendente_nfe)} ({l.cicloAtual.quantidade_pendente_nfe}) esperando NF-e
                        </p>
                      )}
                      {/* Fase 27.93 — pedido do Daniel: ciclo em andamento precisa
                          mostrar a quantidade de abastecimentos (não só o valor) e dar
                          acesso ao detalhamento de QUAIS abastecimentos compõem o valor. */}
                      <Link
                        href={`/ciclo-aberto/${l.cicloAtual.negociacao_id}`}
                        className="mt-1 inline-block text-xs text-frota-600 hover:underline"
                      >
                        Ver detalhamento
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Sem ciclo em andamento</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {l.contagem.vencida > 0 && <Chip texto={`${l.contagem.vencida} vencida${l.contagem.vencida > 1 ? "s" : ""}`} cor="vermelho" />}
                    {l.contagem.aberta > 0 && <Chip texto={`${l.contagem.aberta} aberta${l.contagem.aberta > 1 ? "s" : ""}`} cor="neutro" />}
                    {l.contagem.paga > 0 && <Chip texto={`${l.contagem.paga} paga${l.contagem.paga > 1 ? "s" : ""}`} cor="verde" />}
                    {l.contagem.vencida === 0 && l.contagem.aberta === 0 && l.contagem.paga === 0 && (
                      <span className="text-xs text-slate-400">Nenhuma ainda</span>
                    )}
                  </div>
                  {l.valorEmAberto > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Em aberto: <strong className="text-slate-700">{formatarMoeda(l.valorEmAberto)}</strong>
                      {l.valorVencido > 0 && <span className="text-red-600"> ({formatarMoeda(l.valorVencido)} vencido)</span>}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${hrefBase}/${l.contraparteId}?empresa=${empresaId}`}
                    className="text-frota-600 hover:underline"
                  >
                    Ver histórico
                  </Link>
                </td>
              </tr>
            ))}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {linhas.length === 0
                    ? `Nenhum ${rotuloColuna.toLowerCase()} com ciclo ainda.`
                    : "Nenhum resultado para esse filtro/busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltroChip({
  label,
  contagem,
  ativo,
  onClick,
  cor,
}: {
  label: string;
  contagem: number;
  ativo: boolean;
  onClick: () => void;
  cor?: "azul" | "vermelho";
}) {
  const corAtivo =
    cor === "azul" ? "bg-blue-600 text-white" : cor === "vermelho" ? "bg-red-600 text-white" : "bg-frota-600 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${ativo ? corAtivo : "bg-slate-100 text-slate-600"}`}
    >
      {label} <span className={ativo ? "opacity-80" : "text-slate-400"}>{contagem}</span>
    </button>
  );
}

function Chip({ texto, cor }: { texto: string; cor: "vermelho" | "verde" | "neutro" }) {
  const cores =
    cor === "vermelho" ? "bg-red-100 text-red-700" : cor === "verde" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cores}`}>{texto}</span>;
}
