// M4 (backlog de segurança, README.md) — 3 rotas (/api/usuarios/convidar,
// /api/assistente, /api/ocr/documento) existem especificamente pra servir os
// PWAs Flutter via Bearer token (o app Next.js em si usa Server Actions com
// sessão de cookie, não passa por elas) e respondiam
// "Access-Control-Allow-Origin: *" — qualquer site poderia chamar essas
// rotas a partir do navegador de um usuário logado (o Bearer token já
// protege contra chamada sem sessão válida, mas o wildcard ainda deixa
// qualquer página de terceiro tentar, o que não devia ser necessário).
//
// Levantamento feito revisando os apps Flutter que de fato chamam essas
// rotas (não é uma lista adivinhada): PWA Cliente/Posto
// (estudo-de-rede/flutter, chama /api/assistente e /api/usuarios/convidar) é
// servido em https://mobile.fxgestaodefrotasonline.com; PWA Motorista
// (estrada-que-cuida, chama /api/ocr/documento) é servido em
// https://estrada.fxgestaodefrotasonline.com (ambos confirmados em
// src/components/pwa/InstalarPwaModal.tsx, a fonte de verdade mostrada ao
// próprio usuário no modal "instalar app"). Em dev, os dois rodam via
// `flutter run -d web-server` numa porta local variável — por isso
// liberamos qualquer `http://localhost:<porta>` fora de produção.
//
// Nota: CORS só é enforçado pelo NAVEGADOR — um app nativo (Android/iOS) ou
// um cURL não olham esse header, então restringir aqui não afeta em nada
// quem chama fora de um browser (o Bearer token continua sendo a proteção
// real contra chamada não autenticada).
const ORIGENS_PRODUCAO = [
  "https://mobile.fxgestaodefrotasonline.com",
  "https://estrada.fxgestaodefrotasonline.com",
];

function origemPermitida(origem: string | null): origem is string {
  if (!origem) return false;
  if (ORIGENS_PRODUCAO.includes(origem)) return true;
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origem)) return true;
  return false;
}

// Monta os headers de CORS pra uma resposta desta requisição específica —
// não dá pra usar uma constante fixa porque o valor de
// Access-Control-Allow-Origin precisa ecoar a origem exata de quem chamou
// (nunca "*"), só quando essa origem está na lista permitida.
export function resolverCorsHeaders(request: Request, metodos = "POST, OPTIONS"): Record<string, string> {
  const origem = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": metodos,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    // Sinaliza a caches/CDN intermediários que a resposta varia conforme o
    // header Origin — evita servir pra uma origem uma resposta CORS
    // calculada pra outra.
    Vary: "Origin",
  };
  if (origemPermitida(origem)) {
    headers["Access-Control-Allow-Origin"] = origem;
  }
  return headers;
}
