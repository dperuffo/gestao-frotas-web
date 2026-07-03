"use client";

import { useEffect, useState } from "react";
import type { PassoTour } from "@/lib/ajuda/tourPassos";

// Camada visual do tour (Fase 24): escurece a tela inteira e recorta um
// "spotlight" ao redor do elemento marcado com data-tour="<passo.alvo>",
// usando o truque de box-shadow gigante em vez de clip-path (mais simples
// de acertar com cantos arredondados e sem precisar de SVG mask). O balão
// com o texto do passo fica logo abaixo do elemento destacado; se não
// couber (perto do rodapé da tela), sobe pra cima dele.
export function TourOverlay({
  passo,
  indice,
  total,
  onProximo,
  onAnterior,
  onPular,
}: {
  passo: PassoTour;
  indice: number;
  total: number;
  onProximo: () => void;
  onAnterior: () => void;
  onPular: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // O menu lateral cresceu (Cadastros/Operação/Administração) e passou a
  // ficar mais alto que a tela em telas menores — a página inteira rola
  // (não só a barra lateral), então o alvo de um passo perto do topo
  // (logo) ou do rodapé (central de ajuda) pode estar fora da área visível
  // dependendo de onde a página estava rolada quando o tour abriu. Por
  // isso, a cada passo, rola o alvo pro centro da tela antes de medir a
  // posição — e recalcula durante a rolagem (inclusive a rolagem
  // disparada pelo próprio scrollIntoView) pra o spotlight/balão
  // acompanharem certinho.
  useEffect(() => {
    const el = document.querySelector(`[data-tour="${passo.alvo}"]`);
    if (!el) {
      setRect(null);
      return;
    }

    function recalcular() {
      setRect(el!.getBoundingClientRect());
    }

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    recalcular();

    window.addEventListener("scroll", recalcular, true);
    window.addEventListener("resize", recalcular);
    return () => {
      window.removeEventListener("scroll", recalcular, true);
      window.removeEventListener("resize", recalcular);
    };
  }, [passo.alvo]);

  // Sem o elemento alvo na tela (ex.: item de menu escondido pro perfil
  // admin) — ainda mostra o balão centralizado, só sem o spotlight.
  const margem = 6;
  const estiloSpotlight: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: rect.top - margem,
        left: rect.left - margem,
        width: rect.width + margem * 2,
        height: rect.height + margem * 2,
        borderRadius: 10,
        boxShadow: "0 0 0 9999px rgba(11, 18, 32, 0.72)",
        transition: "all 0.2s ease",
        zIndex: 100,
        pointerEvents: "none",
      }
    : {
        position: "fixed",
        inset: 0,
        background: "rgba(11, 18, 32, 0.72)",
        zIndex: 100,
      };

  // Altura aproximada do balão (título + texto + botões) usada só pra
  // clamping — não precisa ser exata, é só pra garantir que ele nunca
  // nasça com uma borda cortada fora da tela, mesmo em telas baixas ou
  // no meio de uma rolagem (scrollIntoView é assíncrono, então o rect
  // usado num render intermediário pode ainda não refletir a posição
  // final do alvo).
  const alturaBalaoEstimada = 190;
  const espacoAbaixo = rect ? window.innerHeight - rect.bottom : 0;
  const balaoAcima = rect ? espacoAbaixo < 180 : false;
  const estiloBalao: React.CSSProperties = rect
    ? {
        position: "fixed",
        left: Math.min(Math.max(rect.left, 16), window.innerWidth - 320),
        top: balaoAcima
          ? undefined
          : Math.min(rect.bottom + 12, window.innerHeight - alturaBalaoEstimada - 12),
        bottom: balaoAcima ? Math.max(12, window.innerHeight - rect.top + 12) : undefined,
        zIndex: 101,
      }
    : {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101,
      };

  return (
    <>
      <div style={estiloSpotlight} />
      <div style={estiloBalao} className="w-80 rounded-xl border border-frota-500/30 bg-white p-4 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-frota-600">
          Passo {indice + 1} de {total}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{passo.titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{passo.texto}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onPular} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Pular tour
          </button>
          <div className="flex gap-2">
            {indice > 0 && (
              <button type="button" onClick={onAnterior} className="btn-secondary px-3 py-1.5 text-xs">
                Anterior
              </button>
            )}
            <button type="button" onClick={onProximo} className="btn-primary px-3 py-1.5 text-xs">
              {indice + 1 >= total ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
