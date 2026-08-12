"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UFS } from "@/lib/constants";
import { anoMesDeIso, formatarDataBr, formatarDataCurta } from "@/lib/utils";
import type { RegistroHistorico } from "./Anomalias";
import BotaoBaixarPdfExecutivoLazy from "./BotaoBaixarPdfExecutivoLazy";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Fuel, ClipboardList, Wallet, MapPin } from "lucide-react";

const MESES: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function formatarInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function quantil(valoresOrdenados: number[], q: number) {
  if (valoresOrdenados.length === 0) return 0;
  const pos = (valoresOrdenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return valoresOrdenados[base + 1] !== undefined
    ? valoresOrdenados[base] + resto * (valoresOrdenados[base + 1] - valoresOrdenados[base])
    : valoresOrdenados[base];
}

// Relatório executivo mensal — KPIs, evolução de preço, savings estimados vs
// mercado (p75 como proxy de "preço fora da rede", igual ao Streamlit de
// referência) e alertas de risco, com exportação em PDF. Tudo calculado
// client-side em cima do historico_precos_detalhado já filtrado por empresa
// no server (mesmo dataset das outras abas).
export function RelatorioExecutivo({ historico, nomeEmpresa }: { historico: RegistroHistorico[]; nomeEmpresa: string }) {
  const anoAtual = useMemo(() => new Date().getFullYear(), []);
  const mesAtual = useMemo(() => new Date().getMonth() + 1, []);

  // Padrão do período: mês mais recente que TEM dado no histórico, não o mês
  // calendário atual — a importação de preços costuma ficar alguns dias/semanas
  // atrás, então "hoje" quase sempre cairia num mês ainda vazio.
  const dataMaisRecente = useMemo(() => {
    if (historico.length === 0) return null;
    return historico.reduce((max, r) => (r.dataRef > max ? r.dataRef : max), historico[0].dataRef);
  }, [historico]);
  const anoPadrao = dataMaisRecente ? anoMesDeIso(dataMaisRecente).ano : anoAtual;
  const mesPadrao = dataMaisRecente ? anoMesDeIso(dataMaisRecente).mes : mesAtual;

  const [ano, setAno] = useState(anoPadrao);
  const [mes, setMes] = useState(mesPadrao);
  const [uf, setUf] = useState("");
  const [combustivel, setCombustivel] = useState("");

  // Garante que o ano do dado mais recente sempre apareça no seletor, mesmo
  // que fique fora da janela padrão de 3 anos (ex.: base de teste antiga).
  const anos = useMemo(() => {
    const base = [anoAtual - 2, anoAtual - 1, anoAtual];
    return Array.from(new Set([...base, anoPadrao])).sort((a, b) => a - b);
  }, [anoAtual, anoPadrao]);
  const combustiveisDisponiveis = useMemo(() => Array.from(new Set(historico.map((r) => r.combustivel))).sort(), [historico]);

  const dadosPeriodo = useMemo(() => {
    return historico.filter((r) => {
      const { ano: anoRegistro, mes: mesRegistro } = anoMesDeIso(r.dataRef);
      if (anoRegistro !== ano || mesRegistro !== mes) return false;
      if (uf && r.uf !== uf) return false;
      if (combustivel && r.combustivel !== combustivel) return false;
      return true;
    });
  }, [historico, ano, mes, uf, combustivel]);

  const kpis = useMemo(() => {
    const nPostos = new Set(dadosPeriodo.map((r) => r.cnpj)).size;
    const nUfs = new Set(dadosPeriodo.map((r) => r.uf)).size;
    const precoMedio = dadosPeriodo.length ? dadosPeriodo.reduce((s, r) => s + r.preco, 0) / dadosPeriodo.length : 0;
    return { nPostos, nRegistros: dadosPeriodo.length, precoMedio, nUfs };
  }, [dadosPeriodo]);

  const evolucao = useMemo(() => {
    const porDataCombustivel = new Map<string, { data: string; [combustivel: string]: string | number }>();
    for (const r of dadosPeriodo) {
      const chave = r.dataRef;
      const linha = porDataCombustivel.get(chave) ?? { data: chave };
      const somaKey = `__soma_${r.combustivel}`;
      const qtdKey = `__qtd_${r.combustivel}`;
      linha[somaKey] = ((linha[somaKey] as number) ?? 0) + r.preco;
      linha[qtdKey] = ((linha[qtdKey] as number) ?? 0) + 1;
      porDataCombustivel.set(chave, linha);
    }
    const linhas = Array.from(porDataCombustivel.values())
      .map((linha) => {
        const resultado: { data: string; [c: string]: string | number } = { data: linha.data as string };
        for (const key of Object.keys(linha)) {
          if (key.startsWith("__soma_")) {
            const comb = key.replace("__soma_", "");
            resultado[comb] = Math.round(((linha[key] as number) / (linha[`__qtd_${comb}`] as number)) * 1000) / 1000;
          }
        }
        return resultado;
      })
      .sort((a, b) => (a.data as string).localeCompare(b.data as string));
    return linhas;
  }, [dadosPeriodo]);

  const savings = useMemo(() => {
    const porCombustivel = new Map<string, number[]>();
    for (const r of dadosPeriodo) {
      if (!porCombustivel.has(r.combustivel)) porCombustivel.set(r.combustivel, []);
      porCombustivel.get(r.combustivel)!.push(r.preco);
    }
    return Array.from(porCombustivel.entries()).map(([comb, precos]) => {
      const ordenados = [...precos].sort((a, b) => a - b);
      const refMercado = quantil(ordenados, 0.75);
      const precoGf = precos.reduce((a, b) => a + b, 0) / precos.length;
      const savingPct = refMercado ? ((refMercado - precoGf) / refMercado) * 100 : 0;
      return {
        combustivel: comb,
        precoGf,
        refMercado,
        savingPct,
        postos: new Set(dadosPeriodo.filter((r) => r.combustivel === comb).map((r) => r.cnpj)).size,
      };
    });
  }, [dadosPeriodo]);

  const riscos = useMemo(() => {
    const lista: { tipo: string; qtd: number; detalhe: string }[] = [];
    const porPosto = new Map<string, number[]>();
    for (const r of dadosPeriodo) {
      if (!porPosto.has(r.cnpj)) porPosto.set(r.cnpj, []);
      porPosto.get(r.cnpj)!.push(r.preco);
    }
    let altaVariacao = 0;
    for (const precos of porPosto.values()) {
      if (precos.length < 2) continue;
      const media = precos.reduce((a, b) => a + b, 0) / precos.length;
      const variancia = precos.reduce((s, p) => s + (p - media) ** 2, 0) / precos.length;
      const cv = media ? (Math.sqrt(variancia) / media) * 100 : 0;
      if (cv > 3) altaVariacao += 1;
    }
    if (altaVariacao > 0) {
      lista.push({ tipo: "Alta Variação de Preço", qtd: altaVariacao, detalhe: `${altaVariacao} postos com CV > 3% — instabilidade de preço detectada` });
    }

    if (dadosPeriodo.length > 0) {
      const precos = dadosPeriodo.map((r) => r.preco);
      const media = precos.reduce((a, b) => a + b, 0) / precos.length;
      const variancia = precos.reduce((s, p) => s + (p - media) ** 2, 0) / precos.length;
      const desvio = Math.sqrt(variancia);
      const acima = new Set(dadosPeriodo.filter((r) => r.preco > media + 2 * desvio).map((r) => r.cnpj));
      if (acima.size > 0) {
        lista.push({ tipo: "Preço Muito Acima da Média", qtd: acima.size, detalhe: `Preços acima de ${formatarMoeda(media + 2 * desvio)} (média + 2σ)` });
      }
    }

    const ufsComPosto = new Set(dadosPeriodo.map((r) => r.uf).filter(Boolean));
    const ufsSem = UFS.filter((u) => !ufsComPosto.has(u));
    if (ufsSem.length > 0) {
      lista.push({ tipo: "UFs sem Cobertura GF", qtd: ufsSem.length, detalhe: ufsSem.slice(0, 10).join(", ") + (ufsSem.length > 10 ? " ..." : "") });
    }
    return lista;
  }, [dadosPeriodo]);

  const periodoLabel = `${MESES[mes]}/${ano}`;

  return (
    <div>
      <div className="mb-4 rounded-lg border-l-4 border-indigo-600 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        Gera um PDF executivo consolidado com evolução de preços, savings estimados e alertas de risco para
        o período selecionado.
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ano</label>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="input w-auto text-sm">
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mês</label>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input w-auto text-sm">
            {Object.entries(MESES).map(([m, nome]) => (
              <option key={m} value={m}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">UF</label>
          <select value={uf} onChange={(e) => setUf(e.target.value)} className="input w-auto text-sm">
            <option value="">Todas</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
          <select value={combustivel} onChange={(e) => setCombustivel(e.target.value)} className="input w-auto text-sm">
            <option value="">Todos</option>
            {combustiveisDisponiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dadosPeriodo.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">
          Nenhum registro de preço encontrado para {periodoLabel}
          {uf ? ` · UF ${uf}` : ""}
          {combustivel ? ` · ${combustivel}` : ""}.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="sky" icon={Fuel} label="Postos monitorados" valor={formatarInt(kpis.nPostos)} />
            <IndicadorColorido cor="violet" icon={ClipboardList} label="Registros de preço" valor={formatarInt(kpis.nRegistros)} />
            <IndicadorColorido cor="amber" icon={Wallet} label="Preço médio" valor={formatarMoeda(kpis.precoMedio)} />
            <IndicadorColorido cor="green" icon={MapPin} label="UFs cobertas" valor={String(kpis.nUfs)} />
          </div>

          <h3 className="mb-2 text-sm font-semibold text-slate-700">📈 Evolução de preços</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucao} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={(v: string) => formatarDataCurta(v)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Tooltip labelFormatter={(v: string) => formatarDataBr(v)} formatter={(v: number) => formatarMoeda(v)} />
              <Legend />
              {combustiveisDisponiveis
                .filter((c) => !combustivel || c === combustivel)
                .map((c, i) => (
                  <Line key={c} type="monotone" dataKey={c} name={c} stroke={["#1565C0", "#E65100", "#2E7D32", "#6A1B9A", "#B71C1C"][i % 5]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                ))}
            </LineChart>
          </ResponsiveContainer>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">💰 Savings estimados vs mercado</h3>
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">Preço GF</th>
                  <th className="py-2 pr-3">Ref. mercado (p75)</th>
                  <th className="py-2 pr-3">Saving estimado</th>
                  <th className="py-2">Postos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {savings.map((s) => (
                  <tr key={s.combustivel} className="transition-colors hover:bg-frota-50/60">
                    <td className="py-2 pr-3 text-slate-700">{s.combustivel}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(s.precoGf)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(s.refMercado)}</td>
                    <td className={`py-2 pr-3 tabular-nums font-medium ${s.savingPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {s.savingPct >= 0 ? "+" : ""}
                      {s.savingPct.toFixed(1)}%
                    </td>
                    <td className="py-2 tabular-nums text-slate-600">{formatarInt(s.postos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-slate-700">🚨 Alertas de risco</h3>
          {riscos.length === 0 ? (
            <p className="mb-6 text-sm text-emerald-700">✅ Nenhum alerta de risco identificado para o período.</p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Qtd</th>
                    <th className="py-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riscos.map((r, i) => (
                    <tr key={`${r.tipo}__${i}`} className="transition-colors hover:bg-frota-50/60">
                      <td className="py-2 pr-3 text-slate-700">{r.tipo}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-600">{r.qtd}</td>
                      <td className="py-2 text-slate-600">{r.detalhe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <BotaoBaixarPdfExecutivoLazy
            nomeArquivo={`relatorio_executivo_${ano}_${String(mes).padStart(2, "0")}.pdf`}
            nomeEmpresa={nomeEmpresa}
            periodo={periodoLabel}
            kpis={[
              { label: "Postos monitorados", valor: formatarInt(kpis.nPostos) },
              { label: "Registros de preço", valor: formatarInt(kpis.nRegistros) },
              { label: "Preço médio", valor: formatarMoeda(kpis.precoMedio) },
              { label: "UFs cobertas", valor: String(kpis.nUfs) },
            ]}
            savings={savings.map((s) => ({
              combustivel: s.combustivel,
              precoGf: formatarMoeda(s.precoGf),
              refMercado: formatarMoeda(s.refMercado),
              saving: `${s.savingPct >= 0 ? "+" : ""}${s.savingPct.toFixed(1)}%`,
              postos: formatarInt(s.postos),
            }))}
            riscos={riscos.map((r) => ({ tipo: r.tipo, qtd: formatarInt(r.qtd), detalhe: r.detalhe }))}
          />
        </>
      )}
    </div>
  );
}

// Kpi() local removido — troca pelo IndicadorColorido compartilhado (ver
// Fase Redesign-Telas-Densas).
