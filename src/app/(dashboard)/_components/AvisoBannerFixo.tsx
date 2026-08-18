"use client";

import { useEffect, useState } from "react";
import type { AvisoParaUsuario } from "../administracao/central-avisos/actions";
import { dispensarAviso, obterAvisosDispensados } from "@/lib/avisosDispensados";

const TIPO_ICONE: Record<AvisoParaUsuario["tipo"], string> = {
  novidade: "🆕",
  correcao: "🐛",
  manutencao: "🔧",
  aviso_geral: "📣",
};

const URGENCIA_ESTILO: Record<AvisoParaUsuario["urgencia"], string> = {
  informativo: "border-frota-100 from-frota-50",
  atencao: "border-amber-200 from-amber-50",
  critico: "border-red-300 from-red-50",
};

// Fase Central-Avisos (28/07/2026) — banner fixo no topo do <main>, só pros
// avisos marcados `fixado=true` (tipicamente manutenção em andamento ou
// aviso crítico), mesmo modelo visual do LembretePwaBanner. Some sozinho
// quando a data_expiracao passar (o layout já filtra isso ao buscar).
//
// Fase Avisos-Reaparecer-Login (18/08/2026) — o "dispensar" (X) é da sessão
// do navegador, não permanente: fica escondido em navegações/F5 dentro da
// mesma sessão (sessionStorage, ver src/lib/avisosDispensados.ts), mas
// sempre volta a aparecer no próximo login (limparAvisosDispensados() é
// chamado em todo fluxo de logout). Não grava leitura — a leitura pra fins
// de badge é feita no drawer.
export function AvisoBannerFixo({ avisos }: { avisos: AvisoParaUsuario[] }) {
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDispensados(obterAvisosDispensados());
  }, []);

  const visiveis = avisos.filter((a) => !dispensados.has(a.id));

  if (visiveis.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {visiveis.map((a) => (
        <div
          key={a.id}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gradient-to-r to-white px-5 py-3.5 ${URGENCIA_ESTILO[a.urgencia]}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{TIPO_ICONE[a.tipo]}</span>
            <p className="text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">{a.titulo}.</strong> {a.resumo}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDispensados(dispensarAviso(a.id))}
            aria-label="Fechar aviso"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
