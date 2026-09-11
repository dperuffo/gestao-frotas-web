"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X, Truck, UserRound, Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Fase UX-Navegacao — HOTFIX (27/08/2026): ItemBusca.icon é um
// componente (LucideIcon, ou seja, uma função). Passar esse tipo direto
// como prop de um Server Component (layout.tsx) pra este Client Component
// quebra a produção ("Functions cannot be passed directly to Client
// Components..." — mesma causa raiz já corrigida antes em
// ItemMenuAtivo.tsx). A correção é a mesma: o servidor pré-renderiza o
// ícone como JSX (`iconNode`) e só isso atravessa a fronteira — nunca o
// componente cru.
export type ItemBusca = { href: string; label: string; iconNode?: ReactNode };

// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação", item do roadmap "Busca global (atalho de
// teclado)") — com 67 áreas permissionadas e a lista de telas dividida em 9+
// grupos temáticos no menu lateral, achar uma tela específica hoje depende
// de saber em qual grupo ela mora. Este componente indexa a MESMA lista de
// itens já filtrada por permissão em layout.tsx (nada de duplicar a lógica
// de `podeAcessarItem` aqui) e abre com Cmd/Ctrl+K de qualquer tela do
// painel.
//
// Fase Auditoria-UX (08/09/2026, pedido do Daniel: ajustes recomendados numa
// auditoria de UX) — a lacuna documentada na 1ª versão ("busca só telas, não
// dados") foi fechada: a partir de 2 caracteres, dispara (debounced) uma
// busca em paralelo por VEÍCULO (placa/marca/modelo) e MOTORISTA (nome/CPF)
// direto no Supabase, client-side. Sem RPC nova — os dois `.from(...)` já
// passam pela RLS de sempre (`cadastro_veiculos_membro`/`motoristas_membro`),
// então cada usuário só vê o que já teria acesso navegando manualmente; não
// precisa de p_empresa_id explícito. Os 2 tipos de resultado dinâmico
// entram na MESMA lista dos resultados estáticos (telas), com uma "seção"
// (rótulo pequeno) e ícone diferentes pra não confundir.
type ResultadoBusca = {
  id: string;
  href: string;
  label: string;
  sublabel?: string;
  secao: "Telas" | "Veículos" | "Motoristas" | "Clientes" | "Placas";
  iconNode: ReactNode;
};

