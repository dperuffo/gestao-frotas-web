"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarMoeda } from "@/lib/financeiro";

// Fase Plano-Graficos (05/09/2026, pedido do Daniel: "quero melhorar estes
// gráficos de indicadores" — bloco "Indicadores da frota (veículos)") —
// rankings dos veículos que mais precisam de atenção em cada indicador +
// composição do custo de manutenção, tudo a partir de `veiculosFiltrados`
// (RPC kpis_frota_por_veiculo) já carregado na página — sem query nova. Só
// faz sentido com 2+ veículos no filtro (ranking de 1 item não ajuda).
//
// Reformulação (05/09/2026, mesmo dia — pedido do Daniel: "não gostei da
// mistura de gráficos e dados abertos... reformulação pra facilitar
// leitura") — os 7 rankings ficaram poluídos numa tela que já tem muito
// gráfico. Agora só os 3 mais críticos aparecem (prop `destaques`,
// calculada em page.tsx por severidade Crítico/Atenção/Bom de cada
// categoria) — os outros 4 somem até precisarem de atenção.

export type ItemRankingVeiculo = { placa: string; valor: number };
export type CategoriaRankingVeiculo =
  | "disponibilidade"
  | "cpk"
  | "consumo"
  | "utilizacao"
  | "conformidade"
  | "tmrnc"
  | "sinistros";

function MiniRanking({
  titulo,
  dados,
  formatarValor,
  corBarra = CORES_GRAFICO.primaria,
  semDadosTexto = "Sem dados no período.",
}: {
  titulo: string;
  dados: ItemRankingVeiculo[];
  formatarValor: (v: number) => string;
  corBarra?: string;
  semDadosTexto?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">{titulo}</p>
      {dados.length === 0 ? (
        <p className="text-sm text-slate-400">{semDadosTexto}</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, dados.length * 28)}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => formatarValor(v)} />
            <Bar dataKey="valor" name="Valor" fill={corBarra} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function GraficoIndicadoresVeiculos({
  destaques,
  rankingDisponibilidade,
  rankingCpk,
  rankingConsumo,
  rankingUtilizacao,
  rankingConformidade,
  rankingTmrnc,
  rankingSinistros,
  composicaoManutencao,
}: {
  destaques: CategoriaRankingVeiculo[];
  rankingDisponibilidade: ItemRankingVeiculo[];
  rankingCpk: ItemRankingVeiculo[];
  rankingConsumo: ItemRankingVeiculo[];
  rankingUtilizacao: ItemRankingVeiculo[];
  rankingConformidade: ItemRankingVeiculo[];
  rankingTmrnc: ItemRankingVeiculo[];
  rankingSinistros: ItemRankingVeiculo[];
  composicaoManutencao: { preventiva: number; corretiva: number; naoClassificada: number };
}) {
  const { preventiva, corretiva, naoClassificada } = composicaoManutencao;
  const totalManutencao = preventiva + corretiva + naoClassificada;
  const dadosManutencao = [
    { label: "Preventiva", valor: preventiva, cor: "#16A34A" },
    { label: "Corretiva", valor: corretiva, cor: "#dc2626" },
    { label: "Não classificada", valor: naoClassificada, cor: CORES_GRAFICO.neutro },
  ].filter((d) => d.valor > 0);

  const config: Record<
    CategoriaRankingVeiculo,
    { titulo: string; dados: ItemRankingVeiculo[]; formatarValor: (v: number) => string; corBarra: string; semDadosTexto?: string }
  > = {
    disponibilidade: {
      titulo: "Menor disponibilidade (piores)",
      dados: rankingDisponibilidade,
      formatarValor: (v) => `${v}%`,
      corBarra: "#dc2626",
    },
    cpk: {
      titulo: "Maior custo por km (CPK)",
      dados: rankingCpk,
      formatarValor: (v) => formatarMoeda(v),
      corBarra: "#dc2626",
    },
    consumo: {
      titulo: "Menor consumo (km/l)",
      dados: rankingConsumo,
      formatarValor: (v) => `${v} km/l`,
      corBarra: "#F59E0B",
    },
    utilizacao: {
      titulo: "Menor taxa de utilização",
      dados: rankingUtilizacao,
      formatarValor: (v) => `${v}%`,
      corBarra: "#F59E0B",
    },
    conformidade: {
      titulo: "Menor conformidade (checklist)",
      dados: rankingConformidade,
      formatarValor: (v) => `${v}%`,
      corBarra: "#dc2626",
      semDadosTexto: "Sem inspeções no período.",
    },
    tmrnc: {
      titulo: "Maior tempo de resolução (TMRNC)",
      dados: rankingTmrnc,
      formatarValor: (v) => `${v}h`,
      corBarra: "#F59E0B",
      semDadosTexto: "Sem pendências resolvidas.",
    },
    sinistros: {
      titulo: "Mais sinistros no período",
      dados: rankingSinistros,
      formatarValor: (v) => `${v} sinistro${v === 1 ? "" : "s"}`,
      corBarra: "#dc2626",
      semDadosTexto: "Sem sinistros no período.",
    },
  };

  const categoriasVisiveis = destaques.filter((chave) => config[chave].dados.length > 0);

  if (categoriasVisiveis.length === 0 && dadosManutencao.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        Veículos que mais precisam de atenção
      </p>
      <div className="card mb-6 grid gap-6 p-5 sm:grid-cols-2">
        {categoriasVisiveis.map((chave) => (
          <MiniRanking key={chave} {...config[chave]} />
        ))}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Composição do custo de manutenção</p>
          {dadosManutencao.length === 0 ? (
            <p className="text-sm text-slate-400">Sem manutenções classificadas no período.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div style={{ width: 110, height: 110 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosManutencao} dataKey="valor" nameKey="label" innerRadius={28} outerRadius={50} paddingAngle={2}>
                      {dadosManutencao.map((d) => (
                        <Cell key={d.label} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {dadosManutencao.map((d) => (
                  <li key={d.label} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.cor }} aria-hidden="true" />
                    <span className="text-slate-600">{d.label}</span>
                    <span className="ml-auto font-medium text-slate-900">
                      {totalManutencao > 0 ? Math.round((d.valor / totalManutencao) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
