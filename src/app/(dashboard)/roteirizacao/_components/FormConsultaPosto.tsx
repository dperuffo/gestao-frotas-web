"use client";

import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { buscarPostoPorTermoAcao, type PostoComScore } from "../actions";
import { ScoreBadge } from "./ScoreBadge";
import { PrecosChips } from "./PrecosChips";
import MapaRotaLazy from "./MapaRotaLazy";
import { SalvarConsultaForm } from "./SalvarConsultaForm";
import { formatCNPJ } from "@/lib/utils";
import { corPorBandeira } from "@/lib/coresBandeira";

export function FormConsultaPosto({
  empresaId,
  termoInicial,
}: {
  empresaId: string | null;
  termoInicial?: string;
}) {
  const [termo, setTermo] = useState(termoInicial ?? "");
  const [resultado, setResultado] = useState<PostoComScore[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (termoInicial) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    if (!empresaId) {
      setErro("Selecione um cliente antes.");
      return;
    }
    if (!termo.trim()) {
      setErro("Digite um CNPJ ou parte do nome do posto.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await buscarPostoPorTermoAcao({ empresaId, termo });
      setResultado(r);
    });
  }

  return (
    <div>
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">CNPJ ou nome do posto</label>
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Ex: 12.345.678/0001-99 ou Posto Ipiranga"
            className="input"
          />
        </div>
        <button type="button" disabled={isPending} className="btn-primary disabled:opacity-50" onClick={buscar}>
          {isPending ? "Buscando..." : "Buscar"}
        </button>
        {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      </div>

      {resultado && resultado.length === 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Nenhum posto encontrado.</p>
      )}

      {resultado && resultado.length > 0 && (
        <>
          <div className="mb-3 flex justify-end">
            <SalvarConsultaForm tipo="busca" empresaId={empresaId} dados={{ termo }} nomeSugerido={`Busca: ${termo}`} />
          </div>
          <div className="mb-6">
            <MapaRotaLazy
              marcadores={resultado.map((p) => ({
                lat: p.lat,
                lon: p.lon,
                label: p.razaoSocial ?? formatCNPJ(p.cnpj),
                cnpj: p.cnpj,
                cor: corPorBandeira(p.bandeira),
                legendaLabel: p.bandeira ?? "Sem bandeira",
              }))}
            />
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-4"><span className="inline-flex items-center gap-1">Score <AjudaIcon chave="roteirizacao.score_posto" /></span></th>
                  <th className="py-2 pr-4">Razão social</th>
                  <th className="whitespace-nowrap py-2 pr-4">CNPJ</th>
                  <th className="whitespace-nowrap py-2 pr-4">Município</th>
                  <th className="py-2 pr-4">Preços</th>
                  <th className="whitespace-nowrap py-2 pr-4">Fonte</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultado.map((p) => (
                  <tr key={p.cnpj}>
                    <td className="py-2.5 pr-4 align-top">
                      <ScoreBadge score={p.score} />
                    </td>
                    <td className="py-2.5 pr-4 align-top text-slate-700">{p.razaoSocial ?? "—"}</td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">{formatCNPJ(p.cnpj)}</td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                      {p.municipio ?? "—"} - {p.uf ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <PrecosChips precos={p.precos} />
                    </td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap">
                      {/* Fase 27.140 — ver comentário equivalente em
                          roteirizacao/page.tsx. Posto "Base ANP" não tem
                          cadastro em postos_gf, então não existe
                          /postos/[cnpj] pra ele — sem link de detalhe. */}
                      {p.origem === "anp" ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          Base ANP
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          Próprio
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 align-top">
                      {p.origem === "proprio" && (
                        <Link href={`/postos/${p.cnpj}`} className="whitespace-nowrap text-frota-600 hover:underline">
                          Ver detalhe
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
