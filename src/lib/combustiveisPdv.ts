// Fase 4 PDV (02/10/2026) — lista fechada de combustíveis aceitos no
// catálogo de bicos do PDV (pdv_bicos_catalogo.codigo_combustivel). Mirror
// manual da mesma constante em pdv-fni (src/app/(pdv)/bicos/page.tsx) —
// mesmo raciocínio de formasPagamentoPdv.ts: sem pacote de design system
// compartilhado entre os dois apps, copiar é a alternativa aceita hoje.
// Mudar aqui SEM mudar lá (e sem mudar o check constraint no banco) deixa
// os dois catálogos de combustível fora de sincronia.
export const COMBUSTIVEIS_PDV = [
  { codigo: "GC", nome: "Gasolina Comum", precoBase: 6.09 },
  { codigo: "GA", nome: "Gasolina Aditivada", precoBase: 6.29 },
  { codigo: "ET", nome: "Etanol", precoBase: 4.49 },
  { codigo: "S10", nome: "Diesel S10", precoBase: 6.19 },
  { codigo: "S500", nome: "Diesel S500", precoBase: 6.05 },
] as const;
