"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { marcarAvisoLidoAcao, type AvisoParaUsuario } from "../administracao/central-avisos/actions";
import { AvisosDrawer } from "./AvisosDrawer";

// Fase Central-Avisos (28/07/2026) — sino no rodapé do menu lateral, ao lado
// da Central de Ajuda, com badge de não lidos. Recebe a lista já resolvida
// (segmentada + com `lido` calculado) do layout.tsx — mesmo padrão das
// demais contagens do menu (falha vira 0, calculado server-side em
// Promise.all). Estado local otimista: marcar como lido some do badge na
// hora, sem esperar o round-trip da Server Action.
export function AvisosSino({ avisosIniciais }: { avisosIniciais: AvisoParaUsuario[] }) {
  const [avisos, setAvisos] = useState(avisosIniciais);
  const [aberto, setAberto] = useState(false);
  const naoLidos = avisos.filter((a) => !a.lido).length;

  function marcarLido(id: string) {
    setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, lido: true } : a)));
    marcarAvisoLidoAcao(id).catch(() => {});
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-900/5"
      >
        <Bell className="h-4 w-4 shrink-0 text-slate-500" />
        Avisos
        {naoLidos > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
            {naoLidos}
          </span>
        )}
      </button>
      <AvisosDrawer aberto={aberto} onFechar={() => setAberto(false)} avisos={avisos} onMarcarLido={marcarLido} />
    </>
  );
}
