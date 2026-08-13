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
  municipioPosto: string | null;
  hodometro: number | null;
  data: string | null;
  meioPagamento: string | null;
  tipoVeiculo: string | null;
  marcaVeiculo: string | null;
  modeloVeiculo: string | null;
  classificacaoVeiculo: string | null;
  centroCusto: string | null;
};

export type ManutencaoBruto = {
  placa: string | null;
  oficina: string | null;
  custoTotal: number | null;
  data: string | null;
  origem: string | null;
  tecnico: string | null;
  centroCusto: string | null;
};

export type CustoFixoBruto = {
  placa: string | null;
  tipo: string | null;
  descricao: string | null;
  valor: number | null;
  data: string | null;
  dataLancamento: string | null;
  recorrente: boolean | null;
  origem: string | null;
  centroCusto: string | null;
};

// Fase relatorios-mais-dimensoes (29/07/2026, pedido do Daniel: "relatórios
// personalizados está com poucas dimensões e variáveis, traga mais
// sugestões") — 5 fontes novas, cada uma espelhando o mesmo padrão das 3
// originais (RPC "bruto" filtrada por empresa/período, mapeada em
// relatorios/page.tsx). Ver comentário completo nas migrações
// relatorio_*_bruto.
export type NotaFiscalBruto = {
  produto: string | null;
  nomePosto: string | null;
  cnpjPosto: string | null;
  numeroNf: number | null;
  quantidade: number | null;
  valorTotal: number | null;
  valorUnitario: number | null;
  data: string | null;
};

export type FreteBruto = {
  titulo: string | null;
  status: string | null;
  tipoCarga: string | null;
  ufOrigem: string | null;
  ufDestino: string | null;
  motorista: string | null;
  valorOferecido: number | null;
  kmEstimado: number | null;
  pesoCargaKg: number | null;
  data: string | null;
};

export type FinanceiroBruto = {
  movimento: string | null;
  status: string | null;
  contraparte: string | null;
  origem: string | null;
  valorOriginal: number | null;
  valorPago: number | null;
  data: string | null;
};

export type AcaoSugeridaBruto = {
  tipo: string | null;
  severidade: string | null;
  status: string | null;
  alvoLabel: string | null;
  data: string | null;
};

export type ChamadoBruto = {
  tipo: string | null;
  prioridade: string | null;
  status: string | null;
  data: string | null;
};

export type AvaliacaoBruto = {
  estrelas: number | null;
  temComentario: boolean | null;
  data: string | null;
};

type Fonte =
  | "abastecimentos"
  | "manutencao"
  | "custos_fixos"
  | "notas_fiscais"
  | "fretes"
  | "financeiro"
  | "acoes_sugeridas"
  | "chamados"
  | "avaliacoes";
type LinhaBase =
  | AbastecimentoBruto
  | ManutencaoBruto
  | CustoFixoBruto
  | NotaFiscalBruto
  | FreteBruto
  | FinanceiroBruto
  | AcaoSugeridaBruto
  | ChamadoBruto
  | AvaliacaoBruto;
type Formato = "int" | "dec" | "money" | "money3";
type Metrica = { id: string; label: string; formato: Formato; calcular: (linhas: LinhaBase[]) => number };

const CORES = ["#1565C0", "#E65100", "#2E7D32", "#6A1B9A", "#B71C1C", "#00838F", "#F9A825", "#4527A0"];

const FONTE_LABEL: Record<Fonte, string> = {
  abastecimentos: "Abastecimentos",
  manutencao: "Manutenção",
  custos_fixos: "Custos Fixos",
  notas_fiscais: "Notas Fiscais",
  fretes: "Fretes",
  financeiro: "Financeiro (Contas a Receber/Pagar)",
  acoes_sugeridas: "Ações Sugeridas",
  chamados: "Chamados",
  avaliacoes: "Avaliações",
};

function mesRef(data: string | null) {
  if (!data) return "—";
  return data.slice(0, 7); // YYYY-MM
}

