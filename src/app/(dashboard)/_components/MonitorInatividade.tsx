"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CHAVE_ULTIMA_ATIVIDADE = "fni_ultima_atividade";
const INTERVALO_VERIFICACAO_MS = 15_000;
const THROTTLE_REGISTRO_MS = 5_000;
const EVENTOS_ATIVIDADE = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

// Fase 27.86 — pedido do Daniel: "Implementar logout automatico por um
// período de inatividade do usuario no sistema. Parametrizavel em tela de
// configuração do admin" (ver /configuracoes e src/lib/configuracoesSistema.ts).
//
// Monta um listener global de atividade (mouse/teclado/toque/scroll) e um
// timer que confere periodicamente se o tempo parado passou do limite
// configurado — se sim, desloga e manda pra /login com um aviso.
//
// A última atividade é gravada no localStorage (não só em memória) pra
// funcionar entre ABAS diferentes do mesmo navegador: mexer em qualquer
// aba aberta do sistema conta como atividade pra todas — evita deslogar
// uma aba "parada" (ex.: um relatório aberto de leitura) enquanto o
// usuário está ativamente trabalhando em outra aba do mesmo sistema.
export function MonitorInatividade({ minutos }: { minutos: number }) {
  const router = useRouter();
  const ultimoRegistroRef = useRef(0);

  useEffect(() => {
    // minutos <= 0 (não deveria acontecer — validado na tela de admin,
    // mínimo 5 — mas serve de trava de segurança) desativa o monitor.
    if (!minutos || minutos <= 0) return;

    const limiteMs = minutos * 60_000;
    const supabase = createClient();
    let cancelado = false;

    function registrarAtividade() {
      const agora = Date.now();
      if (agora - ultimoRegistroRef.current < THROTTLE_REGISTRO_MS) return;
      ultimoRegistroRef.current = agora;
      try {
        window.localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(agora));
      } catch {
        // localStorage indisponível (modo privado, quota etc.) — segue só
        // com o controle em memória desta aba.
      }
    }

    async function verificarInatividade() {
      if (cancelado) return;
      const registrado = Number(window.localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE) ?? 0);
      const ultimaAtividade = registrado || ultimoRegistroRef.current || Date.now();
      if (Date.now() - ultimaAtividade < limiteMs) return;

      cancelado = true;
      await supabase.auth.signOut();
      router.push("/login?motivo=inatividade");
      router.refresh();
    }

    // Carregar a tela já conta como atividade — evita deslogar alguém que
    // só agora abriu o sistema mas o localStorage tinha um registro velho
    // de uma visita muito anterior.
    registrarAtividade();

    EVENTOS_ATIVIDADE.forEach((evento) =>
      window.addEventListener(evento, registrarAtividade, { passive: true })
    );
    const intervalo = window.setInterval(verificarInatividade, INTERVALO_VERIFICACAO_MS);

    return () => {
      cancelado = true;
      EVENTOS_ATIVIDADE.forEach((evento) => window.removeEventListener(evento, registrarAtividade));
      window.clearInterval(intervalo);
    };
  }, [minutos, router]);

  return null;
}
