"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import BotaoBaixarPdfPersonalizadoLazy from "../../relatorios/_components/BotaoBaixarPdfPersonalizadoLazy";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Relatorios-Personalizados-Posto (09/09/2026, pedido do Daniel: "a
// visao de posto na aplicacao nao possui uma aba de Relatorios
// Personalizados... precisamos trazer relatorios para esta visão, com
// fontes de dados, dimensoes e variaveis diversas, assim como temos na
// visao do cliente") — mesma arquitetura de
// relatorios/_components/RelatoriosPersonalizados.tsx (dimensão + métrica(s)
// + gráfico + período + CSV/PDF), só que com as 3 fontes que fazem sentido
// do lado POSTO (vendedor), em vez das ~17 fontes do lado cliente/frota
// (que são todas sobre veículos/motoristas — não existem no tenant posto):
//  - Vendas: o que o posto vendeu pra cada cliente (relatorio_vendas_posto_bruto).
//  - Financeiro: contas a receber (faturas_postos) + a pagar (despesas_postos)
//    do próprio posto, unidas em JS (não existe RPC "bruto" unificada pro
//    lado posto ainda — as duas tabelas já vêm com RLS própria, buscadas
//    direto via .from() em relatorios-posto/page.tsx).
//  - Notas Fiscais: NF-e emitidas pelo posto (notas_fiscais_abastecimento,
//    lado emitente), quem comprou é o cliente (nome_destinatario).
// O botão de exportar PDF é o MESMO componente do lado cliente
// (BotaoBaixarPdfPersonalizadoLazy) — já é genérico (recebe rótulos/colunas/
// linhas prontos), não precisou de nenhuma duplicação.
export type VendaPostoBruto = {
  clienteNome: string | null;
  clienteMunicipio: string | null;
  clienteUf: string | null;
  produto: string | null;
  litros: number | null;
  valor: number | null;
  precoLitro: number | null;
  provedor: string | null;
  placa: string | null;
  motorista: string | null;
  data: string | null;
};

export type FinanceiroPostoBruto = {
  movimento: string | null;
  status: string | null;
  contraparte: string | null;
  origem: string | null;
  valorOriginal: number | null;
  valorPago: number | null;
  data: string | null;
};

export type NotaFiscalPostoBruto = {
  produto: string | null;
  clienteNome: string | null;
  cnpjCliente: string | null;
  numeroNf: number | null;
  quantidade: number | null;
  valorTotal: number | null;
  valorUnitario: number | null;
  data: string | null;
};

type Fonte = "vendas" | "financeiro" | "notas_fiscais";
type LinhaBase = VendaPostoBruto | FinanceiroPostoBruto | NotaFiscalPostoBruto;
type Formato = "int" | "dec" | "money" | "money3";
type Metrica = { id: string; label: string; formato: Formato; calcular: (linhas: LinhaBase[]) => number };

const CORES = ["#1565C0", "#E65100", "#2E7D32", "#6A1B9A", "#B71C1C", "#00838F", "#F9A825", "#4527A0"];

const FONTE_LABEL: Record<Fonte, string> = {
  vendas: "Vendas",
  financeiro: "Financeiro (Receber/Pagar)",
  notas_fiscais: "Notas Fiscais",
};

function mesRef(data: string | null) {
  if (!data) return "—";
  return data.slice(0, 7); // YYYY-MM
}

// Mesmas 2 mecânicas de período do lado cliente (ver comentário original em
// RelatoriosPersonalizados.tsx): granularidade de agrupamento da dimensão
// "Período" e filtro de intervalo de datas independente.
type Granularidade = "dia" | "semana" | "quinzena" | "mes";
const GRANULARIDADE_LABEL: Record<Granularidade, string> = {
  dia: "por dia",
  semana: "por semana",
  quinzena: "por quinzena",
  mes: "por mês",
};

type PeriodoPreset = "hoje" | "7d" | "15d" | "mes" | "12m" | "personalizado";

function dataOf(r: LinhaBase): string | null {
  return (r as { data: string | null }).data;
}

