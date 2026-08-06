"use client";

import { useState, useTransition } from "react";
import {
  corrigirPlacaVeiculoAcao,
  inativarVeiculoDuplicadoAcao,
  type VeiculoDuplicado,
} from "../actions";

// Fase Duplicidade-Placas-Grupo (05/08/2026) — um card por placa duplicada,
// com um bloco por veículo/empresa em conflito. Mesmo espírito de
// BotoesDuplicata.tsx (postos-duplicados), adaptado pra 2 ações concretas:
// corrigir a placa errada (form inline) ou inativar o cadastro (soft-delete,
// nunca apaga histórico de abastecimentos/manutenções).
export function GrupoDuplicidade({ veiculos }: { veiculos: VeiculoDuplicado[] }) {
  return (
    <div className="card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        Placa {veiculos[0]?.placa} — cadastrada em {veiculos.length} empresas do grupo econômico
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {veiculos.map((v) => (
          <LinhaVeiculo key={v.veiculoId} veiculo={v} />
        ))}
      </div>
    </div>
  );
}

function LinhaVeiculo({ veiculo }: { veiculo: VeiculoDuplicado }) {
  const [modoEdicao, setModoEdicao] = useState(false);
  const [novaPlaca, setNovaPlaca] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [resolvido, setResolvido] = useState<"placa_corrigida" | "inativado" | undefined>();
  const [isPending, startTransition] = useTransition();

  function salvarPlaca() {
    setErro(undefined);
    startTransition(async () => {
      const r = await corrigirPlacaVeiculoAcao(veiculo.veiculoId, novaPlaca);
      if (r.erro) setErro(r.erro);
      else setResolvido("placa_corrigida");
    });
  }

  function inativar() {
    if (
      !confirm(
        `Inativar o cadastro deste veículo (${veiculo.placa}, ${veiculo.empresaNome})? O histórico de abastecimentos/manutenções é mantido.`
      )
    ) {
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      const r = await inativarVeiculoDuplicadoAcao(veiculo.veiculoId);
      if (r.erro) setErro(r.erro);
      else setResolvido("inativado");
    });
  }

  if (resolvido === "placa_corrigida") {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
        ✓ Placa corrigida — este veículo saiu da lista de duplicidade.
      </p>
    );
  }
  if (resolvido === "inativado") {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        ✓ Cadastro inativado — histórico mantido, veículo tirado de circulação.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{veiculo.empresaNome}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">
        {veiculo.marca ?? "—"} {veiculo.modelo ?? ""}
      </p>
      <p className="text-xs text-slate-500">
        {veiculo.tipoVeiculo ?? "Tipo não informado"} · Ano {veiculo.anoFabricacao ?? "—"} ·{" "}
        {veiculo.qtdAbastecimentos} abastecimento{veiculo.qtdAbastecimentos === 1 ? "" : "s"} registrado
        {veiculo.qtdAbastecimentos === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        Cadastrado em {new Date(veiculo.criadoEm).toLocaleDateString("pt-BR")}
      </p>

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      {modoEdicao ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={novaPlaca}
            onChange={(e) => setNovaPlaca(e.target.value)}
            placeholder="Placa correta"
            className="input text-xs"
          />
          <button type="button" disabled={isPending} onClick={salvarPlaca} className="btn-primary text-xs">
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setModoEdicao(false);
              setErro(undefined);
            }}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setModoEdicao(true)}
            className="text-xs font-medium text-frota-600 hover:underline"
          >
            Corrigir placa
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={inativar}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Inativar este cadastro
          </button>
        </div>
      )}
    </div>
  );
}
