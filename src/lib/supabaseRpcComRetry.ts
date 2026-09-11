import "server-only";

import { logger } from "@/lib/logger";

// Fase Pente-Fino-Performance (11/09/2026, achado real via log do Postgres):
// páginas como /inteligencia-rede disparam ~20 RPCs em paralelo num único
// `Promise.all`. Cada RPC isolada roda em <2s, mas com tantas concorrentes
// algumas são canceladas por "statement timeout"/"canceling statement" —
// contenção de conexão/recursos, não lentidão da query em si. Como o padrão
// hoje é sempre `?? []` no fallback, um erro assim vira silenciosamente
// "0 resultados" sem nenhum rastro (foi exatamente o que aconteceu com os
// cards "Postos com preço acima do ANP" e "Cobertura x Demanda" —
// intermitente, difícil de reproduzir manualmente).
//
// Esse helper só acrescenta retry com pequeno backoff antes de desistir: não
// muda nomes de RPC, parâmetros nem o formato do retorno — devolve o mesmo
// shape `{ data, error }` que `supabase.rpc(...)` sempre devolveu, pra o
// código que chama continuar aplicando seu próprio fallback (`?? []`,
// `?? 0` etc.) exatamente como fazia antes.
//
// Recebe a chamada já pronta como uma função (`() => supabase.rpc(...)`) em
// vez de reconstruir a chamada a partir de nome+params: assim o TypeScript
// infere `T` a partir do retorno real de `supabase.rpc(...)` — que já vem
// tipado pelos tipos gerados do banco (src/types/database.types.ts) — sem
// precisar declarar o tipo de cada RPC à mão nem cair em `unknown`/`any`.
//
// Trata qualquer erro como potencialmente transitório (não só timeout) —
// reconhece mensagens de timeout pra fins de log/diagnóstico, mas não deixa
// de tentar de novo só porque a mensagem não bate com o padrão esperado
// (outras falhas transitórias, ex.: conexão caindo no meio, também se
// beneficiam do retry).
const MENSAGENS_TIMEOUT = ["statement timeout", "canceling statement"];

function ehErroDeTimeout(mensagem: string): boolean {
  const normalizada = mensagem.toLowerCase();
  return MENSAGENS_TIMEOUT.some((m) => normalizada.includes(m));
}

function extrairMensagemErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "message" in erro) {
    const mensagem = (erro as { message?: unknown }).message;
    if (typeof mensagem === "string") return mensagem;
  }
  return String(erro);
}

type ResultadoRpc<T> = { data: T | null; error: unknown };

// `chamar` é a chamada RPC pronta pra ser (re)executada, ex.:
// `() => supabase.rpc("postos_gf_por_uf")`. `nome` é só pra log/rastreio
// (não afeta a chamada em si — quem decide o que é chamado é `chamar`).
export async function rpcComRetry<T>(
  chamar: () => PromiseLike<ResultadoRpc<T>>,
  nome: string,
  opcoes?: { tentativas?: number; delayBaseMs?: number }
): Promise<ResultadoRpc<T>> {
  const tentativas = Math.max(1, opcoes?.tentativas ?? 3);
  const delayBaseMs = opcoes?.delayBaseMs ?? 300;

  let ultimoResultado: ResultadoRpc<T> = { data: null, error: null };

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resultado = await chamar();
    ultimoResultado = resultado;

    if (!resultado.error) {
      if (tentativa > 1) {
        void logger.warn("supabaseRpcComRetry", `RPC ${nome} teve sucesso após retry`, {
          nome,
          tentativa,
        });
      }
      return resultado;
    }

    const mensagem = extrairMensagemErro(resultado.error);
    const ehTimeout = ehErroDeTimeout(mensagem);
    const restam = tentativas - tentativa;

    if (restam > 0) {
      void logger.warn("supabaseRpcComRetry", `RPC ${nome} falhou, tentando de novo`, {
        nome,
        tentativa,
        tentativasRestantes: restam,
        ehTimeout,
        erro: mensagem,
      });
      await new Promise((resolve) => setTimeout(resolve, delayBaseMs * tentativa));
      continue;
    }

    void logger.error("supabaseRpcComRetry", `RPC ${nome} esgotou todas as tentativas (${tentativas})`, resultado.error, {
      nome,
      tentativas,
      ehTimeout,
    });
  }

  return ultimoResultado;
}
