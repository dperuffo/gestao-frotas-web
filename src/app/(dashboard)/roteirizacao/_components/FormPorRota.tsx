"use client";

import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

import { useEffect, useState, useTransition } from "react";
import { BuscaLocalInput, type LocalSelecionado } from "./BuscaLocalInput";
import { SalvarConsultaForm } from "./SalvarConsultaForm";
import { ScoreBadge } from "./ScoreBadge";
import { PrecosChips } from "./PrecosChips";
import MapaRotaLazy from "./MapaRotaLazy";
import { calcularRotaEPostosAcao, type ResultadoRotaCalculada } from "../actions";
import { formatCNPJ } from "@/lib/utils";
import { corPorBandeira } from "@/lib/coresBandeira";

export function FormPorRota({
  empresaId,
  estadoInicial,
}: {
  empresaId: string | null;
  estadoInicial?: {
    origem: LocalSelecionado;
    destino: LocalSelecionado;
    paradas: LocalSelecionado[];
    raioKm: number;
  } | null;
}) {
  const [origem, setOrigem] = useState<LocalSelecionado | null>(estadoInicial?.origem ?? null);
  const [destino, setDestino] = useState<LocalSelecionado | null>(estadoInicial?.destino ?? null);
  const [paradas, setParadas] = useState<LocalSelecionado[]>(estadoInicial?.paradas ?? []);
  const [raioKm, setRaioKm] = useState(estadoInicial?.raioKm ?? 5);
  const [resultado, setResultado] = useState<ResultadoRotaCalculada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function calcular() {
    if (!empresaId) {
      setErro("Selecione um cliente antes.");
      return;
    }
    if (!origem || !destino) {
      setErro("Informe origem e destino.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await calcularRotaEPostosAcao({
        empresaId,
        origem,
        destino,
        paradas: paradas.filter((p) => p.lat !== 0 || p.lon !== 0).map((p) => ({ lat: p.lat, lon: p.lon })),
        raioKm,
      });
      setResultado(r);
    });
  }

  // Ao restaurar uma consulta salva (via ?rotaId=), já dispara o cálculo
  // automaticamente para não exigir um clique extra do usuário.
  useEffect(() => {
    if (estadoInicial) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card mb-6 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Origem</label>
            <BuscaLocalInput placeholder="Cidade de origem" valorInicial={origem} onSelecionar={setOrigem} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Destino</label>
            <BuscaLocalInput placeholder="Cidade de destino" valorInicial={destino} onSelecionar={setDestino} />
          </div>
        </div>

        {paradas.map((_, i) => (
          <div key={i}>
            <label className="mb-1 block text-xs font-medium text-slate-500">Parada {i + 1}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <BuscaLocalInput
                  placeholder="Cidade da parada"
                  valorInicial={paradas[i]}
                  onSelecionar={(local) =>
                    setParadas((atual) => atual.map((p, idx) => (idx === i ? (local ?? p) : p)))
                  }
                />
              </div>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-red-600"
                onClick={() => setParadas((atual) => atual.filter((_, idx) => idx !== i))}
              >
                remover
              </button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setParadas((atual) => [...atual, { label: "", lat: 0, lon: 0 }])}
          >
            + Adicionar parada
          </button>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Raio de busca (km)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={raioKm}
              onChange={(e) => setRaioKm(Number(e.target.value) || 5)}
              className="input w-24"
            />
          </div>
          <button type="button" disabled={isPending} className="btn-primary disabled:opacity-50" onClick={calcular}>
            {isPending ? "Calculando..." : "Calcular rota"}
          </button>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>

      {resultado && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Distância</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{resultado.distanciaKm} km</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Duração estimada</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {Math.floor(resultado.duracaoMin / 60)}h{String(resultado.duracaoMin % 60).padStart(2, "0")}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Postos no corredor</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{resultado.postosProximos.length}</p>
            </div>
          </div>

          {resultado.linhaReta && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Não foi possível calcular a rota real pelas estradas agora (serviço OSRM indisponível) — os valores
              acima são uma aproximação em linha reta.
            </p>
          )}

          <div className="mb-6">
            <MapaRotaLazy
              rota={resultado.coordenadas}
              marcadores={[
                { lat: origem!.lat, lon: origem!.lon, label: origem!.label, cor: "verde" },
                ...paradas
                  .filter((p) => p.lat && p.lon)
                  .map((p) => ({ lat: p.lat, lon: p.lon, label: p.label, cor: "laranja" as const })),
                { lat: destino!.lat, lon: destino!.lon, label: destino!.label, cor: "vermelho" },
                ...resultado.postosProximos.map((p) => ({
                  lat: p.lat,
                  lon: p.lon,
                  label: p.razaoSocial ?? formatCNPJ(p.cnpj),
                  cnpj: p.cnpj,
                  infoExtra: `${p.desvioKm} km da rota · km ${p.kmNaRota}`,
                  cor: corPorBandeira(p.bandeira),
                  legendaLabel: p.bandeira ?? "Sem bandeira",
                })),
              ]}
            />
          </div>

          <div className="card overflow-x-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Postos ao longo da rota</h2>
              <SalvarConsultaForm
                tipo="rota"
                empresaId={empresaId}
                dados={{ origem, destino, paradas, raioKm }}
                nomeSugerido={`${origem?.label} → ${destino?.label}`}
              />
            </div>
            {resultado.postosProximos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum posto da rede dentro do raio configurado.</p>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap py-2 pr-4"><span className="inline-flex items-center gap-1">Score <AjudaIcon chave="roteirizacao.score_posto" /></span></th>
                    <th className="py-2 pr-4">Razão social</th>
                    <th className="whitespace-nowrap py-2 pr-4">Km na rota</th>
                    <th className="whitespace-nowrap py-2 pr-4">Desvio</th>
                    <th className="py-2">Preços</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultado.postosProximos.map((p) => (
                    <tr key={p.cnpj}>
                      <td className="py-2.5 pr-4 align-top">
                        <ScoreBadge score={p.score} />
                      </td>
                      <td className="py-2.5 pr-4 align-top text-slate-700">{p.razaoSocial ?? formatCNPJ(p.cnpj)}</td>
                      <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">{p.kmNaRota} km</td>
                      <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">{p.desvioKm} km</td>
                      <td className="py-2.5 align-top">
                        <PrecosChips precos={p.precos} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