function periodoRef(dataIso: string | null, gran: Granularidade): string {
  if (!dataIso) return "—";
  const iso = dataIso.slice(0, 10);
  if (gran === "dia") return iso;
  if (gran === "mes") return iso.slice(0, 7);
  const d = new Date(`${iso}T00:00:00`);
  if (gran === "semana") {
    const diaSemana = (d.getDay() + 6) % 7;
    const inicioSemana = new Date(d);
    inicioSemana.setDate(d.getDate() - diaSemana);
    return `Semana de ${inicioSemana.toLocaleDateString("pt-BR")}`;
  }
  const quinzena = d.getDate() <= 15 ? "1ª quinzena" : "2ª quinzena";
  return `${iso.slice(0, 7)} — ${quinzena}`;
}

function calcularIntervaloPeriodo(
  preset: PeriodoPreset,
  inicioPersonalizado: string,
  fimPersonalizado: string
): { inicio: string | null; fim: string | null } {
  if (preset === "12m") return { inicio: null, fim: null };
  if (preset === "personalizado") return { inicio: inicioPersonalizado || null, fim: fimPersonalizado || null };
  const hoje = new Date();
  const fim = hoje.toISOString().slice(0, 10);
  const diasParaVoltar = preset === "hoje" ? 0 : preset === "7d" ? 6 : preset === "15d" ? 14 : 29;
  const inicioData = new Date(hoje);
  inicioData.setDate(inicioData.getDate() - diasParaVoltar);
  return { inicio: inicioData.toISOString().slice(0, 10), fim };
}

const DIMENSOES: Record<Fonte, { id: string; label: string; extrator: (r: LinhaBase) => string }[]> = {
  vendas: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as VendaPostoBruto).data) },
    { id: "produto", label: "Combustível", extrator: (r) => (r as VendaPostoBruto).produto || "—" },
    { id: "cliente_nome", label: "Cliente", extrator: (r) => (r as VendaPostoBruto).clienteNome || "—" },
    { id: "cliente_uf", label: "Estado do Cliente (UF)", extrator: (r) => (r as VendaPostoBruto).clienteUf || "—" },
    { id: "cliente_municipio", label: "Município do Cliente", extrator: (r) => (r as VendaPostoBruto).clienteMunicipio || "—" },
    { id: "provedor", label: "Meio/Provedor", extrator: (r) => (r as VendaPostoBruto).provedor || "—" },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as VendaPostoBruto).placa || "—" },
    { id: "motorista", label: "Motorista", extrator: (r) => (r as VendaPostoBruto).motorista || "—" },
  ],
  financeiro: [
    { id: "periodo_mes", label: "Período (vencimento)", extrator: (r) => mesRef((r as FinanceiroPostoBruto).data) },
    { id: "movimento", label: "Movimento (Receber/Pagar)", extrator: (r) => (r as FinanceiroPostoBruto).movimento || "—" },
    { id: "status", label: "Status", extrator: (r) => (r as FinanceiroPostoBruto).status || "—" },
    { id: "contraparte", label: "Cliente/Fornecedor", extrator: (r) => (r as FinanceiroPostoBruto).contraparte || "—" },
    { id: "origem", label: "Tipo", extrator: (r) => (r as FinanceiroPostoBruto).origem || "—" },
  ],
  notas_fiscais: [
    { id: "periodo_mes", label: "Período (emissão)", extrator: (r) => mesRef((r as NotaFiscalPostoBruto).data) },
    { id: "produto", label: "Produto (ANP)", extrator: (r) => (r as NotaFiscalPostoBruto).produto || "—" },
    { id: "cliente_nome", label: "Cliente (Destinatário)", extrator: (r) => (r as NotaFiscalPostoBruto).clienteNome || "—" },
  ],
};

