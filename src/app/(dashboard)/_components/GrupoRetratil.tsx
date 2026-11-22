"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

// Agrupador do menu lateral que o usuário expande ou recolhe. Padrão: recolhido.
// A escolha de cada grupo fica salva no navegador (localStorage), então
// sobrevive a recarregar a página. Quem renderiza os itens continua sendo o
// GrupoMenuLateral (Server Component, por causa dos ícones); este componente
// só recebe os itens prontos como `children` e cuida do abrir/fechar.
//
// Menu colapsado só com ícones (desktop): os títulos ficam escondidos e não há
// onde clicar, então ali os itens aparecem sempre (regra em globals.css,
// `.menu-colapsado .menu-grupo-fechado`).
const CHAVE_STORAGE = "fni:menu-grupos-abertos";

function lerAbertos(): Record<string, boolean> {
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    const dados = bruto ? JSON.parse(bruto) : {};
    return dados && typeof dados === "object" ? (dados as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function gravarAberto(titulo: string, aberto: boolean) {
  try {
    const dados = lerAbertos();
    if (aberto) dados[titulo] = true;
    else delete dados[titulo];
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
  } catch {
    // Sem localStorage (modo privado, bloqueio): o grupo só não lembra a escolha.
  }
}

export function GrupoRetratil({
  titulo,
  hrefs,
  dataTourTitulo,
  primeiro,
  children,
}: {
  titulo: string;
  hrefs: string[];
  dataTourTitulo?: string;
  primeiro: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const idLista = useId();
  const pathname = usePathname();

  useEffect(() => {
    // Lê só depois de montar, para o HTML do servidor e o do primeiro render
    // do navegador serem iguais (sempre recolhido).
    setAberto(!!lerAbertos()[titulo]);
  }, [titulo]);

  // Destaca o título do grupo que contém a página aberta, mesmo recolhido.
  const temPaginaAtual = hrefs.some((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
  );

  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    gravarAberto(titulo, proximo);
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={idLista}
        data-tour={dataTourTitulo}
        className={`menu-grupo-titulo glass-nav-texto-muted flex w-full items-center justify-between rounded-md px-2 pb-2 text-left text-xs font-semibold uppercase tracking-wider transition hover:text-accento ${primeiro ? "" : "mt-4"} ${aberto ? "mb-1" : "mb-0"}`}
      >
        <span className="flex items-center gap-1.5">
          {titulo}
          {temPaginaAtual && !aberto && (
            <span className="h-1.5 w-1.5 rounded-full bg-accento" aria-label="Contém a página atual" />
          )}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${aberto ? "rotate-90" : ""}`} />
      </button>
      <div id={idLista} className={aberto ? "" : "menu-grupo-fechado"}>
        {children}
      </div>
    </>
  );
}
