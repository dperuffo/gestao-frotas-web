import "server-only";
import { logger } from "@/lib/logger";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "o cache deve
// ter hit/miss tracking") — não existia NENHUMA camada de cache real na
// aplicação até aqui (achado da recon: só o cache padrão de fetch do
// Next.js, num único lugar). Este módulo é essa camada — simples de
// propósito: um Map em memória com expiração por tempo (TTL), com hit/miss
// já logado desde o primeiro uso.
//
// Limitação importante, documentada aqui pra não virar surpresa depois:
// isto é cache POR PROCESSO — se o serviço no Railway rodar com mais de 1
// réplica, cada réplica tem seu próprio cache, sem sincronia entre elas
// (uma pode servir dado com até `ttlMs` de atraso em relação à outra). Pra
// hoje (serviço com 1 réplica) não tem efeito prático nenhum; se um dia
// escalar pra múltiplas réplicas, aí sim compensaria migrar pra algo
// compartilhado (Redis/Upstash) — não antes, seria complexidade sem
// benefício real agora.
type EntradaCache<T> = { valor: T; expiraEm: number };

const armazenamento = new Map<string, EntradaCache<unknown>>();

// Busca `chave` no cache; se não tiver (ou tiver vencido), roda `calcular`,
// guarda o resultado por `ttlMs` e devolve. Todo hit/miss é logado — é
// assim que dá pra responder "esse cache está ajudando ou não" só olhando
// os logs, sem precisar instrumentar cada lugar que usa isto.
export async function obterOuDefinir<T>(chave: string, ttlMs: number, calcular: () => Promise<T>): Promise<T> {
  const agora = Date.now();
  const entrada = armazenamento.get(chave);

  if (entrada && entrada.expiraEm > agora) {
    await logger.debug("cache", "hit", { chave, expiraEmMs: entrada.expiraEm - agora });
    return entrada.valor as T;
  }

  await logger.debug("cache", "miss", { chave });
  const inicio = Date.now();
  const valor = await calcular();
  armazenamento.set(chave, { valor, expiraEm: agora + ttlMs });
  await logger.debug("cache", "preenchido", { chave, ttlMs, duracaoCalculoMs: Date.now() - inicio });
  return valor;
}

// Remove uma chave específica — usar logo depois de uma escrita que torna o
// valor cacheado desatualizado (ex.: salvar uma permissão nova).
export function invalidar(chave: string): void {
  armazenamento.delete(chave);
}

// Remove todas as chaves que começam com `prefixo` — útil quando uma escrita
// invalida "uma família" de chaves de uma vez (ex.: qualquer cache de
// permissões, de qualquer perfil).
export function invalidarPrefixo(prefixo: string): void {
  for (const chave of armazenamento.keys()) {
    if (chave.startsWith(prefixo)) armazenamento.delete(chave);
  }
}

// Variante "silenciosa" (sem hit/miss no log — não é esse tipo de cache):
// devolve `true` se `chave` já foi marcada como vista há menos de `ttlMs`,
// senão marca agora e devolve `false`. Usado por src/lib/alertas.ts pra não
// mandar o mesmo alerta repetido inúmeras vezes seguidas (ex.: health check
// falhando a cada poucos minutos, ou o mesmo erro batendo em vários
// usuários ao mesmo tempo) — mesma estrutura de Map+TTL de cima, reusada
// pra deduplicação em vez de cache de valor.
export function jaVisto(chave: string, ttlMs: number): boolean {
  const agora = Date.now();
  const entrada = armazenamento.get(chave);
  if (entrada && entrada.expiraEm > agora) return true;
  armazenamento.set(chave, { valor: true, expiraEm: agora + ttlMs });
  return false;
}