const METRICAS: Record<Fonte, Metrica[]> = {
  vendas: [
    { id: "qtd", label: "Nº de Vendas", formato: "int", calcular: (l) => l.length },
    { id: "volume", label: "Volume Total (L)", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as VendaPostoBruto).litros || 0), 0) },
    { id: "valor", label: "Valor Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as VendaPostoBruto).valor || 0), 0) },
    {
      id: "ticket_med",
      label: "Ticket Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as VendaPostoBruto).valor || 0), 0) / l.length : 0),
    },
    {
      id: "preco_med",
      label: "Preço Médio (R$/L)",
      formato: "money3",
      calcular: (l) => {
        const validos = l.filter((r) => ((r as VendaPostoBruto).precoLitro || 0) > 0);
        return validos.length ? validos.reduce((s, r) => s + ((r as VendaPostoBruto).precoLitro || 0), 0) / validos.length : 0;
      },
    },
  ],
  financeiro: [
    { id: "fin_valor_orig", label: "Valor Original (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as FinanceiroPostoBruto).valorOriginal || 0), 0) },
    { id: "fin_valor_pago", label: "Valor Pago (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as FinanceiroPostoBruto).valorPago || 0), 0) },
    { id: "fin_qtd", label: "Nº de Lançamentos", formato: "int", calcular: (l) => l.length },
    {
      id: "fin_valor_med",
      label: "Valor Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as FinanceiroPostoBruto).valorOriginal || 0), 0) / l.length : 0),
    },
  ],
  notas_fiscais: [
    { id: "nf_valor", label: "Valor Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as NotaFiscalPostoBruto).valorTotal || 0), 0) },
    { id: "nf_qtd", label: "Nº de Notas", formato: "int", calcular: (l) => l.length },
    { id: "nf_quantidade", label: "Quantidade Total (L)", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as NotaFiscalPostoBruto).quantidade || 0), 0) },
    {
      id: "nf_valor_unit_med",
      label: "Valor Unitário Médio (R$/L)",
      formato: "money3",
      calcular: (l) => {
        const validos = l.filter((r) => ((r as NotaFiscalPostoBruto).valorUnitario || 0) > 0);
        return validos.length ? validos.reduce((s, r) => s + ((r as NotaFiscalPostoBruto).valorUnitario || 0), 0) / validos.length : 0;
      },
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
        <span className="truncate" title={rotulo}>{rotulo}</span>
        <span className="ml-2 shrink-0 text-slate-400">▾</span>
      </button>
      {aberto && (
        <div className="absolute z-10 mt-1 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-lg">
          {opcoes.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-frota-50/60">
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

export function RelatoriosPersonalizadosPosto({
  vendas,
  financeiro,
  notasFiscais,
  nomeEmpresa,
  nomeUsuario,
  cargoUsuario,
}: {
  vendas: VendaPostoBruto[];
  financeiro: FinanceiroPostoBruto[];
  notasFiscais: NotaFiscalPostoBruto[];
  nomeEmpresa: string;
  nomeUsuario: string;
  cargoUsuario: string | null;
}) {
  const [fonte, setFonte] = useState<Fonte>("vendas");
  const [dimensaoId, setDimensaoId] = useState(DIMENSOES.vendas[0].id);
  const [metricaIds, setMetricaIds] = useState<string[]>([METRICAS.vendas[0].id]);
  const [tipoGrafico, setTipoGrafico] = useState<"bar" | "bar_h" | "line" | "pie" | "table">("bar");
  const [periodoGranularidade, setPeriodoGranularidade] = useState<Granularidade>("mes");
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("12m");
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState("");
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState("");
  const chartWrapRef = useRef<HTMLDivElement>(null);

  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : "#e2e8f0";
  const tooltipStyle =
    resolvedTheme === "dark" ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" } : undefined;

  const dimensoesDisponiveis = DIMENSOES[fonte];
  const metricasDisponiveis = METRICAS[fonte];
  const dimensaoAtual = dimensoesDisponiveis.find((d) => d.id === dimensaoId) ?? dimensoesDisponiveis[0];
  const metricasAtuais = metricasDisponiveis.filter((m) => metricaIds.includes(m.id));
  const metricaOrdenacao = metricasAtuais[0] ?? metricasDisponiveis[0];
  const ehDimensaoPeriodo = dimensaoAtual.id === "periodo_mes";
  const dimensaoLabelAtual = ehDimensaoPeriodo ? `Período (${GRANULARIDADE_LABEL[periodoGranularidade]})` : dimensaoAtual.label;

  const dadosPorFonte: Record<Fonte, LinhaBase[]> = useMemo(
    () => ({ vendas, financeiro, notas_fiscais: notasFiscais }),
    [vendas, financeiro, notasFiscais]
  );
  const dadosBase: LinhaBase[] = dadosPorFonte[fonte];

  const dadosFiltradosPorPeriodo = useMemo(() => {
    const { inicio, fim } = calcularIntervaloPeriodo(periodoPreset, dataInicioPersonalizada, dataFimPersonalizada);
    if (!inicio && !fim) return dadosBase;
    return dadosBase.filter((r) => {
      const d = dataOf(r);
      if (!d) return false;
      const iso = d.slice(0, 10);
      if (inicio && iso < inicio) return false;
      if (fim && iso > fim) return false;
      return true;
    });
  }, [dadosBase, periodoPreset, dataInicioPersonalizada, dataFimPersonalizada]);

  const extratorAtual = useMemo(
    () => (ehDimensaoPeriodo ? (r: LinhaBase) => periodoRef(dataOf(r), periodoGranularidade) : dimensaoAtual.extrator),
    [ehDimensaoPeriodo, dimensaoAtual, periodoGranularidade]
  );

  const resultado = useMemo(() => {
    const grupos = new Map<string, LinhaBase[]>();
    for (const r of dadosFiltradosPorPeriodo) {
      const chave = extratorAtual(r);
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
  }, [dadosFiltradosPorPeriodo, extratorAtual, metricasAtuais, metricaOrdenacao]);

  const dadosGrafico = resultado.slice(0, 25).map((r, i) => ({ chave: r.chave, cor: CORES[i % CORES.length], ...r.valores }));

  const totalizadores = useMemo(() => {
    if (metricasAtuais.length === 0 || dadosFiltradosPorPeriodo.length === 0 || resultado.length === 0) return null;
    const totalGeral: Record<string, number> = {};
    for (const m of metricasAtuais) totalGeral[m.id] = m.calcular(dadosFiltradosPorPeriodo);
    const mediaPorGrupo: Record<string, number> = {};
    for (const m of metricasAtuais) mediaPorGrupo[m.id] = totalGeral[m.id] / resultado.length;
    return { totalGeral, mediaPorGrupo, totalRegistros: dadosFiltradosPorPeriodo.length };
  }, [dadosFiltradosPorPeriodo, metricasAtuais, resultado.length]);

  function trocarFonte(novaFonte: Fonte) {
    setFonte(novaFonte);
    setDimensaoId(DIMENSOES[novaFonte][0].id);
    setMetricaIds([METRICAS[novaFonte][0].id]);
  }

  function toggleMetrica(id: string) {
    setMetricaIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  const formatterTooltip = (value: number, name: string) => {
    const m = metricasAtuais.find((x) => x.label === name) ?? metricaOrdenacao;
    return [formatarValor(value, m.formato), m.label];
  };

  async function capturarGraficoComoImagem(): Promise<string | null> {
    const svg = chartWrapRef.current?.querySelector("svg");
    if (!svg) return null;
    try {
      const { width, height } = svg.getBoundingClientRect();
      if (!width || !height) return null;
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const svgString = new XMLSerializer().serializeToString(clone);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

      const ESCALA = 2;
      return await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width * ESCALA;
          canvas.height = height * ESCALA;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
        img.src = svgDataUrl;
      });
    } catch (e) {
      console.error("[RelatoriosPersonalizadosPosto] falha ao capturar gráfico para o PDF:", e);
      return null;
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg bg-gradient-to-r from-indigo-950 to-indigo-600 p-5">
        <p className="text-base font-semibold text-white">🗂️ Relatórios Personalizados</p>
        <p className="text-sm text-white/70">Combine fonte, dimensão, uma ou mais métricas e tipo de gráfico — exporte em CSV ou PDF.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Período dos dados</label>
          <select
            value={periodoPreset}
            onChange={(e) => setPeriodoPreset(e.target.value as PeriodoPreset)}
            className="input text-sm"
          >
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="15d">Últimos 15 dias</option>
            <option value="mes">Últimos 30 dias</option>
            <option value="12m">Últimos 12 meses (padrão)</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        {periodoPreset === "personalizado" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">De</label>
              <input
                type="date"
                value={dataInicioPersonalizada}
                onChange={(e) => setDataInicioPersonalizada(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Até</label>
              <input
                type="date"
                value={dataFimPersonalizada}
                onChange={(e) => setDataFimPersonalizada(e.target.value)}
                className="input text-sm"
              />
            </div>
          </>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Fonte</label>
          <select value={fonte} onChange={(e) => trocarFonte(e.target.value as Fonte)} className="input text-sm">
            <option value="vendas">⛽ Vendas</option>
            <option value="financeiro">🏦 Financeiro (Receber/Pagar)</option>
            <option value="notas_fiscais">🧾 Notas Fiscais</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Dimensão</label>
          <select value={dimensaoAtual.id} onChange={(e) => setDimensaoId(e.target.value)} className="input text-sm">
            {dimensoesDisponiveis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          {ehDimensaoPeriodo && (
            <select
              value={periodoGranularidade}
              onChange={(e) => setPeriodoGranularidade(e.target.value as Granularidade)}
              className="input mt-1.5 text-sm"
            >
              <option value="dia">Agrupar por dia</option>
              <option value="semana">Agrupar por semana</option>
              <option value="quinzena">Agrupar por quinzena</option>
              <option value="mes">Agrupar por mês</option>
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Métricas</label>
          <SeletorMetricas opcoes={metricasDisponiveis} selecionadas={metricaIds} onToggle={toggleMetrica} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Gráfico</label>
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
          Nenhum dado de {FONTE_LABEL[fonte].toLowerCase()} encontrado no período (últimos 12 meses).
        </p>
      ) : dadosFiltradosPorPeriodo.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum registro no período selecionado — ajuste o filtro acima.</p>
      ) : resultado.length === 0 || metricasAtuais.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum resultado para essa combinação de dimensão/métrica.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {metricasAtuais.map((m) => m.label).join(", ")} por {dimensaoLabelAtual.toLowerCase()} — {resultado.length} grupo(s)
              {resultado.length > 25 ? " (mostrando os 25 maiores no gráfico)" : ""}
            </p>
            <button
              type="button"
              onClick={() =>
                baixarCsv(
                  `relatorio_posto_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.csv`,
                  [dimensaoLabelAtual, ...metricasAtuais.map((m) => m.label), "Nº de registros"],
                  [
                    ...resultado.map((r) => [r.chave, ...metricasAtuais.map((m) => formatarValor(r.valores[m.id] ?? 0, m.formato)), r.qtdLinhas]),
                    ...(totalizadores
                      ? [
                          [
                            "Total geral",
                            ...metricasAtuais.map((m) => formatarValor(totalizadores.totalGeral[m.id] ?? 0, m.formato)),
                            totalizadores.totalRegistros,
                          ],
                          [
                            `Média por grupo (${resultado.length})`,
                            ...metricasAtuais.map((m) => formatarValor(totalizadores.mediaPorGrupo[m.id] ?? 0, m.formato)),
                            "",
                          ],
                        ]
                      : []),
                  ]
                )
              }
              className="btn-secondary text-sm"
            >
              ⬇️ Exportar CSV
            </button>
            <BotaoBaixarPdfPersonalizadoLazy
              nomeArquivo={`relatorio_personalizado_posto_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.pdf`}
              nomeEmpresa={nomeEmpresa}
              titulo={`${metricasAtuais.map((m) => m.label).join(", ")} por ${dimensaoLabelAtual}`}
              subtitulo={`Fonte: ${FONTE_LABEL[fonte]} · Agrupado por ${dimensaoLabelAtual.toLowerCase()} · ${resultado.length} grupo(s)`}
              fonteLabel={FONTE_LABEL[fonte]}
              dimensaoLabel={dimensaoLabelAtual}
              metricasLabels={metricasAtuais.map((m) => m.label)}
              nomeUsuario={nomeUsuario}
              cargoUsuario={cargoUsuario}
              capturarGrafico={capturarGraficoComoImagem}
              colunaChave={dimensaoLabelAtual}
              colunas={metricasAtuais.map((m) => ({ id: m.id, label: m.label }))}
              linhas={[
                ...resultado.map((r) => ({
                  chave: r.chave,
                  valores: metricasAtuais.map((m) => formatarValor(r.valores[m.id] ?? 0, m.formato)),
                  registros: String(r.qtdLinhas),
                })),
                ...(totalizadores
                  ? [
                      {
                        chave: "Total geral",
                        valores: metricasAtuais.map((m) => formatarValor(totalizadores.totalGeral[m.id] ?? 0, m.formato)),
                        registros: String(totalizadores.totalRegistros),
                      },
                      {
                        chave: `Média por grupo (${resultado.length})`,
                        valores: metricasAtuais.map((m) => formatarValor(totalizadores.mediaPorGrupo[m.id] ?? 0, m.formato)),
                        registros: "",
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {tipoGrafico === "pie" && metricasAtuais.length > 1 && (
            <p className="mb-2 text-xs text-slate-400">
              O gráfico de pizza mostra apenas a 1ª métrica selecionada ({metricaOrdenacao.label}) — as demais continuam na
              tabela e no CSV abaixo.
            </p>
          )}

          {tipoGrafico === "table" ? null : (
            <div ref={chartWrapRef}>
            <ResponsiveContainer width="100%" height={tipoGrafico === "bar_h" ? Math.max(220, dadosGrafico.length * 36) : 320}>
              {tipoGrafico === "pie" ? (
                <PieChart>
                  <Pie data={dadosGrafico} dataKey={metricaOrdenacao.id} nameKey="chave" outerRadius={110} label={(e) => e.chave}>
                    {dadosGrafico.map((d) => (
                      <Cell key={d.chave} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarValor(v, metricaOrdenacao.formato)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: corEixo }} />
                </PieChart>
              ) : tipoGrafico === "line" ? (
                <LineChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
                  <XAxis dataKey="chave" tick={{ fontSize: 11, fill: corEixo }} />
                  <YAxis tick={{ fontSize: 12, fill: corEixo }} />
                  <Tooltip formatter={formatterTooltip} contentStyle={tooltipStyle} />
                  {metricasAtuais.length > 1 && <Legend wrapperStyle={{ color: corEixo }} />}
                  {metricasAtuais.map((m, i) => (
                    <Line key={m.id} type="monotone" dataKey={m.id} name={m.label} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              ) : tipoGrafico === "bar_h" ? (
                <BarChart
                  data={dadosGrafico}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: corEixo }} />
                  <YAxis
                    type="category"
                    dataKey="chave"
                    width={190}
                    tick={{ fontSize: 11, fill: corEixo }}
                    tickFormatter={(chave: string) => formatarNomeEixoGrafico(chave)}
                    interval={0}
                  />
                  <Tooltip formatter={formatterTooltip} labelFormatter={(chave: string) => chave} contentStyle={tooltipStyle} />
                  {metricasAtuais.length > 1 && <Legend wrapperStyle={{ color: corEixo }} />}
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
                  <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
                  <XAxis dataKey="chave" tick={{ fontSize: 11, fill: corEixo }} />
                  <YAxis tick={{ fontSize: 12, fill: corEixo }} />
                  <Tooltip formatter={formatterTooltip} contentStyle={tooltipStyle} />
                  {metricasAtuais.length > 1 && <Legend wrapperStyle={{ color: corEixo }} />}
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
            </div>
          )}

          <div className="mt-4 max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">{dimensaoLabelAtual}</th>
                  {metricasAtuais.map((m) => (
                    <th key={m.id} className="py-2 pr-3">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2">Registros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {resultado.map((r) => (
                  <tr key={r.chave} className="transition-colors hover:bg-frota-50/60">
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{r.chave}</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatarValor(r.valores[m.id] ?? 0, m.formato)}
                      </td>
                    ))}
                    <td className="py-2 tabular-nums text-slate-500 dark:text-slate-400">{r.qtdLinhas}</td>
                  </tr>
                ))}
              </tbody>
              {totalizadores && (
                <tfoot className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">Total geral</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatarValor(totalizadores.totalGeral[m.id] ?? 0, m.formato)}
                      </td>
                    ))}
                    <td className="py-2 tabular-nums font-semibold text-slate-700 dark:text-slate-300">{totalizadores.totalRegistros}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">Média por grupo ({resultado.length})</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {formatarValor(totalizadores.mediaPorGrupo[m.id] ?? 0, m.formato)}
                      </td>
                    ))}
                    <td className="py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
