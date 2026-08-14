// M2 (backlog de segurança, README.md) — "nenhuma rota tem limite de
// requisições por IP/usuário". Implementação em memória, por instância —
// suficiente pro modelo de deploy atual (Railway roda a aplicação como UM
// container/processo Node persistente, não múltiplas instâncias serverless
// efêmeras como a Vercel) sem precisar contratar/configurar Redis (Upstash)
// ou depender de regra específica de edge da Cloudflare. Se um dia o app
// escalar pra múltiplas réplicas, cada réplica passa a ter seu próprio
// contador — o limite efetivo vira "N × réplicas" em vez de N global; nesse
// cenário futuro, trocar `memoria` por um client Redis compartilhado
// resolve sem mudar a assinatura de `verificarLimite`.
type Registro = { contagem: number; expiraEm: number };
const memoria = new Map<string, Registro>();

// Evita crescer sem limite em memória ao longo do tempo (chaves de IP/usuário
// que já expiraram e nunca mais vão ser reconsultadas). Só varre quando o
// mapa começa a acumular, pra não pagar esse custo em toda chamada.
function limparExpirados(agora: number) {
  if (memoria.size < 5000) return;
  for (const [chave, registro] of memoria) {
    if (registro.expiraEm <= agora) memoria.delete(chave);
  }
}

export type ResultadoLimite = { permitido: true } | { permitido: false; tentarNovamenteEmSegundos: number };

// Limitador de janela fixa: até `maxRequisicoes` por `janelaMs` para a mesma
// `chave` (normalmente "rota:identificador", onde identificador é IP,
// e-mail do usuário autenticado, ou id de chave de API — quem chama escolhe
// conforme o que faz sentido pra cada rota).
export function verificarLimite(chave: string, maxRequisicoes: number, janelaMs: number): ResultadoLimite {
  const agora = Date.now();
  limparExpirados(agora);
  const registro = memoria.get(chave);
  if (!registro || registro.expiraEm <= agora) {
    memoria.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return { permitido: true };
  }
  if (registro.contagem >= maxRequisicoes) {
    return { permitido: false, tentarNovamenteEmSegundos: Math.max(1, Math.ceil((registro.expiraEm - agora) / 1000)) };
  }
  registro.contagem += 1;
  return { permitido: true };
}

// Next.js (runtime Node, fora do Edge) não expõe IP do cliente direto no
// Request — Railway/Cloudflare já populam x-forwarded-for na borda.
export function ipDaRequisicao(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

// Resposta 429 padrão, já com o header Retry-After — usada igual em toda
// rota que aplica limite, pra manter a mensagem/formato consistentes.
export function respostaLimiteExcedido(resultado: { tentarNovamenteEmSegundos: number }) {
  return new Response(
    JSON.stringify({ erro: "Muitas requisições em pouco tempo — tente novamente em instantes." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resultado.tentarNovamenteEmSegundos),
      },
    }
  );
}
