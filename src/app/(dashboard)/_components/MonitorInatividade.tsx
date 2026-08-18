"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { limparAvisosDispensados } from "@/lib/avisosDispensados";

const CHAVE_ULTIMA_ATIVIDADE = "fni_ultima_atividade";
const INTERVALO_VERIFICACAO_MS = 15_000;
const INTERVALO_ATUALIZACAO_CONFIG_MS = 5 * 60_000;
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
//
// Fase 27.118 — achado real (Daniel: "a visão do posto foi deslogada não
// respeitando o período de inatividade" — desconfiado logo depois de mudar
// o parâmetro de 30 pra 120 min): `minutos` chegava como prop fixa, lida
// pelo SERVIDOR uma única vez, no carregamento da página (layout.tsx). Se a
// aba fica aberta sem navegar/recarregar, o componente nunca fica sabendo
// que o admin mudou o parâmetro — continua aplicando o valor de quando a
// página carregou pela última vez. Uma sessão aberta ANTES da mudança pra
// 120 min continuava sendo deslogada em 30 min, o valor antigo. Agora o
// limite atual fica numa ref que é atualizada periodicamente com uma busca
// direta em `configuracoes_sistema` — mudanças do admin passam a valer pra
// sessões já abertas, sem precisar de navegação/reload.
export function MonitorInatividade({ minutos }: { minutos: number }) {
  const router = useRouter();
  const ultimoRegistroRef = useRef(0);
  const minutosAtuaisRef = useRef(minutos);

  useEffect(() => {
    minutosAtuaisRef.current = minutos;
  }, [minutos]);

  useEffect(() => {
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

    async function atualizarConfiguracao() {
      const { data, error } = await supabase
        .from("configuracoes_sistema")
        .select("logout_inatividade_minutos")
        .eq("id", true)
        .maybeSingle();
      if (!error && data?.logout_inatividade_minutos) {
        minutosAtuaisRef.current = data.logout_inatividade_minutos;
      }
      // Falha na busca (rede etc.) mantém o valor já conhecido — não
      // desativa o monitor nem derruba a sessão por causa disso.
    }

    async function verificarInatividade() {
      if (cancelado) return;
      const limiteAtual = minutosAtuaisRef.current;
      if (!limiteAtual || limiteAtual <= 0) return;

      const limiteMs = limiteAtual * 60_000;
      const registrado = Number(window.localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE) ?? 0);
      const ultimaAtividade = registrado || ultimoRegistroRef.current || Date.now();
      if (Date.now() - ultimaAtividade < limiteMs) return;

      cancelado = true;
      await supabase.auth.signOut();
      // Fase Avisos-Reaparecer-Login (18/08/2026) — mesmo motivo do
      // BotaoSair.tsx: logout automático também precisa liberar os avisos
      // dispensados pro próximo login.
      limparAvisosDispensados();
      router.push("/login?motivo=inatividade");
      router.refresh();
    }

    // Carregar a tela já conta como atividade — evita deslogar alguém que
    // só agora abriu o sistema mas o localStorage tinha um registro velho
    // de uma visita muito anterior.
    registrarAtividade();
    // Busca o valor mais recente já na montagem — cobre o caso de uma aba
    // que ficou aberta em segundo plano e só agora voltou a ser observada
    // (o prop `minutos` da SSR pode já estar desatualizado nesse momento).
    atualizarConfiguracao();

    EVENTOS_ATIVIDADE.forEach((evento) =>
      window.addEventListener(evento, registrarAtividade, { passive: true })
    );
    const intervaloVerificacao = window.setInterval(verificarInatividade, INTERVALO_VERIFICACAO_MS);
    const intervaloConfig = window.setInterval(atualizarConfiguracao, INTERVALO_ATUALIZACAO_CONFIG_MS);

    return () => {
      cancelado = true;
      EVENTOS_ATIVIDADE.forEach((evento) => window.removeEventListener(evento, registrarAtividade));
      window.clearInterval(intervaloVerificacao);
      window.clearInterval(intervaloConfig);
    };
  }, [router]);

  return null;
}
