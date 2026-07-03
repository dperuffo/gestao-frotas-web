"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// Compara o preço efetivamente pago (média ponderada das paradas sugeridas)
// contra duas referências: a média dos postos GF candidatos no corredor da
// rota, e a estimativa oficial ANP do estado mais representado entre eles.
// Também monta a "projeção de economia" — quanto seria gasto em cada
// cenário se o volume abastecido fosse pago a esses preços de referência.
export function ComparativoPrecos({
  custoTotal,
  litrosTotal,
  precoMedioGf,
  precoReferenciaAnp,
  ufReferencia,
}: {
  custoTotal: number;
  litrosTotal: number;
  precoMedioGf: number | null;
  precoReferenciaAnp: number | null;
  ufReferencia: string | null;
}) {
  const precoPagoMedio = litrosTotal > 0 ? custoTotal / litrosTotal : null;

  const dadosBarra = useMemo(() => {
    if (precoPagoMedio == null) return [];
    const linhas: { nome: string; preco: number; cor: string }[] = [
      { nome: "Preço pago (postos GF selecionados)", preco: precoPagoMedio, cor: "#1B5E20" },
    ];
    if (precoMedioGf != null && Math.abs(precoMedioGf - precoPagoMedio) > 0.001) {
      linhas.push({ nome: "Preço médio rede GF (rota)", preco: precoMedioGf, cor: "#42A5F5" });
    }
    if (precoReferenciaAnp != null) {
      linhas.push({ nome: `Referência ANP (${ufReferencia ?? "UF"})`, preco: precoReferenciaAnp, cor: "#E65100" });
    }
    return linhas;
  }, [precoPagoMedio, precoMedioGf, precoReferenciaAnp, ufReferencia]);

  const economiaRows = useMemo(() => {
    if (precoPagoMedio == null || litrosTotal <= 0) return [];
    const rows: { cenario: string; custo: number; economia: number }[] = [];
    if (precoMedioGf) {
      const custoSeMedio = litrosTotal * precoMedioGf;
      rows.push({ cenario: "vs. Preço médio GF da rota", custo: custoSeMedio, economia: custoSeMedio - custoTotal });
    }
    if (precoReferenciaAnp) {
      const custoAnpProp = litrosTotal * precoReferenciaAnp;
      rows.push({ cenario: `vs. Referência ANP (${ufReferencia ?? "UF"})`, custo: custoAnpProp, economia: custoAnpProp - custoTotal });
    }
    return rows;
  }, [precoPagoMedio, litrosTotal, precoMedioGf, precoReferenciaAnp, ufReferencia, custoTotal]);

  if (dadosBarra.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">📊 Comparativo de Preços</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dadosBarra} margin={{ top: 10, right: 16, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" />
            <XAxis dataKey="nome" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tickFormatter={(v) => formatarMoeda(v, 2)} fontSize={11} width={70} />
            <Tooltip formatter={(v: number) => [`${formatarMoeda(v)}/L`, "Preço"]} />
            <Bar dataKey="preco" radius={[4, 4, 0, 0]}>
              {dadosBarra.map((d, i) => (
                <Cell key={i} fill={d.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {economiaRows.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">💡 Projeção de Economia</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-3">Cenário</th>
                <th className="py-1.5 pr-3">Custo no cenário</th>
                <th className="py-1.5">Economia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {economiaRows.map((r) => (
                <tr key={r.cenario}>
                  <td className="py-1.5 pr-3 text-slate-600">{r.cenario}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-slate-700">{formatarMoeda(r.custo, 2)}</td>
                  <td className={`py-1.5 tabular-nums font-medium ${r.economia >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {r.economia >= 0 ? "▼ economizou " : "▲ pagou a mais "}
                    {formatarMoeda(Math.abs(r.economia), 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-400">
            Economia positiva = postos GF selecionados custaram menos que a referência. Calculado com base nos litros
            efetivamente abastecidos.
          </p>
        </div>
      )}
    </div>
  );
}
