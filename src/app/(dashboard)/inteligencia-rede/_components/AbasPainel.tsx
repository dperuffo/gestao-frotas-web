"use client";

import { useState, type ReactNode } from "react";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// ajudaChave (Fase 24, opcional) — quando informado, mostra o ícone "?" ao
// lado da barra de abas explicando a aba ativa no momento.
export type Aba = { id: string; label: ReactNode; conteudo: ReactNode; ajudaChave?: string };

// Abas simples client-side — a página inteira já vem pronta do server
// component (todo o fetch acontece lá), aqui só decide qual bloco mostrar.
// Evita que a tela vire uma rolagem infinita agora que o painel de
// Inteligência de Rede ganhou muitos gráficos/mapas (mesma organização em
// abas do Streamlit de referência).
export function AbasPainel({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id);
  const abaAtiva = abas.find((aba) => aba.id === ativa);

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {abas.map((aba) => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setAtiva(aba.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              ativa === aba.id
                ? "border-b-2 border-frota-600 text-frota-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {aba.label}
          </button>
        ))}
        {abaAtiva?.ajudaChave && (
          <span className="ml-1 shrink-0">
            <AjudaIcon chave={abaAtiva.ajudaChave} />
          </span>
        )}
      </div>
      {abaAtiva?.conteudo}
    </div>
  );
}
