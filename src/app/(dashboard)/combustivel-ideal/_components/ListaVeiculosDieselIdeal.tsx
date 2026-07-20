"use client";

import { useMemo, useState } from "react";

export type ItemComparadorDiesel = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  uf: string | null;
  familia: string;
  preco_comum: number | null;
  preco_aditivado: number | null;
  preco_fonte: string | null;
  rendimento_comum: number | null;
  rendimento_aditivado: number | null;
  custo_km_comum: number | null;
  custo_km_aditivado: number | null;
  recomendacao: string | null;
  premio_aditivado_pct: number | null;
};

// Pedido do Daniel: "Aba de combustível ideal tem que estar disponível
// para a família Diesel também. Mostrar se vale a pena utilizar o Diesel
// S10, o S10 aditivado, assim como o S500 e o S500 aditivado". Diferente
// do comparador flex (que tem uma razão física conhecida pra estimar
// rendimento faltante), aditivado x comum não tem uma razão universal
// confiável — a recomendação só aparece quando a placa TEM histórico real
// de rendimento nos dois; sem isso, mostramos o prêmio de preço do
// aditivado pro cliente decidir com o que existe, sem inventar número
// (ver comparador_diesel_ideal, migration comparador_diesel_ideal).
export function ListaVeiculosDieselIdeal({ itens }: { itens: ItemComparadorDiesel[] }) {
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
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        Nenhum veículo com histórico de abastecimento a diesel encontrado para este cliente.
      </div>
    );
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
            {itensFiltrados.length} de {itens.length}
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
                <th className="px-4 py-3">Família</th>
                <th className="px-4 py-3">Comum</th>
                <th className="px-4 py-3">Aditivado</th>
                <th className="px-4 py-3">Custo/km comum</th>
                <th className="px-4 py-3">Custo/km aditivado</th>
                <th className="px-4 py-3">Recomendação</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((l) => (
                <tr key={`${l.placa}-${l.familia}`} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.placa}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.marca || l.modelo ? `${l.marca ?? ""} ${l.modelo ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.uf ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">Diesel {l.familia}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.preco_comum != null ? (
                      <>
                        R$ {l.preco_comum.toFixed(3)}
                        {l.rendimento_comum != null && (
                          <span className="ml-1 text-xs text-slate-400">({l.rendimento_comum} km/l)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.preco_aditivado != null ? (
                      <>
                        R$ {l.preco_aditivado.toFixed(3)}
                        {l.rendimento_aditivado != null && (
                          <span className="ml-1 text-xs text-slate-400">({l.rendimento_aditivado} km/l)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.custo_km_comum != null ? `R$ ${l.custo_km_comum.toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.custo_km_aditivado != null ? `R$ ${l.custo_km_aditivado.toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {l.recomendacao ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          l.recomendacao === "aditivado" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.recomendacao === "aditivado" ? "✨ Aditivado" : "🛢️ Comum"} compensa
                      </span>
                    ) : l.premio_aditivado_pct != null ? (
                      <span className="text-xs text-slate-500">
                        Aditivado {l.premio_aditivado_pct > 0 ? "+" : ""}
                        {l.premio_aditivado_pct}% no preço — sem histórico de rendimento pra comparar
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Dados insuficientes</span>
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
