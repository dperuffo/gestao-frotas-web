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
  // Fase TCO 3 (29/07/2026) — opcional, usado no cálculo de custo de
  // downtime no TCO.
  dias_parado: number | null;
  criado_por: string | null;
  // Fase Checklist-Digital-Manutenção — URLs assinadas (resolvidas no
  // Server Component, ver [placa]/page.tsx) das fotos anexadas como
  // evidência do serviço. Nunca é a URL pública direta do bucket (privado).
  fotosUrls?: { url: string; nome: string }[];
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
            <th className="py-2 pr-4">Dias parado</th>
            <th className="py-2 pr-4">Fotos</th>
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
              <td className="py-2.5 pr-4 align-top tabular-nums text-slate-600">{r.dias_parado ?? "—"}</td>
              <td className="py-2.5 pr-4 align-top">
                {r.fotosUrls && r.fotosUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {r.fotosUrls.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={f.nome}
                        className="block h-10 w-10 overflow-hidden rounded border border-slate-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de arquivo no Storage, com signed URL de curta duração; next/image exigiria configurar domínio remoto pra uma URL que muda a cada load. */}
                        <img src={f.url} alt={f.nome} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
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
