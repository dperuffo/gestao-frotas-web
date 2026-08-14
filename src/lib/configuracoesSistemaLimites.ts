// Fase Observabilidade-Fase3 (14/08/2026) — bug real em produção (deploy
// falhou, Railway apontou certinho a causa): FormularioLogoutInatividade.tsx
// (Client Component) importava constantes de src/lib/configuracoesSistema.ts
// — que, depois da Fase 3 ganhar cache (`import { obterOuDefinir } from
// "@/lib/cache"`), passou a arrastar `import "server-only"` (de cache.ts e
// logger.ts) pra dentro de um Client Component. Next.js recusa isso na
// hora do build (`server-only` existe exatamente pra barrar esse tipo de
// vazamento sem querer).
//
// Correção: as poucas coisas PURAS (sem I/O, sem cache, sem logger) que um
// Client Component pode legitimamente precisar — os limites e a validação —
// ficam isoladas aqui, num arquivo sem NENHUM import "server-only" na
// cadeia. `configuracoesSistema.ts` (que tem o resto: busca/grava no banco,
// com cache) importa DESTE arquivo, não o contrário — assim o Client
// Component pode importar só o que é seguro pra ele, sem arrastar o resto.
export const LOGOUT_INATIVIDADE_MINUTOS_PADRAO = 30;
export const LOGOUT_INATIVIDADE_MINUTOS_MIN = 5;
export const LOGOUT_INATIVIDADE_MINUTOS_MAX = 480;

export function validarLogoutInatividadeMinutos(minutos: number): string | undefined {
  if (!Number.isInteger(minutos)) {
    return "O tempo precisa ser um número inteiro de minutos.";
  }
  if (minutos < LOGOUT_INATIVIDADE_MINUTOS_MIN || minutos > LOGOUT_INATIVIDADE_MINUTOS_MAX) {
    return `O tempo precisa estar entre ${LOGOUT_INATIVIDADE_MINUTOS_MIN} e ${LOGOUT_INATIVIDADE_MINUTOS_MAX} minutos.`;
  }
  return undefined;
}
