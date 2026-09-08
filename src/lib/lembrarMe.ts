// Fase Auditoria-UX (08/09/2026, pedido do Daniel: ajustes recomendados numa
// auditoria de UX — item "lembrar-me") — hoje a sessão só desloga por
// INATIVIDADE (ver MonitorInatividade.tsx), não existe expiração fixa de
// sessão. Em vez de mexer em autenticação/refresh token (mais risco, mais
// superfície pra sessão ficar aberta demais num dispositivo compartilhado),
// a opção "Manter-me conectado por mais tempo" do login só estende o
// TIMEOUT DE INATIVIDADE dessa sessão específica para o máximo permitido
// (`LOGOUT_INATIVIDADE_MINUTOS_MAX`, 8h) — em vez do padrão configurado
// globalmente pelo admin (hoje 2h). Device-only, mesmo padrão dos outros
// usos de localStorage no app (idioma da landing, dispensa de lembretes) —
// nenhuma coluna de banco pra essa preferência.
//
// Setado ANTES de chamar a Server Action de login (entrarComSenha/
// entrarComGoogle): as duas terminam com `redirect()` no servidor, que
// nunca devolve controle pro código do client após o `await` — não dá pra
// depender de "só marcar depois que der certo".
const CHAVE_LEMBRAR_ME = "fni_lembrar_me";

export function marcarLembrarMe(ativo: boolean) {
  try {
    if (ativo) {
      window.localStorage.setItem(CHAVE_LEMBRAR_ME, "1");
    } else {
      window.localStorage.removeItem(CHAVE_LEMBRAR_ME);
    }
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — sem
    // "lembrar-me" nesse caso, mas o login em si não é afetado.
  }
}

export function lembrarMeAtivo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_LEMBRAR_ME) === "1";
  } catch {
    return false;
  }
}

// Chamado em todo logout (manual ou por inatividade) — a preferência vale
// só "por essa sessão", não deve sobreviver a um logout explícito (ex.:
// dispositivo compartilhado, próxima pessoa a entrar não herda o
// "lembrar-me" de quem saiu).
export function limparLembrarMe() {
  try {
    window.localStorage.removeItem(CHAVE_LEMBRAR_ME);
  } catch {
    // Nada a fazer — sem localStorage, não há o que limpar.
  }
}
