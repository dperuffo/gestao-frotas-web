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

// 06/10/2026 (pedido do Daniel: tela de bicos do admin igual à do PDV) — paleta
// visual de cada combustível, espelho de TEMAS/temaDe em pdv-fni
// (src/lib/combustiveis.ts). Classes escritas por extenso: o Tailwind só gera o
// que encontra no código. Combustível sem mapeamento cai no cinza.
export const TEMAS_COMBUSTIVEL_PDV: Record<string, { icone: string; faixa: string; borda: string }> = {
  GC: { icone: "text-emerald-600 dark:text-emerald-400", faixa: "bg-emerald-500", borda: "border-emerald-400" },
  GA: { icone: "text-lime-600 dark:text-lime-400", faixa: "bg-lime-500", borda: "border-lime-400" },
  ET: { icone: "text-amber-600 dark:text-amber-400", faixa: "bg-amber-500", borda: "border-amber-400" },
  S10: { icone: "text-sky-600 dark:text-sky-400", faixa: "bg-sky-500", borda: "border-sky-400" },
  S500: { icone: "text-indigo-600 dark:text-indigo-400", faixa: "bg-indigo-500", borda: "border-indigo-400" },
};
const TEMA_COMBUSTIVEL_PADRAO = { icone: "text-slate-500 dark:text-slate-400", faixa: "bg-slate-400", borda: "border-slate-300" };
export const temaCombustivelPdv = (codigo: string | null) =>
  (codigo && TEMAS_COMBUSTIVEL_PDV[codigo]) || TEMA_COMBUSTIVEL_PADRAO;
