"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TIPO_CUSTO_FIXO_LABEL } from "@/lib/financeiro";
import BotaoBaixarPdfPersonalizadoLazy from "./BotaoBaixarPdfPersonalizadoLazy";

export type AbastecimentoBruto = {
  placa: string | null;
  motorista: string | null;
  produto: string | null;
  litros: number | null;
  valor: number | null;
  precoLitro: number | null;
  cnpjPosto: string | null;
  nomePosto: string | null;
  ufPosto: string | null;
  hodometro: number | null;
  data: string | null;
};

export type ManutencaoBruto = {
  placa: string | null;
  oficina: string | null;
  custoTotal: number | null;
  data: string | null;
};

export type CustoFixoBruto = {
  placa: string | null;
  tipo: string | null;
  descricao: string | null;
  valor: number | null;
  data: string | null;
  recorrente: boolean | null;
  origem: string | null;
};

type Fonte = "abastecimentos" | "manutencao" | "custos_fixos";
type LinhaBase = AbastecimentoBruto | ManutencaoBruto | CustoFixoBruto;
type Formato = "int" | "dec" | "money" | "money3";
type Metrica = { id: string; label: string; formato: Formato; calcular: (linhas: LinhaBase[]) => number };

const CORES = ["#1565C0", "#E65100", "#2E7D32", "#6A1B9A", "#B71C1C", "#00838F", "#F9A825", "#4527A0"];

const FONTE_LABEL: Record<Fonte, string> = { abastecimentos: "Abastecimentos", manutencao: "Manutenção", custos_fixos: "Custos Fixos" };

function mesRef(data: string | null) {
  if (!data) return "—";
  return data.slice(0, 7); // YYYY-MM
}

// Dimensões disponíveis por fonte — cada uma extrai a chave de agrupamento
// (usada tanto pra "group by" quanto pro rótulo mostrado no gráfico/tabela).
const DIMENSOES: Record<Fonte, { id: string; label: string; extrator: (r: LinhaBase) => string }[]> = {
  abastecimentos: [
    { id: "periodo_mes", label: "Período (por mês)", extrator: (r) => mesRef((r as AbastecimentoBruto).data) },
    { id: "produto", label: "Combustível", extrator: (r) => (r as AbastecimentoBruto).produto || "—" },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as AbastecimentoBruto).placa || "—" },
    { id: "motorista", label: "Motorista", extrator: (r) => (r as AbastecimentoBruto).motorista || "—" },
    { id: "nome_posto", label: "Posto", extrator: (r) => (r as AbastecimentoBruto).nomePosto || "—" },
    { id: "uf_posto", label: "Estado (UF)", extrator: (r) => (r as AbastecimentoBruto).ufPosto || "—" },
  ],
  manutencao: [
    { id: "periodo_mes", label: "Período (por mês)", extrator: (r) => mesRef((r as ManutencaoBruto).data) },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as ManutencaoBruto).placa || "—" },
    { id: "oficina", label: "Oficina", extrator: (r) => (r as ManutencaoBruto).oficina || "—" },
  ],
  custos_fixos: [
    { id: "periodo_mes", label: "Período (por mês)", extrator: (r) => mesRef((r as CustoFixoBruto).data) },
    {
      id: "tipo",
      label: "Tipo de custo",
      extrator: (r) => {
        const tipo = (r as CustoFixoBruto).tipo as keyof typeof TIPO_CUSTO_FIXO_LABEL | null;
        return (tipo && TIPO_CUSTO_FIXO_LABEL[tipo]) || tipo || "—";
      },
    },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as CustoFixoBruto).placa || "—" },
    { id: "origem", label: "Origem", extrator: (r) => ((r as CustoFixoBruto).origem === "api" ? "Integração" : "Manual") },
  ],
};

