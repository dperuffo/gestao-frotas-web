"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Garante que a tela mostre o resultado de qualquer alteração (inativar, ativar, mudar um
// seletor, salvar) sem o usuário precisar apertar F5. Mais de 180 componentes dependem de a
// Server Action chamar revalidatePath() com o caminho certo; quando um caminho não cobre a tela
// onde o usuário está (ex.: ação na lista, tela de detalhe aberta), a interface ficava velha.
//
// Como funciona: toda Server Action é um POST do Next com o cabeçalho "Next-Action". Quando uma
// termina com sucesso, pedimos ao Next para recarregar os dados da tela atual em segundo plano
// (router.refresh): o estado local (campos digitados, scroll, modais abertos) é preservado, só
// os dados vindos do servidor são renovados. Várias ações seguidas viram uma só atualização.
//
// Fica de fora: o chat do Assistente (/assistente), onde não há lista para atualizar e cada
// pergunta já custa caro; ações que redirecionam (o Next já troca de tela); e abas ocultas.
const ESPERA_MS = 350;

function ehAcaoDoServidor(input: RequestInfo | URL, init?: RequestInit): boolean {
  const cabecalhos = init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
  if (!cabecalhos) return false;
  if (cabecalhos instanceof Headers) return cabecalhos.has("Next-Action");
  if (Array.isArray(cabecalhos)) return cabecalhos.some(([nome]) => nome.toLowerCase() === "next-action");
  return Object.keys(cabecalhos).some((nome) => nome.toLowerCase() === "next-action");
}

export function AtualizarTelaAposAcao() {
  const router = useRouter();
  const pathname = usePathname();
  // Refs para o interceptador (instalado uma vez) enxergar sempre o valor mais novo.
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

  useEffect(() => {
    const fetchOriginal = window.fetch;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function agendarAtualizacao() {
      if (pathnameRef.current.startsWith("/assistente")) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        routerRef.current.refresh();
      }, ESPERA_MS);
    }

    window.fetch = async function fetchComAtualizacao(input: RequestInfo | URL, init?: RequestInit) {
      const resposta = await fetchOriginal.call(window, input, init);
      try {
        if (resposta.ok && ehAcaoDoServidor(input, init) && !resposta.headers.get("x-action-redirect")) {
          agendarAtualizacao();
        }
      } catch {
        // nunca atrapalhar a requisição original
      }
      return resposta;
    };

    return () => {
      window.fetch = fetchOriginal;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
