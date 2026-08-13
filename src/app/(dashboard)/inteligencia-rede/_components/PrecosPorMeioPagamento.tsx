"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from "recharts";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Droplet, Wallet, ClipboardList, Trophy } from "lucide-react";

// Fase Inteligência-Rede-Meios-Pagamento — pedido do Daniel: "Criar um
// painel de preços médios com os preços praticados nos abastecimentos nos
// diversos meios de pagamento. Variações entre os meios de pagamentos,
// variações por Estado e por Região, indicadores de desempenho de meios de
// pagamento. Onde é mais vantajoso e com qual meio de pagamento... inserir
// os indicadores de volumes por combustível, pois os preços médios podem
// variar em função do volume transacionado por combustível".
//
// "Meio de pagamento" = abastecimentos_unificado.provedor (achado: os
// valores reais já são cartões/redes de combustível — profrotas,
// TicketLog, Valecard, Veloe, RedeFrota — não existe outra coluna de forma
// de pagamento no schema). Dado vem granular por
// provedor+uf+regiao+combustivel (RPC preco_medio_por_meio_pagamento) e
// toda a agregação (por provedor, por combustível, por UF, por região,
// cruzamentos) acontece aqui no cliente — mesmo padrão já usado em
// CruzamentosAvancados/ModoComparativo desta mesma tela.

export type ItemPrecoMeioPagamento = {
  provedor: string;
  uf: string | null;
  regiao: string | null;
  combustivel: string;
  precoMedio: number;
  litrosTotal: number;
  valorTotal: number;
  qtd: number;
};

const CORES = ["#0D47A1", "#B71C1C", "#2E7D32", "#F57F17", "#6A1B9A", "#00838F", "#5D4037"];