// Métricas disponíveis por fonte — cada uma recebe o grupo de linhas já
// filtrado e devolve um número pronto pra exibir/plotar. Agora é possível
// selecionar mais de uma ao mesmo tempo (ver `metricaIds` no componente).
const METRICAS: Record<Fonte, Metrica[]> = {
  abastecimentos: [
    { id: "qtd", label: "Nº de Abastecimentos", formato: "int", calcular: (l) => l.length },
    { id: "volume", label: "Volume Total (L)", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as AbastecimentoBruto).litros || 0), 0) },
    { id: "valor", label: "Valor Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as AbastecimentoBruto).valor || 0), 0) },
    {
      id: "ticket_med",
      label: "Ticket Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as AbastecimentoBruto).valor || 0), 0) / l.length : 0),
    },
    {
      id: "preco_med",
      label: "Preço Médio (R$/L)",
      formato: "money3",
      calcular: (l) => {
        const validos = l.filter((r) => ((r as AbastecimentoBruto).precoLitro || 0) > 0);
        return validos.length ? validos.reduce((s, r) => s + ((r as AbastecimentoBruto).precoLitro || 0), 0) / validos.length : 0;
      },
    },
  ],
  manutencao: [
    { id: "man_custo", label: "Custo Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as ManutencaoBruto).custoTotal || 0), 0) },
    { id: "man_qtd", label: "Nº de Registros", formato: "int", calcular: (l) => l.length },
    {
      id: "man_custo_med",
      label: "Custo Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as ManutencaoBruto).custoTotal || 0), 0) / l.length : 0),
    },
  ],
  custos_fixos: [
    { id: "cf_valor", label: "Valor Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as CustoFixoBruto).valor || 0), 0) },
    { id: "cf_qtd", label: "Nº de Lançamentos", formato: "int", calcular: (l) => l.length },
    {
      id: "cf_valor_med",
      label: "Valor Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as CustoFixoBruto).valor || 0), 0) / l.length : 0),
    },
  ],
};

function formatarValor(v: number, formato: Formato) {
  if (formato === "int") return v.toLocaleString("pt-BR");
  if (formato === "dec") return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (formato === "money3") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: (string | number)[][]) {
  const escapar = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cabecalho.map(escapar).join(","), ...linhas.map((l) => l.map(escapar).join(","))].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Dropdown de checkboxes pra escolher 1+ métricas — trocado de <select> pra
// isso porque um <select multiple> nativo exige ctrl/cmd+clique (nada óbvio
// pra quem não é técnico) e não dá pra ver quantas opções já estão marcadas
// sem abrir a lista. Fecha sozinho ao clicar fora (mesmo comportamento de um
// <select> normal).
function SeletorMetricas({
  opcoes,
  selecionadas,
  onToggle,
}: {
  opcoes: Metrica[];
  selecionadas: string[];
  onToggle: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const rotulo =
    selecionadas.length === 0
      ? "Selecione..."
      : selecionadas.length === 1
        ? (opcoes.find((m) => m.id === selecionadas[0])?.label ?? "1 métrica")
        : `${selecionadas.length} métricas selecionadas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="input flex items-center justify-between text-left text-sm"
      >
        <span className="truncate">{rotulo}</span>
        <span className="ml-2 shrink-0 text-slate-400">▾</span>
      </button>
      {aberto && (
        <div className="absolute z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {opcoes.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selecionadas.includes(m.id)}
                onChange={() => onToggle(m.id)}
                className="h-4 w-4 rounded border-slate-300 text-frota-600 focus:ring-frota-500"
              />
              {m.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Construtor de relatório "monte o seu": escolhe fonte de dado (abastecimentos,
// manutenção ou custos fixos — a fonte financeira foi possível a partir da Fase 22,
// quando a tabela custos_fixos passou a existir; negociações/acordos ainda não tem
// tabela própria, por isso continua fora), dimensão de agrupamento, uma ou mais
// métricas e tipo de gráfico. Com 1 métrica selecionada o gráfico colore por
// categoria (visual original); com 2+ cada métrica vira uma série própria
// (barras/linhas agrupadas, com legenda). Pizza sempre usa só a 1ª métrica
// selecionada, porque "fatia de um todo" só faz sentido pra uma métrica por
// vez — as demais continuam disponíveis na tabela e no CSV.
export function RelatoriosPersonalizados({
  abastecimentos,
  manutencoes,
  custosFixos,
  nomeEmpresa,
  nomeUsuario,
  cargoUsuario,
}: {
  abastecimentos: AbastecimentoBruto[];
  manutencoes: ManutencaoBruto[];
  custosFixos: CustoFixoBruto[];
  nomeEmpresa: string;
  nomeUsuario: string;
  cargoUsuario: string | null;
}) {
  const [fonte, setFonte] = useState<Fonte>("abastecimentos");
  const [dimensaoId, setDimensaoId] = useState(DIMENSOES.abastecimentos[0].id);
  const [metricaIds, setMetricaIds] = useState<string[]>([METRICAS.abastecimentos[0].id]);
  const [tipoGrafico, setTipoGrafico] = useState<"bar" | "bar_h" | "line" | "pie" | "table">("bar");

  const dimensoesDisponiveis = DIMENSOES[fonte];
  const metricasDisponiveis = METRICAS[fonte];
  const dimensaoAtual = dimensoesDisponiveis.find((d) => d.id === dimensaoId) ?? dimensoesDisponiveis[0];
  const metricasAtuais = metricasDisponiveis.filter((m) => metricaIds.includes(m.id));
  const metricaOrdenacao = metricasAtuais[0] ?? metricasDisponiveis[0];

  const dadosBase: LinhaBase[] =
    fonte === "abastecimentos" ? abastecimentos : fonte === "manutencao" ? manutencoes : custosFixos;

  const resultado = useMemo(() => {
    const grupos = new Map<string, LinhaBase[]>();
    for (const r of dadosBase) {
      const chave = dimensaoAtual.extrator(r);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(r);
    }
    return Array.from(grupos.entries())
      .map(([chave, linhas]) => {
        const valores: Record<string, number> = {};
        for (const m of metricasAtuais) valores[m.id] = m.calcular(linhas);
        return { chave, valores, qtdLinhas: linhas.length };
      })
      .sort((a, b) => (b.valores[metricaOrdenacao.id] ?? 0) - (a.valores[metricaOrdenacao.id] ?? 0));
  }, [dadosBase, dimensaoAtual, metricasAtuais, metricaOrdenacao]);

  const dadosGrafico = resultado.slice(0, 25).map((r, i) => ({ chave: r.chave, cor: CORES[i % CORES.length], ...r.valores }));

  function trocarFonte(novaFonte: Fonte) {
    setFonte(novaFonte);
    setDimensaoId(DIMENSOES[novaFonte][0].id);
    setMetricaIds([METRICAS[novaFonte][0].id]);
  }

  function toggleMetrica(id: string) {
    setMetricaIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // mantém pelo menos 1 métrica selecionada
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  const formatterTooltip = (value: number, name: string) => {
    const m = metricasAtuais.find((x) => x.label === name) ?? metricaOrdenacao;
    return [formatarValor(value, m.formato), m.label];
  };

  return (
    <div>
      <div className="mb-6 rounded-lg bg-gradient-to-r from-indigo-950 to-indigo-600 p-5">
        <p className="text-base font-semibold text-white">🗂️ Relatórios Personalizados</p>
        <p className="text-sm text-white/70">Combine fonte, dimensão, uma ou mais métricas e tipo de gráfico — exporte em CSV.</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fonte</label>
          <select value={fonte} onChange={(e) => trocarFonte(e.target.value as Fonte)} className="input text-sm">
            <option value="abastecimentos">⛽ Abastecimentos</option>
            <option value="manutencao">🔧 Manutenção</option>
            <option value="custos_fixos">💰 Custos Fixos</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dimensão</label>
          <select value={dimensaoAtual.id} onChange={(e) => setDimensaoId(e.target.value)} className="input text-sm">
            {dimensoesDisponiveis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Métricas</label>
          <SeletorMetricas opcoes={metricasDisponiveis} selecionadas={metricaIds} onToggle={toggleMetrica} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Gráfico</label>
          <select value={tipoGrafico} onChange={(e) => setTipoGrafico(e.target.value as typeof tipoGrafico)} className="input text-sm">
            <option value="bar">📊 Barras</option>
            <option value="bar_h">📉 Barras Horiz.</option>
            <option value="line">📈 Linhas</option>
            <option value="pie">🥧 Pizza</option>
            <option value="table">📋 Tabela</option>
          </select>
        </div>
      </div>

      {dadosBase.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">
          Nenhum dado de {fonte === "abastecimentos" ? "abastecimento" : fonte === "manutencao" ? "manutenção" : "custo fixo"}{" "}
          encontrado no período (últimos 12 meses{fonte === "custos_fixos" ? ", e também os próximos 12" : ""}).
        </p>
      ) : resultado.length === 0 || metricasAtuais.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum resultado para essa combinação de dimensão/métrica.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {metricasAtuais.map((m) => m.label).join(", ")} por {dimensaoAtual.label.toLowerCase()} — {resultado.length} grupo(s)
              {resultado.length > 25 ? " (mostrando os 25 maiores no gráfico)" : ""}
            </p>
            <button
              type="button"
              onClick={() =>
                baixarCsv(
                  `relatorio_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.csv`,
                  [dimensaoAtual.label, ...metricasAtuais.map((m) => m.label), "Nº de registros"],
                  resultado.map((r) => [r.chave, ...metricasAtuais.map((m) => formatarValor(r.valores[m.id] ?? 0, m.formato)), r.qtdLinhas])
                )
              }
              className="btn-secondary text-sm"
            >
              ⬇️ Exportar CSV
            </button>
            <BotaoBaixarPdfPersonalizadoLazy
              nomeArquivo={`relatorio_personalizado_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.pdf`}
              nomeEmpresa={nomeEmpresa}
              titulo={`${metricasAtuais.map((m) => m.label).join(", ")} por ${dimensaoAtual.label}`}
              subtitulo={`Fonte: ${FONTE_LABEL[fonte]} · Agrupado por ${dimensaoAtual.label.toLowerCase()} · ${resultado.length} grupo(s)`}
              fonteLabel={FONTE_LABEL[fonte]}
              dimensaoLabel={dimensaoAtual.label}
              metricasLabels={metricasAtuais.map((m) => m.label)}
              nomeUsuario={nomeUsuario}
              cargoUsuario={cargoUsuario}
              colunaChave={dimensaoAtual.label}
              colunas={metricasAtuais.map((m) => ({ id: m.id, label: m.label }))}
              linhas={resultado.map((r) => ({
                chave: r.chave,
                valores: metricasAtuais.map((m) => formatarValor(r.valores[m.id] ?? 0, m.formato)),
                registros: String(r.qtdLinhas),
              }))}
            />
          </div>

          {tipoGrafico === "pie" && metricasAtuais.length > 1 && (
            <p className="mb-2 text-xs text-slate-400">
              O gráfico de pizza mostra apenas a 1ª métrica selecionada ({metricaOrdenacao.label}) — as demais continuam na
              tabela e no CSV abaixo.
            </p>
          )}

          {tipoGrafico === "table" ? null : (
            <ResponsiveContainer width="100%" height={tipoGrafico === "bar_h" ? Math.max(220, dadosGrafico.length * 28) : 320}>
              {tipoGrafico === "pie" ? (
                <PieChart>
                  <Pie data={dadosGrafico} dataKey={metricaOrdenacao.id} nameKey="chave" outerRadius={110} label={(e) => e.chave}>
                    {dadosGrafico.map((d) => (
                      <Cell key={d.chave} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarValor(v, metricaOrdenacao.formato)} />
                  <Legend />
                </PieChart>
              ) : tipoGrafico === "line" ? (
                <LineChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="chave" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={formatterTooltip} />
                  {metricasAtuais.length > 1 && <Legend />}
                  {metricasAtuais.map((m, i) => (
                    <Line key={m.id} type="monotone" dataKey={m.id} name={m.label} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              ) : tipoGrafico === "bar_h" ? (
                <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="chave" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={formatterTooltip} />
                  {metricasAtuais.length > 1 && <Legend />}
                  {metricasAtuais.length === 1 ? (
                    <Bar dataKey={metricaOrdenacao.id} name={metricaOrdenacao.label} radius={[0, 4, 4, 0]}>
                      {dadosGrafico.map((d) => (
                        <Cell key={d.chave} fill={d.cor} />
                      ))}
                    </Bar>
                  ) : (
                    metricasAtuais.map((m, i) => <Bar key={m.id} dataKey={m.id} name={m.label} fill={CORES[i % CORES.length]} radius={[0, 4, 4, 0]} />)
                  )}
                </BarChart>
              ) : (
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="chave" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={formatterTooltip} />
                  {metricasAtuais.length > 1 && <Legend />}
                  {metricasAtuais.length === 1 ? (
                    <Bar dataKey={metricaOrdenacao.id} name={metricaOrdenacao.label} radius={[4, 4, 0, 0]}>
                      {dadosGrafico.map((d) => (
                        <Cell key={d.chave} fill={d.cor} />
                      ))}
                    </Bar>
                  ) : (
                    metricasAtuais.map((m, i) => <Bar key={m.id} dataKey={m.id} name={m.label} fill={CORES[i % CORES.length]} radius={[4, 4, 0, 0]} />)
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}

          <div className="mt-4 max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{dimensaoAtual.label}</th>
                  {metricasAtuais.map((m) => (
                    <th key={m.id} className="py-2 pr-3">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2">Registros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultado.map((r) => (
                  <tr key={r.chave}>
                    <td className="py-2 pr-3 text-slate-700">{r.chave}</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums font-medium text-slate-900">
                        {formatarValor(r.valores[m.id] ?? 0, m.formato)}
                      </td>
                    ))}
                    <td className="py-2 tabular-nums text-slate-500">{r.qtdLinhas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
