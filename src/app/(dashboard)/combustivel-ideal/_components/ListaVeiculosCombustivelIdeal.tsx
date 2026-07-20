"use client";

import { useMemo, useState } from "react";

export type ItemComparadorCombustivel = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  uf: string | null;
  rendimento_gasolina: number | null;
  rendimento_etanol: number | null;
  rendimento_estimado: boolean | null;
  preco_gasolina: number | null;
  preco_etanol: number | null;
  preco_fonte: string | null;
  custo_km_gasolina: number | null;
  custo_km_etanol: number | null;
  recomendacao: string | null;
  economia_pct: number | null;
};

// Pedido do Daniel: "Colocar um filtro para seleção de placa nas visões de
// cliente, web e pwa, e admin". Filtro client-side (sem round-trip ao
// servidor) por placa/marca/modelo — mesmo padrão de busca já usado em
// VisaoCiclosPorContraparte.tsx (useState + useMemo sobre os dados que a
// página server component já buscou). Como a página já resolve
// perfil/empresa antes de chegar aqui (resolverEmpresaAtual), o mesmo
// componente cobre cliente e admin sem código extra.
export function ListaVeiculosCombustivelIdeal({ itens }: { itens: ItemComparadorCombustivel[] }) {
  const [busca, setBusca] = useState("");

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return itens;
    return itens.filter((i) => {
      const alvo = `${i.placa} ${i.marca ?? ""} ${i.modelo ?? ""}`.toUpperCase();
      return alvo.includes(q);
    });
  }, [busca, itens]);

  if (itens.length === 0) {
    return <div className="card p-8 text-center text-sm text-slate-400">Nenhum veículo flex encontrado para este cliente.</div>;
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por placa, marca ou modelo..."
          className="input w-full max-w-xs text-sm"
        />
        {busca && (
          <span className="text-xs text-slate-400">
            {itensFiltrados.length} de {itens.length} veículo(s)
          </span>
        )}
      </div>

      {itensFiltrados.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhum veículo encontrado para &quot;{busca}&quot;.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">UF</th>
                <th className="px-4 py-3">Gasolina</th>
                <th className="px-4 py-3">Etanol</th>
                <th className="px-4 py-3">Custo/km gasolina</th>
                <th className="px-4 py-3">Custo/km etanol</th>
                <th className="px-4 py-3">Recomendação</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((l) => (
                <tr key={l.placa} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.placa}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.marca || l.modelo ? `${l.marca ?? ""} ${l.modelo ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.uf ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.preco_gasolina != null ? (
                      <>
                        R$ {l.preco_gasolina.toFixed(3)}
                        {l.rendimento_gasolina != null && (
                          <span className="ml-1 text-xs text-slate-400">({l.rendimento_gasolina} km/l)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.preco_etanol != null ? (
                      <>
                        R$ {l.preco_etanol.toFixed(3)}
                        {l.rendimento_etanol != null && (
                          <span className="ml-1 text-xs text-slate-400">({l.rendimento_etanol} km/l)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.custo_km_gasolina != null ? `R$ ${l.custo_km_gasolina.toFixed(3)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.custo_km_etanol != null ? `R$ ${l.custo_km_etanol.toFixed(3)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {l.recomendacao ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          l.recomendacao === "etanol" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {l.recomendacao === "etanol" ? "🌱 Etanol" : "⛽ Gasolina"}
                        {l.economia_pct != null ? ` (${l.economia_pct}% mais barato)` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Dados insuficientes</span>
                    )}
                    {l.rendimento_estimado && l.recomendacao && (
                      <span
                        className="ml-1 text-xs text-slate-400"
                        title="Rendimento de um dos combustíveis foi estimado (sem histórico suficiente)"
                      >
                        (estimado)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
