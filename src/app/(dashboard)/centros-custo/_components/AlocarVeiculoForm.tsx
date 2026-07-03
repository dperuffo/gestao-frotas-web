"use client";

import { useState, useTransition } from "react";
import { alocarVeiculoAcao, desalocarVeiculoAcao } from "../actions";

type VeiculoOpcao = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  centro_custo_id: string | null;
  centro_custo_nome: string | null;
};

type Alocacao = {
  id: string;
  placa: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean | null;
};

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

export function AlocarVeiculoForm({
  centroCustoId,
  empresaId,
  veiculosAlocados,
  veiculosDisponiveis,
  historico,
}: {
  centroCustoId: string;
  empresaId: string | null;
  veiculosAlocados: VeiculoOpcao[];
  veiculosDisponiveis: VeiculoOpcao[];
  historico: Alocacao[];
}) {
  const [placa, setPlaca] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  function handleAlocar() {
    if (!placa) return;
    setErro(undefined);
    startTransition(async () => {
      try {
        await alocarVeiculoAcao(centroCustoId, empresaId, placa);
        setPlaca("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao alocar veículo.");
      }
    });
  }

  function handleRemover(placaVeiculo: string) {
    setErro(undefined);
    startTransition(async () => {
      try {
        await desalocarVeiculoAcao(centroCustoId, empresaId, placaVeiculo);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover alocação.");
      }
    });
  }

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Veículos alocados a este centro de custo</h2>
      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="mb-4 flex gap-2">
        <select value={placa} onChange={(e) => setPlaca(e.target.value)} className="input">
          <option value="">Selecione um veículo para alocar...</option>
          {veiculosDisponiveis.map((v) => (
            <option key={v.placa} value={v.placa}>
              {v.placa} — {[v.marca, v.modelo].filter(Boolean).join(" ") || "sem marca/modelo"}
              {v.centro_custo_nome ? ` (atualmente em ${v.centro_custo_nome})` : " (sem centro de custo)"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAlocar}
          disabled={isPending || !placa}
          className="btn-secondary whitespace-nowrap"
        >
          Alocar
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {veiculosAlocados.map((v) => (
          <li key={v.placa} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-medium text-slate-700">{v.placa}</span>{" "}
              <span className="text-slate-500">{[v.marca, v.modelo].filter(Boolean).join(" ")}</span>
            </span>
            <button
              type="button"
              onClick={() => handleRemover(v.placa)}
              disabled={isPending}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Remover
            </button>
          </li>
        ))}
        {veiculosAlocados.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">Nenhum veículo alocado ainda.</li>
        )}
      </ul>

      {historico.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setMostrarHistorico((v) => !v)}
            className="text-xs font-medium text-frota-600 hover:underline"
          >
            {mostrarHistorico ? "Ocultar" : "Ver"} histórico de alocações ({historico.length})
          </button>
          {mostrarHistorico && (
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Placa</th>
                  <th className="py-1 pr-3">Início</th>
                  <th className="py-1 pr-3">Fim</th>
                  <th className="py-1">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historico.map((h) => (
                  <tr key={h.id}>
                    <td className="py-1.5 pr-3 text-slate-700">{h.placa}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{formatarData(h.data_inicio)}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{formatarData(h.data_fim)}</td>
                    <td className="py-1.5 text-slate-600">{h.ativo && !h.data_fim ? "Vigente" : "Encerrada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
