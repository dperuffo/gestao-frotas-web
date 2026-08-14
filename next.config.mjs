/** @type {import('next').NextConfig} */

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
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://static.hotjar.com https://*.hotjar.com",
  // Google Fonts (link direto, sem next/font) nas páginas de landing/legal.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Tiles do Leaflet (OpenStreetMap), ícone padrão do marcador (CDN unpkg,
  // usado só no mapa de Roteirização) e Storage do Supabase (fotos/anexos).
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://nedthbeekvwzcjrhsghp.supabase.co",
  "font-src 'self' https://fonts.gstatic.com",
  // API/Auth/Storage e Realtime (WebSocket, chat de fretes) do Supabase;
  // Nominatim (busca de endereço no formulário client-side de fretes);
  // Google (troca de token do login); Hotjar (telemetria).
  "connect-src 'self' https://nedthbeekvwzcjrhsghp.supabase.co wss://nedthbeekvwzcjrhsghp.supabase.co https://nominatim.openstreetmap.org https://accounts.google.com https://*.hotjar.com https://*.hotjar.io wss://*.hotjar.com",
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

export default nextConfig;