const ICONE_VEICULO = <Truck className="h-4 w-4 shrink-0 text-slate-400" />;
const ICONE_MOTORISTA = <UserRound className="h-4 w-4 shrink-0 text-slate-400" />;
// Fase Busca-Global-Posto (09/09/2026) — mesmos ícones de sempre, só que
// pro que existe no tenant posto: Cliente (empresa que negociou com o
// posto) e Placa (veículo de um cliente que já abasteceu aqui — reaproveita
// o ícone de caminhão, o conceito visual é o mesmo).
const ICONE_CLIENTE = <Building2 className="h-4 w-4 shrink-0 text-slate-400" />;
const DEBOUNCE_MS = 300;
const TERMO_MIN_CHARS = 2;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BuscaGlobal({ itens, ehPosto = false }: { itens: ItemBusca[]; ehPosto?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const [resultadosDinamicos, setResultadosDinamicos] = useState<ResultadoBusca[]>([]);
  const [buscandoDinamico, setBuscandoDinamico] = useState(false);
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

  const resultadosTelas = useMemo(() => {
    const base: ResultadoBusca[] = itensUnicos.map((item) => ({
      id: `tela-${item.href}`,
      href: item.href,
      label: item.label,
      secao: "Telas" as const,
      iconNode: item.iconNode,
    }));
    const alvo = normalizar(consulta.trim());
    if (!alvo) return base.slice(0, 8);
    const comPontuacao = base
      .map((item) => {
        const label = normalizar(item.label);
        if (!label.includes(alvo)) return null;
        // Prefixo pontua mais que match no meio do texto.
        const pontuacao = label.startsWith(alvo) ? 0 : 1;
        return { item, pontuacao };
      })
      .filter((v): v is { item: ResultadoBusca; pontuacao: number } => v !== null)
      .sort((a, b) => a.pontuacao - b.pontuacao || a.item.label.localeCompare(b.item.label));
    return comPontuacao.slice(0, 8).map((v) => v.item);
  }, [consulta, itensUnicos]);

  // Fase Auditoria-UX (08/09/2026) — busca dinâmica (veículo/motorista),
  // debounced pra não disparar uma query a cada tecla. Sem RPC nova: os 2
  // `.from(...)` abaixo já passam pela RLS de sempre (ver comentário no topo
  // do arquivo), então cada usuário só vê o que já teria acesso. Cancela a
  // busca anterior (flag `cancelado`) se o usuário continuar digitando antes
  // dela voltar — evita um resultado antigo "vencer" um mais recente
  // (race condition clássica de busca-conforme-digita).
  useEffect(() => {
    const termo = consulta.trim();
    if (termo.length < TERMO_MIN_CHARS) {
      setResultadosDinamicos([]);
      setBuscandoDinamico(false);
      return;
    }
    // PostgREST usa vírgula/parênteses como separador do próprio filtro
    // `.or(...)` — removidos do termo pra não quebrar a sintaxe da consulta
    // (não é uma questão de segurança, a RLS protege os dados de qualquer
    // forma; é só pra busca não dar erro com esses caracteres).
    const termoEscapado = termo.replace(/[%,()]/g, "");
    if (!termoEscapado) {
      setResultadosDinamicos([]);
      setBuscandoDinamico(false);
      return;
    }
    let cancelado = false;
    setBuscandoDinamico(true);
    const idTimeout = window.setTimeout(async () => {
      const supabase = createClient();

      // Fase Busca-Global-Posto (09/09/2026, pedido do Daniel: "ajustar os
      // filtros de busca para a visão do posto") — cadastro_veiculos/
      // motoristas são conceitos do tenant FROTA; o tenant POSTO (vendedor)
      // não tem veículo/motorista próprio, então essa busca sempre dava
      // "nada encontrado" pro posto (achado real: buscar uma placa de
      // cliente não retornava nada). Pro posto, busca Clientes (que
      // negociaram com ele) e Placas (de clientes que já abasteceram nele)
      // via as 2 RPCs dedicadas (SECURITY DEFINER, auto-escopadas pelo
      // próprio e-mail do JWT — ver busca_global_posto.sql).
      if (ehPosto) {
        const [clientesRes, placasRes] = await Promise.all([
          supabase.rpc("busca_global_clientes_posto", { p_termo: termoEscapado }),
          supabase.rpc("busca_global_placas_clientes_posto", { p_termo: termoEscapado }),
        ]);
        if (cancelado) return;
        const clientes: ResultadoBusca[] = (clientesRes.data ?? []).map((cl) => ({
          id: `cliente-${cl.id}`,
          href: `/clientes-posto/${cl.id}`,
          label: cl.nome ?? "—",
          sublabel: [cl.municipio, cl.uf].filter(Boolean).join("/") || undefined,
          secao: "Clientes" as const,
          iconNode: ICONE_CLIENTE,
        }));
        const placas: ResultadoBusca[] = (placasRes.data ?? []).map((p, i) => ({
          id: `placa-${p.placa}-${p.cliente_id}-${i}`,
          href: p.cliente_id ? `/clientes-posto/${p.cliente_id}` : "/clientes-posto",
          label: p.placa ?? "—",
          sublabel: p.cliente_nome ?? undefined,
          secao: "Placas" as const,
          iconNode: ICONE_VEICULO,
        }));
        setResultadosDinamicos([...clientes, ...placas]);
        setBuscandoDinamico(false);
        return;
      }

      const [veiculosRes, motoristasRes] = await Promise.all([
        supabase
          .from("cadastro_veiculos")
          .select("id, placa, marca, modelo")
          .or(`placa.ilike.%${termoEscapado}%,marca.ilike.%${termoEscapado}%,modelo.ilike.%${termoEscapado}%`)
          .limit(5),
        supabase
          .from("motoristas")
          .select("id, nome_completo, cpf")
          .or(`nome_completo.ilike.%${termoEscapado}%,cpf.ilike.%${termoEscapado}%`)
          .limit(5),
      ]);
      if (cancelado) return;
      const veiculos: ResultadoBusca[] = (veiculosRes.data ?? []).map((v) => ({
        id: `veiculo-${v.id}`,
        href: `/veiculos/${v.id}`,
        label: v.placa ?? "—",
        sublabel: [v.marca, v.modelo].filter(Boolean).join(" ") || undefined,
        secao: "Veículos" as const,
        iconNode: ICONE_VEICULO,
      }));
      const motoristas: ResultadoBusca[] = (motoristasRes.data ?? []).map((m) => ({
        id: `motorista-${m.id}`,
        href: `/motoristas/${m.id}`,
        label: m.nome_completo ?? "—",
        sublabel: m.cpf ?? undefined,
        secao: "Motoristas" as const,
        iconNode: ICONE_MOTORISTA,
      }));
      setResultadosDinamicos([...veiculos, ...motoristas]);
      setBuscandoDinamico(false);
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      window.clearTimeout(idTimeout);
    };
  }, [consulta, ehPosto]);

  const resultados = useMemo(() => {
    if (!consulta.trim()) return resultadosTelas;
    return [...resultadosTelas.slice(0, 5), ...resultadosDinamicos];
  }, [consulta, resultadosTelas, resultadosDinamicos]);

  const fechar = useCallback(() => {
    setAberto(false);
    setConsulta("");
    setIndiceSelecionado(0);
    setResultadosDinamicos([]);
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
        className="glass-nav-texto-muted flex w-full items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 px-3 py-2 text-left text-sm transition hover:bg-slate-200"
        aria-label={ehPosto ? "Buscar telas, clientes e placas (Cmd+K)" : "Buscar telas, veículos e motoristas (Cmd+K)"}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Buscar...</span>
        <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center bg-slate-900/50 px-4 pt-[12vh]"
          onClick={fechar}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={aoTeclarNaLista}
                placeholder={ehPosto ? "Buscar uma tela, cliente ou placa..." : "Buscar uma tela, veículo (placa) ou motorista..."}
                className="w-full border-none bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
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
              {resultados.length === 0 && !buscandoDinamico && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  {consulta.trim().length >= TERMO_MIN_CHARS
                    ? ehPosto
                      ? "Nada encontrado — nem tela, nem cliente, nem placa."
                      : "Nada encontrado — nem tela, nem veículo, nem motorista."
                    : "Nenhuma tela encontrada."}
                </li>
              )}
              {resultados.map((item, i) => {
                // Seção nova? mostra um rótulo pequeno antes do item (só
                // quando há mais de um tipo de resultado na lista — busca
                // vazia só tem "Telas", não precisa do rótulo repetido).
                const secaoAnterior = i > 0 ? resultados[i - 1].secao : null;
                const mostrarRotuloSecao = consulta.trim().length >= TERMO_MIN_CHARS && item.secao !== secaoAnterior;
                return (
                  <li key={item.id}>
                    {mostrarRotuloSecao && (
                      <p className="mb-1 mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 first:mt-0">
                        {item.secao}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => navegarPara(item.href)}
                      onMouseEnter={() => setIndiceSelecionado(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        i === indiceSelecionado ? "bg-frota-50 text-frota-500" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {item.iconNode}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" title={item.label}>{item.label}</span>
                        {item.sublabel && (
                          <span className="block truncate text-xs text-slate-400" title={item.sublabel}>{item.sublabel}</span>
                        )}
                      </span>
                      {i === indiceSelecionado && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </button>
                  </li>
                );
              })}
              {buscandoDinamico && (
                <li className="px-3 py-2 text-center text-xs text-slate-400">Buscando veículos e motoristas...</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
