/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

// M1 (backlog de segurança, README.md) — headers HTTP de segurança ausentes.
// A CSP abaixo foi montada listando de verdade todo domínio externo que o
// app carrega no navegador (mapas Leaflet/OSM, Google Identity Services,
// Hotjar, Google Fonts, Supabase) — ver README.md para o levantamento
// completo por diretiva. Não é uma CSP "strict-dynamic" com nonce por
// requisição (exigiria gerar um nonce por request em middleware e propagar
// pra cada <script>/<style> da árvore, incluindo o snippet do Hotjar via
// dangerouslySetInnerHTML) — optamos por 'unsafe-inline' em script-src/
// style-src como meio-termo de esforço baixo, documentado como limitação
// conhecida no README. Mesmo assim a CSP já fecha a superfície de ataque
// principal: bloqueia carregar recurso de qualquer domínio não listado
// (exfiltração de dados via XSS, scripts injetados de terceiros
// desconhecidos) e reforça contra clickjacking (frame-ancestors).
const cspDiretivas = [
  "default-src 'self'",
  // Google Identity Services (botão "Entrar com Google") e Hotjar (heatmap/
  // session replay, só ativo em produção) são os únicos scripts de terceiro.
  //
  // Fase Export-PDF-CSP (18/08/2026, achado real do Daniel: "exportar para
  // PDF nao funcionou" — console mostrava
  // "WebAssembly.instantiate(): ... violates ... 'unsafe-eval' is not an
  // allowed source") — @react-pdf/renderer usa o motor de layout Yoga
  // (flexbox) compilado pra WebAssembly, e todo navegador exige permissão
  // explícita pra COMPILAR wasm via CSP. 'wasm-unsafe-eval' cobre só isso —
  // ao contrário de 'unsafe-eval', não libera eval()/Function() arbitrários
  // de JS, só a instanciação de módulos WebAssembly. Afeta qualquer tela que
  // use BotaoExportarTabela (Cadastros, agora também Tracking de Jornada).
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com https://static.hotjar.com https://*.hotjar.com",
  // Google Fonts (link direto, sem next/font) nas páginas de landing/legal.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Tiles do Leaflet (OpenStreetMap), ícone padrão do marcador (CDN unpkg,
  // usado só no mapa de Roteirização) e Storage do Supabase (fotos/anexos).
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://nedthbeekvwzcjrhsghp.supabase.co",
  "font-src 'self' https://fonts.gstatic.com",
  // API/Auth/Storage e Realtime (WebSocket, chat de fretes) do Supabase;
  // Nominatim (busca de endereço no formulário client-side de fretes);
  // Google (troca de token do login); Hotjar (telemetria); Sentry (Fase
  // Comercial, 31/08/2026 — envio de erros do navegador pro monitoramento;
  // domínio com wildcard porque o subdomínio de ingest é específico da
  // organização Sentry e varia por região US/EU).
  "connect-src 'self' https://nedthbeekvwzcjrhsghp.supabase.co wss://nedthbeekvwzcjrhsghp.supabase.co https://nominatim.openstreetmap.org https://accounts.google.com https://*.hotjar.com https://*.hotjar.io wss://*.hotjar.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  // O próprio Google Identity Services abre um iframe pra renderizar o botão/
  // One Tap. Stripe é redirect de página inteira (não embed) — não entra aqui.
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Substitui/reforça X-Frame-Options: nenhum site pode embutir o app num iframe.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDiretivas },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocalização é usada de propósito (botão "Usar minha localização" em
  // Meu Posto) — liberada só pra própria origem. Câmera/microfone/pagamento/
  // USB não são usados em nenhuma tela: negados.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig = {
  // O Leaflet (mapa da Roteirização) não é compatível com o StrictMode do
  // React: em desenvolvimento, o StrictMode monta/desmonta/remonta os
  // componentes de propósito (para pegar efeitos colaterais mal escritos) e
  // o Leaflet tenta inicializar o mesmo <div> do mapa duas vezes, gerando
  // "Map container is already initialized". Isso só afeta o modo dev — em
  // produção o StrictMode não faz nada mesmo com true, então desligar aqui
  // não muda o comportamento do app publicado.
  reactStrictMode: false,
  experimental: {
    serverActions: {
      // As planilhas recorrentes (postos ANP, preços) chegam na casa de
      // alguns MB — o limite padrão de 1mb do Next é insuficiente.
      bodySizeLimit: "25mb",
    },
  },
  // M1 — remove o header "X-Powered-By: Next.js" (não ajuda um invasor
  // diretamente, mas facilita "fingerprinting" da stack pra procurar CVEs
  // conhecidas de uma versão específica do framework).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Fase Comercial (31/08/2026) — wrap do Sentry: faz upload de source maps
// pro Sentry no build (stack traces legíveis em produção, não código
// minificado) e injeta o tunnel de instrumentação. Sem SENTRY_AUTH_TOKEN
// configurado (só necessário pra upload de source maps, não pra captura de
// erro em si), o wrap roda em modo silencioso — não quebra o build.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  // Some sozinho quando não há projeto/org configurados — evita falha de
  // build em ambientes (ex.: PR de preview) sem essas envs.
  widenClientFileUpload: false,
  // Sem SENTRY_AUTH_TOKEN não tem como fazer upload de source map mesmo —
  // desliga a geração/instrumentação de source map inteira nesse caso pra
  // não pagar o custo de memória/tempo de build à toa (achado real: builds
  // desta aplicação, que já é grande, ficaram sem memória num ambiente de
  // build mais restrito depois de adicionar o Sentry com sourcemaps
  // habilitados por padrão).
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
