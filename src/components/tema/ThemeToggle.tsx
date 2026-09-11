"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";

// Fase Dark-Mode (11/09/2026) — botão de alternância manual, no rodapé do
// menu lateral junto de CentralAjuda/BotaoSair (mesmo padrão visual:
// `menu-item-link` + ícone lucide + `menu-item-label` que some com o menu
// colapsado — ver PainelMobile.tsx/globals.css).
//
// Ciclo Claro → Escuro → Sistema (não um switch binário Claro/Escuro):
// "Sistema" é um estado real e útil aqui (o painel já detecta
// `prefers-color-scheme` por padrão), e expor os 3 estados no mesmo botão
// evita adicionar um menu/dropdown só pra isso. O ícone e o texto mostram
// sempre o estado ATUAL escolhido (não o próximo), com o texto "(auto)"
// quando for Sistema pra deixar claro que ele pode virar claro ou escuro
// sozinho.
const CICLO = ["light", "dark", "system"] as const;
type TemaEscolha = (typeof CICLO)[number];

const ICONE: Record<TemaEscolha, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: MonitorSmartphone,
};

const LABEL: Record<TemaEscolha, string> = {
  light: "Tema: Claro",
  dark: "Tema: Escuro",
  system: "Tema: Sistema (auto)",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // next-themes só sabe o tema real depois de montar no client (o valor no
  // servidor seria sempre undefined) — sem essa guarda, o ícone piscaria
  // errado ou daria mismatch de hidratação.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const atual = (montado ? (theme as TemaEscolha | undefined) : undefined) ?? "system";
  const Icone = ICONE[atual];

  function alternar() {
    const indiceAtual = CICLO.indexOf(atual);
    const proximo = CICLO[(indiceAtual + 1) % CICLO.length];
    setTheme(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={LABEL[atual]}
      className="menu-item-link flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
    >
      {montado ? (
        <Icone className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span className="menu-item-label">{montado ? LABEL[atual] : "Tema"}</span>
    </button>
  );
}