// Fase filtro-periodo-relatorios (27/07/2026, pedido do Daniel: "poderia dar
// a opção de dias, semana, quinzena, mes e personalizado para que o usuario
// escolha o periodo desejado do relatorio") — duas coisas independentes:
// (1) GRANULARIDADE de agrupamento da dimensão "Período" (dia/semana/
// quinzena/mês, ver periodoRef abaixo) e (2) um FILTRO de intervalo de
// datas que reduz quais linhas entram no relatório antes de agrupar (ver
// calcularIntervaloPeriodo). Os dois usam o mesmo campo "data", presente em
// igual formato (YYYY-MM-DD ou timestamp começando assim) nos 3 tipos de
// linha — por isso dataOf() é genérico em vez de repetir o cast por fonte.
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

// Rótulo de agrupamento por período, de acordo com a granularidade
// escolhida. "Semana" usa a segunda-feira daquela semana como referência;
// "quinzena" divide o mês em 1-15 e 16-fim.
function periodoRef(dataIso: string | null, gran: Granularidade): string {
  if (!dataIso) return "—";
  const iso = dataIso.slice(0, 10);
  if (gran === "dia") return iso;
  if (gran === "mes") return iso.slice(0, 7);
  const d = new Date(`${iso}T00:00:00`);
  if (gran === "semana") {
    const diaSemana = (d.getDay() + 6) % 7; // 0 = segunda-feira
    const inicioSemana = new Date(d);
    inicioSemana.setDate(d.getDate() - diaSemana);
    return `Semana de ${inicioSemana.toLocaleDateString("pt-BR")}`;
  }
  const quinzena = d.getDate() <= 15 ? "1ª quinzena" : "2ª quinzena";
  return `${iso.slice(0, 7)} — ${quinzena}`;
}

// Converte o preset (ou as datas personalizadas) num intervalo [inicio, fim]
// em formato YYYY-MM-DD. "12m" devolve null/null — sem filtro adicional,
// mantém o comportamento padrão de sempre (usa tudo que já veio do
// servidor, que já busca só os últimos 365 dias, ver relatorios/page.tsx).
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