function formatarMoeda3(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatarInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function formatarLitros(v: number) {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`;
}

type Agregado = { chave: string; litros: number; valor: number; qtd: number; precoMedio: number };

function agregarPor<T extends ItemPrecoMeioPagamento>(itens: T[], chaveFn: (i: T) => string | null): Agregado[] {
  const mapa = new Map<string, { litros: number; valor: number; qtd: number }>();
  for (const i of itens) {
    const chave = chaveFn(i);
    if (chave == null) continue;
    const atual = mapa.get(chave) ?? { litros: 0, valor: 0, qtd: 0 };
    atual.litros += i.litrosTotal;
    atual.valor += i.valorTotal;
    atual.qtd += i.qtd;
    mapa.set(chave, atual);
  }
  return Array.from(mapa.entries()).map(([chave, v]) => ({
    chave,
    litros: v.litros,
    valor: v.valor,
    qtd: v.qtd,
    precoMedio: v.litros > 0 ? v.valor / v.litros : 0,
  }));
}

export function PrecosPorMeioPagamento({ dados }: { dados: ItemPrecoMeioPagamento[] }) {
  const [modoGeo, setModoGeo] = useState<"estado" | "regiao">("estado");
  const combustiveisDisponiveis = useMemo(
    () => Array.from(new Set(dados.map((d) => d.combustivel))).sort(),
    [dados]
  );
  const [combustivelFiltro, setCombustivelFiltro] = useState<string>("__todos__");

  const litrosTotal = dados.reduce((s, d) => s + d.litrosTotal, 0);
  const valorTotal = dados.reduce((s, d) => s + d.valorTotal, 0);
  const qtdTotal = dados.reduce((s, d) => s + d.qtd, 0);

  const porProvedor = useMemo(
    () =>
      agregarPor(dados, (i) => i.provedor)
        .map((a) => ({ provedor: a.chave, ...a }))
        .sort((a, b) => a.precoMedio - b.precoMedio),
    [dados]
  );

  const porCombustivel = useMemo(
    () =>
      agregarPor(dados, (i) => i.combustivel)
        .map((a) => ({ combustivel: a.chave, ...a }))
        .sort((a, b) => b.litros - a.litros),
    [dados]
  );

  const maisVantajoso = porProvedor[0];
  const menosVantajoso = porProvedor[porProvedor.length - 1];

  // Cruzamento Provedor × Combustível — variação entre meios de pagamento
  // por tipo de combustível (uma linha por combustível, uma coluna por
  // provedor).
  const provedoresDisponiveis = useMemo(() => Array.from(new Set(dados.map((d) => d.provedor))).sort(), [dados]);
  const cruzamento = useMemo(() => {
    const mapa = new Map<string, Map<string, Agregado>>();
    for (const combustivel of combustiveisDisponiveis) {
      const porProv = agregarPor(
        dados.filter((d) => d.combustivel === combustivel),
        (i) => i.provedor
      );
      mapa.set(combustivel, new Map(porProv.map((p) => [p.chave, p])));
    }
    return mapa;
  }, [dados, combustiveisDisponiveis]);

  // Onde é mais vantajoso — por Estado ou Região, filtrado por combustível
  // (misturar combustíveis diferentes no "melhor preço" não faz sentido
  // econômico, já que o preço por litro varia estruturalmente entre eles).
  const itensGeoFiltrados = useMemo(
    () => (combustivelFiltro === "__todos__" ? dados : dados.filter((d) => d.combustivel === combustivelFiltro)),
    [dados, combustivelFiltro]
  );

  const rankingGeo = useMemo(() => {
    const chaveGeo = (i: ItemPrecoMeioPagamento) => (modoGeo === "estado" ? i.uf : i.regiao);
    const locais = Array.from(new Set(itensGeoFiltrados.map(chaveGeo).filter((v): v is string => v != null)));
    return locais
      .map((local) => {
        const porProv = agregarPor(
          itensGeoFiltrados.filter((i) => chaveGeo(i) === local),
          (i) => i.provedor
        ).sort((a, b) => a.precoMedio - b.precoMedio);
        if (porProv.length === 0) return null;
        const melhor = porProv[0];
        const pior = porProv[porProv.length - 1];
        const economiaPct = pior.precoMedio > 0 ? ((pior.precoMedio - melhor.precoMedio) / pior.precoMedio) * 100 : 0;
        return {
          local,
          melhorProvedor: melhor.chave,
          precoMelhor: melhor.precoMedio,
          piorProvedor: pior.chave,
          precoPior: pior.precoMedio,
          economiaPct,
          qtdMeios: porProv.length,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => b.economiaPct - a.economiaPct);
  }, [itensGeoFiltrados, modoGeo]);

  if (dados.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum abastecimento com meio de pagamento identificado ainda.</p>;
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IndicadorColorido cor="sky" icon={Droplet} label="Volume total" valor={formatarLitros(litrosTotal)} />
        <IndicadorColorido
          cor="violet"
          icon={Wallet}
          label="Valor total"
          valor={valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
        <IndicadorColorido cor="amber" icon={ClipboardList} label="Abastecimentos" valor={formatarInt(qtdTotal)} />
        {maisVantajoso && (
          <IndicadorColorido
            cor="green"
            icon={Trophy}
            label="Meio mais vantajoso"
            valor={maisVantajoso.provedor}
            sub={formatarMoeda3(maisVantajoso.precoMedio) + "/L (média geral)"}
          />
        )}
      </div>

      <div className="mb-6 card p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">⛽ Volume por combustível</h3>
        <p className="mb-3 text-xs text-slate-400">
          Litros transacionados por tipo de combustível — o preço médio de cada meio de pagamento pode variar
          conforme o mix de combustível que passa por ele.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porCombustivel} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="combustivel" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k L`} />
            <Tooltip formatter={(v: number) => formatarLitros(v)} />
            <Bar dataKey="litros" radius={[4, 4, 0, 0]}>
              {porCombustivel.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 card p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">💳 Preço médio por meio de pagamento</h3>
        <p className="mb-3 text-xs text-slate-400">
          Média ponderada por litro (todos os combustíveis), do mais em conta ao mais caro.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(200, porProvedor.length * 45)}>
          <BarChart data={porProvedor} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <YAxis type="category" dataKey="provedor" width={100} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => formatarMoeda3(v)} />
            <Bar dataKey="precoMedio" radius={[0, 4, 4, 0]}>
              {porProvedor.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Meio de pagamento</th>
                <th className="py-2 pr-3">Preço médio</th>
                <th className="py-2 pr-3">Volume</th>
                <th className="py-2 pr-3">Valor total</th>
                <th className="py-2">Abastecimentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porProvedor.map((p) => (
                <tr key={p.provedor}>
                  <td className="py-2 pr-3 text-slate-700">{p.provedor}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {formatarMoeda3(p.precoMedio)}
                    {maisVantajoso && p.provedor === maisVantajoso.provedor && (
                      <span className="ml-1 badge-ativo">mais vantajoso</span>
                    )}
                    {menosVantajoso && p.provedor === menosVantajoso.provedor && porProvedor.length > 1 && (
                      <span className="ml-1 badge-atencao">mais caro</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarLitros(p.litros)}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">
                    {p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="py-2 tabular-nums text-slate-600">{formatarInt(p.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 card overflow-x-auto p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Preço médio por combustível × meio de pagamento</h3>
        <p className="mb-3 text-xs text-slate-400">
          Variação de preço entre os meios de pagamento, separado por tipo de combustível.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Combustível</th>
              {provedoresDisponiveis.map((p) => (
                <th key={p} className="py-2 pr-3">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {combustiveisDisponiveis.map((combustivel) => {
              const linha = cruzamento.get(combustivel);
              const valores = provedoresDisponiveis.map((p) => linha?.get(p)?.precoMedio).filter((v): v is number => v != null);
              const menor = valores.length > 0 ? Math.min(...valores) : null;
              return (
                <tr key={combustivel}>
                  <td className="py-2 pr-3 text-slate-700">{combustivel}</td>
                  {provedoresDisponiveis.map((p) => {
                    const v = linha?.get(p)?.precoMedio;
                    return (
                      <td key={p} className={`py-2 pr-3 tabular-nums ${v != null && v === menor ? "font-semibold text-emerald-700" : "text-slate-600"}`}>
                        {v != null ? formatarMoeda3(v) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Onde é mais vantajoso e com qual meio de pagamento</h3>
        <p className="mb-3 text-xs text-slate-400">
          Por {modoGeo === "estado" ? "estado" : "região"}, o meio de pagamento mais barato vs. o mais caro (para o
          combustível selecionado).
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setModoGeo("estado")}
              className={`rounded-full px-3 py-1 ${modoGeo === "estado" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              🗺️ Estados
            </button>
            <button
              type="button"
              onClick={() => setModoGeo("regiao")}
              className={`rounded-full px-3 py-1 ${modoGeo === "regiao" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              🌎 Regiões
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
            <select value={combustivelFiltro} onChange={(e) => setCombustivelFiltro(e.target.value)} className="input text-sm">
              <option value="__todos__">Todos os combustíveis</option>
              {combustiveisDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rankingGeo.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{modoGeo === "estado" ? "UF" : "Região"}</th>
                  <th className="py-2 pr-3">Mais vantajoso</th>
                  <th className="py-2 pr-3">Preço</th>
                  <th className="py-2 pr-3">Mais caro</th>
                  <th className="py-2 pr-3">Preço</th>
                  <th className="py-2">Economia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingGeo.map((r) => (
                  <tr key={r.local}>
                    <td className="py-2 pr-3 text-slate-700">{r.local}</td>
                    <td className="py-2 pr-3 text-emerald-700">{r.melhorProvedor}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda3(r.precoMelhor)}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.qtdMeios > 1 ? r.piorProvedor : "—"}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{r.qtdMeios > 1 ? formatarMoeda3(r.precoPior) : "—"}</td>
                    <td className="py-2">
                      {r.qtdMeios > 1 ? (
                        <span className="badge-ativo">{r.economiaPct.toFixed(1)}%</span>
                      ) : (
                        <span className="text-xs text-slate-400">só 1 meio</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Sem dados suficientes pra esse recorte.</p>
        )}
      </div>
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
