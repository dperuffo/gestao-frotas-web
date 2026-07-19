"use client";

import { useEffect, useState } from "react";
import { InstalarPwaModal } from "./InstalarPwaModal";

const CHAVE_DISPENSADO = "fni_lembrete_pwa_dispensado_v1";

// Fase PWA-Lembrete-Mobile (19/07) — pedido do Daniel: "colocar um lembrete
// sobre o benefício de agilidade e gestão na palma da mão, utilizando o PWA
// no mobile", nas visões web de clientes e postos. Renderizado uma vez em
// layout.tsx (arquivo único que cobre os dois lados — Frota e Posto — ver
// comentário de `ehPosto` no próprio layout), então aparece pros dois sem
// duplicar código. Faixa fixa no topo do conteúdo, em toda tela do
// dashboard, até o usuário fechar (a escolha fica salva no localStorage
// deste navegador — reabrir outro dia sem ter fechado ainda mostra de
// novo, é o comportamento esperado de um lembrete recorrente).
export function LembretePwaBanner() {
  const [visivel, setVisivel] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    const jaDispensado = window.localStorage.getItem(CHAVE_DISPENSADO) === "1";
    setVisivel(!jaDispensado);
  }, []);

  function dispensar() {
    window.localStorage.setItem(CHAVE_DISPENSADO, "1");
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-frota-100 bg-gradient-to-r from-frota-50 to-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <p className="text-sm text-slate-700">
            <strong className="font-semibold text-slate-900">Gestão de frotas na palma da mão.</strong> Instale o
            app no seu celular pra ter mais agilidade e compartilhe o app do motorista com a sua equipe.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary text-sm">
            Ver como instalar
          </button>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Fechar lembrete"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      </div>
      <InstalarPwaModal aberto={modalAberto} onFechar={() => setModalAberto(false)} />
    </>
  );
}
