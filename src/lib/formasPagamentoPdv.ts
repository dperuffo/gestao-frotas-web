// Fase 4 PDV (02/10/2026) — lista/rótulos das formas de pagamento aceitas
// no canal de abastecimento via PDV (ver pdv_formas_pagamento_permitidas,
// Fase 1). Espelho de ROTULOS_FORMA_PAGAMENTO em
// pdv-fni/src/app/(pdv)/abastecimento/[id]/page.tsx — os dois repositórios
// são projetos Next.js separados (sem pacote compartilhado hoje, ver
// tailwind.config.ts do pdv-fni), então essa lista precisa ser mantida
// sincronizada manualmente nos dois lados se um novo meio de pagamento for
// adicionado.
export const FORMAS_PAGAMENTO_PDV = [
  "pix",
  "cartao_credito",
  "cartao_debito",
  "dinheiro",
  "profrotas",
  "valecard",
  "ticket_log",
  "rede_frota",
  "veloe",
  "outro",
] as const;

export type FormaPagamentoPdv = (typeof FORMAS_PAGAMENTO_PDV)[number];

export const ROTULOS_FORMA_PAGAMENTO_PDV: Record<FormaPagamentoPdv, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  profrotas: "PróFrotas",
  valecard: "ValeCard",
  ticket_log: "Ticket Log",
  rede_frota: "Rede Frota",
  veloe: "Veloe",
  outro: "Outro",
};
