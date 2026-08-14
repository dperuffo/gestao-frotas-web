import { createHash, timingSafeEqual } from "crypto";

// M3 (backlog de segurança, README.md) — as rotas de cron/webhook comparavam
// o segredo recebido (header `Authorization: Bearer <segredo>` ou
// `x-webhook-secret`) com a env var esperada usando `!==` direto. Isso é uma
// comparação "curto-circuito" do motor JS (para no primeiro caractere
// diferente), o que em teoria permite um ataque de timing pra descobrir o
// segredo certo caractere por caractere, medindo quanto tempo cada tentativa
// leva pra falhar.
//
// `crypto.timingSafeEqual` compara em tempo constante, mas exige que os dois
// buffers tenham EXATAMENTE o mesmo tamanho (lança erro se não tiverem) — se
// comparássemos os textos crus direto, o próprio tamanho diferente já vazaria
// informação (segredo errado normalmente tem tamanho diferente do certo).
// Por isso aqui comparamos o HASH SHA-256 dos dois lados (sempre 32 bytes,
// tamanho fixo), não o texto original — elimina de vez a variação de tamanho
// e ainda garante tempo constante na comparação final.
export function segredoConfere(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido) return false;
  const hashRecebido = createHash("sha256").update(recebido).digest();
  const hashEsperado = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(hashRecebido, hashEsperado);
}
