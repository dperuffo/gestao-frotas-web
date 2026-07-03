"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PASSOS_TOUR } from "@/lib/ajuda/tourPassos";
import { marcarTourVistoAcao } from "@/app/(dashboard)/_components/ajudaActions";
import { TourOverlay } from "./TourOverlay";

type ContextoTour = { iniciar: () => void };
const TourContext = createContext<ContextoTour | null>(null);

// Provider do tour guiado de boas-vindas (Fase 24). Fica em volta de todo o
// layout do dashboard: se o usuário ainda não viu o tour (tourJaVisto=false,
// calculado no server a partir de usuarios_app.tour_onboarding_visto), abre
// sozinho no primeiro carregamento da sessão. A Central de Ajuda (no rodapé
// da barra lateral) usa o hook useTour() pra reabrir a qualquer momento.
export function TourProvider({
  tourJaVisto,
  children,
}: {
  tourJaVisto: boolean;
  children: React.ReactNode;
}) {
  const [ativo, setAtivo] = useState(false);
  const [passoIndice, setPassoIndice] = useState(0);

  useEffect(() => {
    if (!tourJaVisto) setAtivo(true);
    // Só na primeira renderização — não quero reabrir sozinho se o usuário
    // fechar manualmente sem "concluir" (ex.: navegou pra outra página).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciar = useCallback(() => {
    setPassoIndice(0);
    setAtivo(true);
  }, []);

  const finalizar = useCallback(() => {
    setAtivo(false);
    if (!tourJaVisto) {
      marcarTourVistoAcao().catch(() => {
        // Falha silenciosa — não crítico, ver comentário em ajudaActions.ts.
      });
    }
  }, [tourJaVisto]);

  const proximo = useCallback(() => {
    setPassoIndice((i) => {
      if (i + 1 >= PASSOS_TOUR.length) {
        finalizar();
        return i;
      }
      return i + 1;
    });
  }, [finalizar]);

  const anterior = useCallback(() => {
    setPassoIndice((i) => Math.max(0, i - 1));
  }, []);

  return (
    <TourContext.Provider value={{ iniciar }}>
      {children}
      {ativo && (
        <TourOverlay
          passo={PASSOS_TOUR[passoIndice]}
          indice={passoIndice}
          total={PASSOS_TOUR.length}
          onProximo={proximo}
          onAnterior={anterior}
          onPular={finalizar}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour(): ContextoTour {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour precisa estar dentro de um <TourProvider>.");
  return ctx;
}
