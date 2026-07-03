/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
