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
      <div className="mb-4 flex items-center gap-2">
        <div className="glass-tabbar">
          {abas.map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAtiva(aba.id)}
              className={`glass-tab ${ativa === aba.id ? "glass-tab-ativa" : ""}`}
            >
              {aba.label}
            </button>
          ))}
        </div>
        {abaAtiva?.ajudaChave && (
          <span className="shrink-0">
            <AjudaIcon chave={abaAtiva.ajudaChave} />
          </span>
        )}
      </div>
      {abaAtiva?.conteudo}
    </div>
  );
}
