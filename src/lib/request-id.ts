// Fase Observabilidade-Fundacao (14/08/2026) — nome do header isolado num
// arquivo próprio, sem nenhum outro import, porque é usado tanto pelo
// middleware (roda em runtime Edge, não pode depender de `next/headers`/
// `server-only`, que src/lib/logger.ts importa) quanto pelo logger em si
// (Server Components/Actions/Route Handlers, runtime Node). Mudar o nome do
// header num lugar só, sem risco de os dois lados divergirem.
export const CABECALHO_REQUEST_ID = "x-request-id";
