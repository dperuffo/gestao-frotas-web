// Paginação simples (limit/offset) compartilhada pelos endpoints de leitura
// de cadastros (Fase 25) — pequeno o bastante pra não precisar de cursor,
// mas com teto pra um integrador não pedir a tabela inteira de uma vez.
const LIMITE_PADRAO = 100;
const LIMITE_MAXIMO = 500;

export function lerPaginacao(url: URL): { limit: number; offset: number } {
  const limitParam = Number(url.searchParams.get("limit"));
  const offsetParam = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, LIMITE_MAXIMO) : LIMITE_PADRAO;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;
  return { limit, offset };
}
