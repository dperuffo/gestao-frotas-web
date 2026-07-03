"use client";

import { useTransition } from "react";
import { excluirManutencaoAcao } from "../actions";
import { formatDate } from "@/lib/utils";

type Registro = {
  id: number;
  data_manutencao: string;
  hodometro: number | null;
  itens_realizados: string[] | null;
  oficina: string | null;
  custo_total: number | null;
  criado_por: string | null;
};

export function HistoricoManutencoes({ placa, registros }: { placa: string; registros: Registro[] }) {
  const [isPending, startTransition] = useTransition();

  function handleExcluir(id: number) {
    if (!confirm("Excluir este registro de manutenção?")) return;
    startTransition(async () => {
      try {
        await excluirManutencaoAcao(id, placa);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  if (registros.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Nenhuma manutenção registrada ainda.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Km</th>
            <th className="py-2 pr-4">Itens</th>
            <th className="py-2 pr-4">Oficina</th>
            <th className="py-2 pr-4">Custo</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {registros.map((r) => (
            <tr key={r.id}>
              <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-700">{formatDate(r.data_manutencao)}</td>
              <td className="py-2.5 pr-4 align-top tabular-nums text-slate-600">
                {r.hodometro ? `${r.hodometro.toLocaleString("pt-BR")} km` : "—"}
              </td>
              <td className="py-2.5 pr-4 align-top text-slate-600">
                {(r.itens_realizados ?? []).join(", ") || "—"}
              </td>
              <td className="py-2.5 pr-4 align-top text-slate-600">{r.oficina ?? "—"}</td>
              <td className="py-2.5 pr-4 align-top tabular-nums text-slate-600">
                {r.custo_total ? r.custo_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              </td>
              <td className="py-2.5 align-top">
                <button
                  type="button"
                  onClick={() => handleExcluir(r.id)}
                  disabled={isPending}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
