"use client";

import { useState } from "react";
import { alocarVeiculosEmLoteAcao, desalocarVeiculosEmLoteAcao } from "../actions";
import { SeletorAlocacaoEmMassa, type ItemAlocavel } from "./SeletorAlocacaoEmMassa";

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

// Fase 27.36 — achado real: cliente com frota grande tinha que alocar
// veículo por veículo (um <select> + um clique em "Alocar" por operação) —
// inviável em centenas de veículos. Trocado pelo seletor genérico de
// alocação em massa (busca + seleção múltipla + ações em lote), ver
// SeletorAlocacaoEmMassa.tsx.
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
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const itensDisponiveis: ItemAlocavel[] = veiculosDisponiveis.map((v) => ({
    chave: v.placa,
    label: v.placa,
    subLabel: `${[v.marca, v.modelo].filter(Boolean).join(" ") || "sem marca/modelo"}${
      v.centro_custo_nome ? ` · atualmente em ${v.centro_custo_nome}` : " · sem centro de custo"
    }`,
  }));
  const itensAlocados: ItemAlocavel[] = veiculosAlocados.map((v) => ({
    chave: v.placa,
    label: v.placa,
    subLabel: [v.marca, v.modelo].filter(Boolean).join(" ") || null,
  }));

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Veículos alocados a este centro de custo</h2>
      <p className="mb-4 text-xs text-slate-500">
        Busque e marque quantos veículos precisar — dá pra alocar ou remover vários de uma vez.
      </p>

      <SeletorAlocacaoEmMassa
        itensDisponiveis={itensDisponiveis}
        itensAlocados={itensAlocados}
        labelPlural="veículo"
        placeholderBusca="Buscar por placa, marca ou modelo..."
        onAlocar={(placas) => alocarVeiculosEmLoteAcao(centroCustoId, empresaId, placas)}
        onRemover={(placas) => desalocarVeiculosEmLoteAcao(centroCustoId, empresaId, placas)}
      />

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
