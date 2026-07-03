"use client";

import { useEffect, useState } from "react";
import { buscarDetalhePostoParaMapaAcao, type DetalhePostoMapa } from "../actions";
import { formatCNPJ } from "@/lib/utils";

const FONTE_LABEL: Record<string, string> = {
  gf: "próprio",
  anp_municipio: "ANP município",
  anp_estado: "ANP estado",
  anp_brasil: "ANP Brasil",
};

const FONTE_COR: Record<string, string> = {
  gf: "text-status-ativo",
  anp_municipio: "text-slate-400",
  anp_estado: "text-slate-400",
  anp_brasil: "text-slate-400",
};

// Card rico exibido ao clicar num posto no mapa: razão social, CNPJ,
// cidade/UF, bandeira, preço vigente de cada combustível (próprio do posto
// quando existe, senão a estimativa ANP em cascata) e um link pro Google
// Maps (satélite/rua/fotos) na coordenada exata do posto. Carrega os
// dados sob demanda no clique, não junto com a lista de marcadores.
export function PostoPopupContent({ cnpj, lat, lon }: { cnpj: string; lat: number; lon: number }) {
  const [detalhe, setDetalhe] = useState<DetalhePostoMapa | null | "carregando">("carregando");

  useEffect(() => {
    let vivo = true;
    setDetalhe("carregando");
    buscarDetalhePostoParaMapaAcao(cnpj).then((r) => {
      if (vivo) setDetalhe(r);
    });
    return () => {
      vivo = false;
    };
  }, [cnpj]);

  // O link do Google Maps não depende dos dados de preço (já temos lat/lon
  // da posição do próprio marcador) — por isso aparece em qualquer estado,
  // inclusive enquanto o restante do card ainda está carregando.
  const linkGoogleMaps = (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-frota-600 hover:bg-slate-50"
    >
      Ver no Google Maps ↗
    </a>
  );

  if (detalhe === "carregando") {
    return (
      <div className="w-[220px]">
        <p className="text-xs text-slate-400">Carregando...</p>
        {linkGoogleMaps}
      </div>
    );
  }
  if (!detalhe) {
    return (
      <div className="w-[220px]">
        <p className="text-xs text-slate-400">Posto não encontrado.</p>
        {linkGoogleMaps}
      </div>
    );
  }

  return (
    <div className="w-[220px] text-sm leading-snug">
      <p className="break-words font-semibold text-slate-900">{detalhe.razaoSocial ?? formatCNPJ(detalhe.cnpj)}</p>
      <p className="text-xs text-slate-500">
        {formatCNPJ(detalhe.cnpj)} · {detalhe.municipio ?? "—"}-{detalhe.uf ?? "—"}
      </p>
      {detalhe.bandeira && <p className="text-xs text-slate-500">{detalhe.bandeira}</p>}

      <div className="mt-2 max-h-[220px] space-y-1 overflow-y-auto border-t border-slate-100 pt-1.5">
        {detalhe.precos.length === 0 ? (
          <p className="text-xs text-slate-400">Sem preço registrado (próprio ou ANP).</p>
        ) : (
          // Comum e Aditivado (diesel/gasolina/etanol) são produtos
          // diferentes, com preços diferentes — cada um fica na sua linha,
          // com o nome real do produto (não o nome da categoria ANP, que
          // agrupa as duas variações só pra fins de referência).
          detalhe.precos.map((p) => (
            <div
              key={`${p.categoria}__${p.combustivelGf ?? ""}`}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="truncate text-slate-600">{p.combustivelGf ?? p.categoria}</span>
              <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
                <span className="font-medium text-slate-900">R$ {p.preco.toFixed(3)}</span>
                <span className={`text-[10px] ${FONTE_COR[p.fonte] ?? "text-slate-400"}`}>
                  {FONTE_LABEL[p.fonte] ?? p.fonte}
                </span>
              </span>
            </div>
          ))
        )}
      </div>

      {linkGoogleMaps}
    </div>
  );
}
