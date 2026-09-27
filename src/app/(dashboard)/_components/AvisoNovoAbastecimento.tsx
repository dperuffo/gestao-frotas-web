"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fuel, X } from "lucide-react";
import { useBadgesMenu } from "./ProvedorBadgesMenu";
import { novosAbastecimentosAcao, type NovoAbastecimento } from "./novosAbastecimentosActions";

// Fase Aviso-Novo-Abastecimento (27/09/2026) — aviso flutuante ("push" dentro
// do sistema) quando entra um abastecimento novo da frota, no mesmo estilo
// do demo interativo da landing. Não tem ciclo próprio de consulta: pega
// carona no <ProvedorBadgesMenu>, que já consulta o servidor ao trocar de
// tela, ao voltar para a aba e a cada 60s. Ver novosAbastecimentosActions.ts
// para o critério de "novo" e o escopo por perfil.

const DURACAO_MS = 8000;
const MAX_VISIVEIS = 3;
const CHAVE_SILENCIO = "fni-avisos-abastecimento-silenciados";

type Aviso = { chave: string; titulo: string; texto: string };

function formatarReais(v: number | null) {
  return v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function montarAviso(a: NovoAbastecimento): Aviso {
  const litros = a.litros != null ? `${a.litros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L` : null;
  const local = [a.postoNome, a.municipio && a.uf ? `${a.municipio}/${a.uf}` : a.municipio].filter(Boolean).join(" · ");
  const partes = [litros && a.produto ? `${litros} de ${a.produto.toLowerCase()}` : litros ?? a.produto, formatarReais(a.valorTotal)].filter(Boolean);
  return {
    chave: `${a.id}-${a.data}`,
    titulo: a.placa ? `Novo abastecimento · ${a.placa}` : "Novo abastecimento",
    texto: [partes.join(" · "), local, a.motoristaNome ? `Motorista: ${a.motoristaNome}` : null].filter(Boolean).join("\n"),
  };
}

function lerSilencio() {
  try {
    return localStorage.getItem(CHAVE_SILENCIO) === "1";
  } catch {
    return false;
  }
}

export function AvisoNovoAbastecimento() {
  const ctx = useBadgesMenu();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [silenciado, setSilenciado] = useState(false);
  const marcador = useRef<string | null>(null);
  const buscando = useRef(false);

  useEffect(() => setSilenciado(lerSilencio()), []);

  const fechar = useCallback((chave: string) => setAvisos((l) => l.filter((a) => a.chave !== chave)), []);

  const verificar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    try {
      const r = await novosAbastecimentosAcao(marcador.current);
      marcador.current = r.marcador;
      if (!r.itens.length || lerSilencio()) return;
      const novos = r.itens.map(montarAviso);
      if (novos.length > MAX_VISIVEIS) {
        const extras = novos.length - (MAX_VISIVEIS - 1);
        novos.splice(MAX_VISIVEIS - 1, novos.length, {
          chave: `resumo-${Date.now()}`,
          titulo: `Mais ${extras} abastecimentos novos`,
          texto: "Abra a tela de abastecimentos para ver todos.",
        });
      }
      setAvisos((l) => [...novos.reverse(), ...l].slice(0, MAX_VISIVEIS));
      novos.forEach((a) => window.setTimeout(() => fechar(a.chave), DURACAO_MS));
    } catch {
      // Falha silenciosa: tenta de novo no próximo ciclo.
    } finally {
      buscando.current = false;
    }
  }, [fechar]);

  // Linha de base ao abrir o sistema + nova verificação a cada atualização
  // das bolinhas.
  useEffect(() => {
    void verificar();
    if (!ctx) return;
    return ctx.assinar(() => void verificar());
  }, [ctx, verificar]);

  const silenciar = () => {
    try {
      localStorage.setItem(CHAVE_SILENCIO, "1");
    } catch {
      // navegador sem armazenamento: só esconde nesta sessão
    }
    setSilenciado(true);
    setAvisos([]);
  };

  if (silenciado || avisos.length === 0) return null;

  return (
    <>
    <style>{`@keyframes fni-aviso-entrada{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){[role=status]{animation:none!important}}`}</style>
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {avisos.map((a) => (
        <div
          key={a.chave}
          role="status"
          style={{ animation: "fni-aviso-entrada 0.35s ease-out" }}
          className="pointer-events-auto rounded-xl border border-slate-200 border-l-4 border-l-sky-500 bg-white p-3 shadow-lg dark:border-slate-700 dark:border-l-sky-400 dark:bg-slate-800"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300">
              <Fuel className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.titulo}</p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">{a.texto}</p>
              <div className="mt-2 flex gap-3 text-xs">
                <Link href="/abastecimentos" onClick={() => fechar(a.chave)} className="font-semibold text-sky-600 hover:underline dark:text-sky-300">
                  Ver abastecimentos
                </Link>
                <button type="button" onClick={silenciar} className="text-slate-500 hover:underline dark:text-slate-400">
                  Não mostrar mais
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fechar(a.chave)}
              aria-label="Fechar aviso"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