// Dimensões disponíveis por fonte — cada uma extrai a chave de agrupamento
// (usada tanto pra "group by" quanto pro rótulo mostrado no gráfico/tabela).
const DIMENSOES: Record<Fonte, { id: string; label: string; extrator: (r: LinhaBase) => string }[]> = {
  abastecimentos: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as AbastecimentoBruto).data) },
    { id: "produto", label: "Combustível", extrator: (r) => (r as AbastecimentoBruto).produto || "—" },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as AbastecimentoBruto).placa || "—" },
    { id: "motorista", label: "Motorista", extrator: (r) => (r as AbastecimentoBruto).motorista || "—" },
    { id: "nome_posto", label: "Posto", extrator: (r) => (r as AbastecimentoBruto).nomePosto || "—" },
    { id: "uf_posto", label: "Estado (UF)", extrator: (r) => (r as AbastecimentoBruto).ufPosto || "—" },
    { id: "municipio_posto", label: "Município do Posto", extrator: (r) => (r as AbastecimentoBruto).municipioPosto || "—" },
    { id: "meio_pagamento", label: "Meio de Pagamento", extrator: (r) => (r as AbastecimentoBruto).meioPagamento || "—" },
    { id: "tipo_veiculo", label: "Tipo de Veículo", extrator: (r) => (r as AbastecimentoBruto).tipoVeiculo || "—" },
    { id: "marca_veiculo", label: "Marca do Veículo", extrator: (r) => (r as AbastecimentoBruto).marcaVeiculo || "—" },
    // Achado real (30/07/2026): rótulo dizia "(Leve/Pesado)", mas o dado por
    // trás (relatorio_abastecimentos_bruto → v.classificacao) é Próprio/
    // Agregado — Leve/Pesado é outro campo (cadastro_veiculos.tipo), que essa
    // fonte de relatório nem expõe. Corrigido o rótulo pra bater com o dado.
    { id: "classificacao_veiculo", label: "Classificação (Próprio/Agregado)", extrator: (r) => (r as AbastecimentoBruto).classificacaoVeiculo || "—" },
    { id: "centro_custo", label: "Centro de Custo", extrator: (r) => (r as AbastecimentoBruto).centroCusto || "—" },
  ],
  manutencao: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as ManutencaoBruto).data) },
    { id: "placa", label: "Veículo (Placa)", extrator: (r) => (r as ManutencaoBruto).placa || "—" },
    { id: "oficina", label: "Oficina", extrator: (r) => (r as ManutencaoBruto).oficina || "—" },
    { id: "origem", label: "Origem", extrator: (r) => ((r as ManutencaoBruto).origem === "api" ? "Integração" : "Manual") },
    { id: "tecnico", label: "Técnico", extrator: (r) => (r as ManutencaoBruto).tecnico || "—" },
    { id: "centro_custo", label: "Centro de Custo", extrator: (r) => (r as ManutencaoBruto).centroCusto || "—" },
  ],
  custos_fixos: [
    { id: "periodo_mes", label: "Período (competência)", extrator: (r) => mesRef((r as CustoFixoBruto).data) },
    { id: "periodo_lancamento", label: "Período (lançamento)", extrator: (r) => mesRef((r as CustoFixoBruto).dataLancamento) },
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
    { id: "centro_custo", label: "Centro de Custo", extrator: (r) => (r as CustoFixoBruto).centroCusto || "—" },
    { id: "recorrente", label: "Recorrente?", extrator: (r) => ((r as CustoFixoBruto).recorrente ? "Sim" : "Não") },
  ],
  notas_fiscais: [
    { id: "periodo_mes", label: "Período (emissão)", extrator: (r) => mesRef((r as NotaFiscalBruto).data) },
    { id: "produto", label: "Produto (ANP)", extrator: (r) => (r as NotaFiscalBruto).produto || "—" },
    { id: "nome_posto", label: "Posto Emitente", extrator: (r) => (r as NotaFiscalBruto).nomePosto || "—" },
  ],
  fretes: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as FreteBruto).data) },
    { id: "status", label: "Status", extrator: (r) => (r as FreteBruto).status || "—" },
    { id: "tipo_carga", label: "Tipo de Carga", extrator: (r) => (r as FreteBruto).tipoCarga || "—" },
    { id: "uf_origem", label: "UF de Origem", extrator: (r) => (r as FreteBruto).ufOrigem || "—" },
    { id: "uf_destino", label: "UF de Destino", extrator: (r) => (r as FreteBruto).ufDestino || "—" },
    { id: "motorista", label: "Motorista", extrator: (r) => (r as FreteBruto).motorista || "—" },
  ],
  financeiro: [
    { id: "periodo_mes", label: "Período (vencimento)", extrator: (r) => mesRef((r as FinanceiroBruto).data) },
    { id: "movimento", label: "Movimento (Receber/Pagar)", extrator: (r) => (r as FinanceiroBruto).movimento || "—" },
    { id: "status", label: "Status", extrator: (r) => (r as FinanceiroBruto).status || "—" },
    { id: "contraparte", label: "Cliente/Fornecedor", extrator: (r) => (r as FinanceiroBruto).contraparte || "—" },
    { id: "origem", label: "Origem", extrator: (r) => (r as FinanceiroBruto).origem || "—" },
  ],
  acoes_sugeridas: [
    { id: "periodo_mes", label: "Período (detecção)", extrator: (r) => mesRef((r as AcaoSugeridaBruto).data) },
    { id: "tipo", label: "Tipo", extrator: (r) => (r as AcaoSugeridaBruto).tipo || "—" },
    { id: "severidade", label: "Severidade", extrator: (r) => (r as AcaoSugeridaBruto).severidade || "—" },
    { id: "status", label: "Status", extrator: (r) => (r as AcaoSugeridaBruto).status || "—" },
    { id: "alvo", label: "Alvo", extrator: (r) => (r as AcaoSugeridaBruto).alvoLabel || "—" },
  ],
  chamados: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as ChamadoBruto).data) },
    { id: "tipo", label: "Tipo", extrator: (r) => (r as ChamadoBruto).tipo || "—" },
    { id: "prioridade", label: "Prioridade", extrator: (r) => (r as ChamadoBruto).prioridade || "—" },
    { id: "status", label: "Status", extrator: (r) => (r as ChamadoBruto).status || "—" },
  ],
  avaliacoes: [
    { id: "periodo_mes", label: "Período", extrator: (r) => mesRef((r as AvaliacaoBruto).data) },
    { id: "estrelas", label: "Estrelas", extrator: (r) => String((r as AvaliacaoBruto).estrelas ?? "—") },
    { id: "tem_comentario", label: "Com comentário?", extrator: (r) => ((r as AvaliacaoBruto).temComentario ? "Sim" : "Não") },
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
  notas_fiscais: [
    { id: "nf_valor", label: "Valor Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as NotaFiscalBruto).valorTotal || 0), 0) },
    { id: "nf_qtd", label: "Nº de Notas", formato: "int", calcular: (l) => l.length },
    { id: "nf_quantidade", label: "Quantidade Total (L)", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as NotaFiscalBruto).quantidade || 0), 0) },
    {
      id: "nf_valor_unit_med",
      label: "Valor Unitário Médio (R$/L)",
      formato: "money3",
      calcular: (l) => {
        const validos = l.filter((r) => ((r as NotaFiscalBruto).valorUnitario || 0) > 0);
        return validos.length ? validos.reduce((s, r) => s + ((r as NotaFiscalBruto).valorUnitario || 0), 0) / validos.length : 0;
      },
    },
  ],
  fretes: [
    { id: "fr_qtd", label: "Nº de Fretes", formato: "int", calcular: (l) => l.length },
    { id: "fr_valor", label: "Valor Ofertado Total (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as FreteBruto).valorOferecido || 0), 0) },
    {
      id: "fr_valor_med",
      label: "Valor Ofertado Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as FreteBruto).valorOferecido || 0), 0) / l.length : 0),
    },
    { id: "fr_km", label: "Km Estimado Total", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as FreteBruto).kmEstimado || 0), 0) },
    { id: "fr_peso", label: "Peso da Carga Total (kg)", formato: "dec", calcular: (l) => l.reduce((s, r) => s + ((r as FreteBruto).pesoCargaKg || 0), 0) },
  ],
  financeiro: [
    { id: "fin_valor_orig", label: "Valor Original (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as FinanceiroBruto).valorOriginal || 0), 0) },
    { id: "fin_valor_pago", label: "Valor Pago (R$)", formato: "money", calcular: (l) => l.reduce((s, r) => s + ((r as FinanceiroBruto).valorPago || 0), 0) },
    { id: "fin_qtd", label: "Nº de Lançamentos", formato: "int", calcular: (l) => l.length },
    {
      id: "fin_valor_med",
      label: "Valor Médio (R$)",
      formato: "money",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as FinanceiroBruto).valorOriginal || 0), 0) / l.length : 0),
    },
  ],
  acoes_sugeridas: [{ id: "as_qtd", label: "Nº de Ações", formato: "int", calcular: (l) => l.length }],
  chamados: [{ id: "ch_qtd", label: "Nº de Chamados", formato: "int", calcular: (l) => l.length }],
  avaliacoes: [
    { id: "av_qtd", label: "Nº de Avaliações", formato: "int", calcular: (l) => l.length },
    {
      id: "av_nota_media",
      label: "Nota Média (estrelas)",
      formato: "dec",
      calcular: (l) => (l.length ? l.reduce((s, r) => s + ((r as AvaliacaoBruto).estrelas || 0), 0) / l.length : 0),
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
  notasFiscais,
  fretes,
  financeiro,
  acoesSugeridas,
  chamados,
  avaliacoes,
  nomeEmpresa,
  nomeUsuario,
  cargoUsuario,
}: {
  abastecimentos: AbastecimentoBruto[];
  manutencoes: ManutencaoBruto[];
  custosFixos: CustoFixoBruto[];
  notasFiscais: NotaFiscalBruto[];
  fretes: FreteBruto[];
  financeiro: FinanceiroBruto[];
  acoesSugeridas: AcaoSugeridaBruto[];
  chamados: ChamadoBruto[];
  avaliacoes: AvaliacaoBruto[];
  nomeEmpresa: string;
  nomeUsuario: string;
  cargoUsuario: string | null;
}) {
  const [fonte, setFonte] = useState<Fonte>("abastecimentos");
  const [dimensaoId, setDimensaoId] = useState(DIMENSOES.abastecimentos[0].id);
  const [metricaIds, setMetricaIds] = useState<string[]>([METRICAS.abastecimentos[0].id]);
  const [tipoGrafico, setTipoGrafico] = useState<"bar" | "bar_h" | "line" | "pie" | "table">("bar");
  const [periodoGranularidade, setPeriodoGranularidade] = useState<Granularidade>("mes");
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("12m");
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState("");
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState("");
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const dimensoesDisponiveis = DIMENSOES[fonte];
  const metricasDisponiveis = METRICAS[fonte];
  const dimensaoAtual = dimensoesDisponiveis.find((d) => d.id === dimensaoId) ?? dimensoesDisponiveis[0];
  const metricasAtuais = metricasDisponiveis.filter((m) => metricaIds.includes(m.id));
  const metricaOrdenacao = metricasAtuais[0] ?? metricasDisponiveis[0];
  const ehDimensaoPeriodo = dimensaoAtual.id === "periodo_mes";
  // Rótulo mostrado de fato (na tela, no CSV e no PDF) — quando a dimensão é
  // "Período", inclui a granularidade escolhida (ex.: "Período (por semana)").
  const dimensaoLabelAtual = ehDimensaoPeriodo ? `Período (${GRANULARIDADE_LABEL[periodoGranularidade]})` : dimensaoAtual.label;

  // Fase relatorios-mais-dimensoes — trocado de ternário encadeado (só dava
  // conta de 3 fontes) por um mapa, agora que são 9. `useMemo` porque esse
  // objeto reconstrói um array novo por fonte a cada render.
  const dadosPorFonte: Record<Fonte, LinhaBase[]> = useMemo(
    () => ({
      abastecimentos,
      manutencao: manutencoes,
      custos_fixos: custosFixos,
      notas_fiscais: notasFiscais,
      fretes,
      financeiro,
      acoes_sugeridas: acoesSugeridas,
      chamados,
      avaliacoes,
    }),
    [abastecimentos, manutencoes, custosFixos, notasFiscais, fretes, financeiro, acoesSugeridas, chamados, avaliacoes]
  );
  const dadosBase: LinhaBase[] = dadosPorFonte[fonte];

  // Filtro de intervalo de datas — reduz as linhas ANTES de agrupar. "12m"
  // (padrão) não filtra nada, mantendo o comportamento de sempre (usa tudo
  // que a página já buscou do servidor, ver relatorios/page.tsx).
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

  // Fase totalizadores-relatorios (27/07/2026, pedido do Daniel: "totalizadores,
  // somas e medias, ao final de cada consulta") — o "total geral" é calculado
  // chamando m.calcular() direto sobre TODAS as linhas filtradas (não soma os
  // valores já agrupados), porque pra métricas que já são médias (Ticket
  // Médio, Preço Médio) somar os grupos daria um número sem sentido; chamando
  // de novo a mesma função de cálculo sobre o conjunto inteiro, o resultado é
  // sempre correto pra cada tipo de métrica. "Média por grupo" é só esse
  // total dividido pela quantidade de grupos exibidos.
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

  // Fase 27.33 — achado real: o PDF exportado só trazia a tabela de
  // resultados, nunca o gráfico (o comentário original do componente do PDF
  // dizia "recharts não renderiza dentro do @react-pdf/renderer" — verdade,
  // mas dá pra CAPTURAR o gráfico já desenhado na tela como imagem e
  // embutir essa imagem no PDF). O Recharts desenha em SVG puro dentro do
  // container (ver ref abaixo); no momento do clique em "Exportar PDF",
  // serializamos esse <svg>, desenhamos num <canvas> em memória (com fator
  // de escala pra ficar nítido) e convertemos pra PNG. Quando o tipo de
  // gráfico é "Tabela" não existe SVG pra capturar — a função simplesmente
  // devolve null e o PDF sai só com a tabela, como já acontecia antes.
  // Observação: a legenda do Recharts (usada quando 2+ métricas estão
  // selecionadas) é desenhada como HTML fora do <svg>, então não entra
  // nessa captura — os nomes das métricas continuam visíveis na tabela do
  // PDF logo abaixo do gráfico.
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

      const ESCALA = 2; // desenha em 2x pra não sair borrado no PDF
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
      console.error("[RelatoriosPersonalizados] falha ao capturar gráfico para o PDF:", e);
      return null;
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg bg-gradient-to-r from-indigo-950 to-indigo-600 p-5">
        <p className="text-base font-semibold text-white">🗂️ Relatórios Personalizados</p>
        <p className="text-sm text-white/70">Combine fonte, dimensão, uma ou mais métricas e tipo de gráfico — exporte em CSV.</p>
      </div>

      {/* Fase filtro-periodo-relatorios — atalhos de intervalo de datas (aplicados
          antes de agrupar) + campo "Personalizado" com data de início/fim. "Últimos
          12 meses" é o padrão e mantém o comportamento de sempre (usa tudo que já
          veio do servidor, sem filtro adicional). */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Período dos dados</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
              <input
                type="date"
                value={dataInicioPersonalizada}
                onChange={(e) => setDataInicioPersonalizada(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Fonte</label>
          <select value={fonte} onChange={(e) => trocarFonte(e.target.value as Fonte)} className="input text-sm">
            <option value="abastecimentos">⛽ Abastecimentos</option>
            <option value="manutencao">🔧 Manutenção</option>
            <option value="custos_fixos">💰 Custos Fixos</option>
            <option value="notas_fiscais">🧾 Notas Fiscais</option>
            <option value="fretes">🚚 Fretes</option>
            <option value="financeiro">🏦 Financeiro (Receber/Pagar)</option>
            <option value="acoes_sugeridas">💡 Ações Sugeridas</option>
            <option value="chamados">🎫 Chamados</option>
            <option value="avaliacoes">⭐ Avaliações</option>
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
          Nenhum dado de {FONTE_LABEL[fonte].toLowerCase()} encontrado no período (últimos 12 meses
          {fonte === "custos_fixos" ? ", e também os próximos 12" : ""}).
        </p>
      ) : dadosFiltradosPorPeriodo.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum registro no período selecionado — ajuste o filtro acima.</p>
      ) : resultado.length === 0 || metricasAtuais.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum resultado para essa combinação de dimensão/métrica.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {metricasAtuais.map((m) => m.label).join(", ")} por {dimensaoLabelAtual.toLowerCase()} — {resultado.length} grupo(s)
              {resultado.length > 25 ? " (mostrando os 25 maiores no gráfico)" : ""}
            </p>
            <button
              type="button"
              onClick={() =>
                baixarCsv(
                  `relatorio_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.csv`,
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
              nomeArquivo={`relatorio_personalizado_${fonte}_${dimensaoAtual.id}_${metricasAtuais.map((m) => m.id).join("-")}.pdf`}
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
            </div>
          )}

          <div className="mt-4 max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {resultado.map((r) => (
                  <tr key={r.chave} className="transition-colors hover:bg-frota-50/60">
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
              {/* Fase totalizadores-relatorios — total geral (soma/valor agregado real,
                  calculado sobre todas as linhas filtradas) e média por grupo exibido,
                  fixos ao fundo da tabela mesmo com rolagem (ver Fase totalizadores acima). */}
              {totalizadores && (
                <tfoot className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-800">Total geral</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums font-semibold text-slate-900">
                        {formatarValor(totalizadores.totalGeral[m.id] ?? 0, m.formato)}
                      </td>
                    ))}
                    <td className="py-2 tabular-nums font-semibold text-slate-700">{totalizadores.totalRegistros}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Média por grupo ({resultado.length})</td>
                    {metricasAtuais.map((m) => (
                      <td key={m.id} className="py-2 pr-3 tabular-nums text-slate-600">
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
