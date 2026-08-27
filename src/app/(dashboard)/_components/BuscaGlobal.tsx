"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X } from "lucide-react";
import type { ItemMenuLateral } from "./GrupoMenuLateral";

// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação", item do roadmap "Busca global (atalho de
// teclado)") — com 67 áreas permissionadas e a lista de telas dividida em 9+
// grupos temáticos no menu lateral, achar uma tela específica hoje depende
// de saber em qual grupo ela mora. Este componente indexa a MESMA lista de
// itens já filtrada por permissão em layout.tsx (nada de duplicar a lógica
// de `podeAcessarItem` aqui) e abre com Cmd/Ctrl+K de qualquer tela do
// painel.
//
// Escopo desta 1ª versão: busca só sobre as telas do menu (estático, sem
// round-trip ao banco — abre instantâneo). Busca por veículo/motorista/posto
// (dinâmica, via banco) ficou de fora de propósito, pra não atrasar essa
// entrega com uma RPC nova; é a extensão natural mais óbvia se o Daniel
// quiser depois.
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BuscaGlobal({ itens }: { itens: ItemMenuLateral[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fase UX-Navegacao — algumas telas se repetem entre grupos (ex.: um item
  // pode aparecer em "Favoritos" e no grupo original); dedup por href pra não
  // listar a mesma tela duas vezes na busca.
  const itensUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return itens.filter((item) => {
      if (vistos.has(item.href)) return false;
      vistos.add(item.href);
      return true;
    });
  }, [itens]);

  const resultados = useMemo(() => {
    const alvo = normalizar(consulta.trim());
    if (!alvo) return itensUnicos.slice(0, 8);
    const comPontuacao = itensUnicos
      .map((item) => {
        const label = normalizar(item.label);
        if (!label.includes(alvo)) return null;
        // Prefixo pontua mais que match no meio do texto.
        const pontuacao = label.startsWith(alvo) ? 0 : 1;
        return { item, pontuacao };
      })
      .filter((v): v is { item: ItemMenuLateral; pontuacao: number } => v !== null)
      .sort((a, b) => a.pontuacao - b.pontuacao || a.item.label.localeCompare(b.item.label));
    return comPontuacao.slice(0, 8).map((v) => v.item);
  }, [consulta, itensUnicos]);

  const fechar = useCallback(() => {
    setAberto(false);
    setConsulta("");
    setIndiceSelecionado(0);
  }, []);

  const navegarPara = useCallback(
    (href: string) => {
      fechar();
      router.push(href);
    },
    [fechar, router]
  );

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const teclaK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && teclaK) {
        e.preventDefault();
        setAberto((v) => !v);
        return;
      }
      if (e.key === "Escape" && aberto) {
        e.preventDefault();
        fechar();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);

  useEffect(() => {
    if (aberto) {
      // Espera o modal montar antes de focar (evita perder o foco no primeiro render).
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [aberto]);

  useEffect(() => {
    setIndiceSelecionado(0);
  }, [consulta]);

  function aoTeclarNaLista(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = resultados[indiceSelecionado];
      if (alvo) navegarPara(alvo.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="glass-nav-texto-muted flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm transition hover:bg-white/10"
        aria-label="Buscar telas (Cmd+K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Buscar...</span>
        <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center bg-slate-900/50 px-4 pt-[12vh]"
          onClick={fechar}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={aoTeclarNaLista}
                placeholder="Buscar uma tela (dashboard, veículos, financeiro...)"
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={fechar}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Fechar busca"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {resultados.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  Nenhuma tela encontrada.
                </li>
              )}
              {resultados.map((item, i) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => navegarPara(item.href)}
                    onMouseEnter={() => setIndiceSelecionado(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      i === indiceSelecionado ? "bg-frota-50 text-frota-500" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1 truncate">{item.label}</span>
                    {i === indiceSelecionado && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
