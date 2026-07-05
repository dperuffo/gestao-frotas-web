import { redirect } from "next/navigation";

// Fase 27.55 (revisão) — esta tela separada foi descontinuada: os
// abastecimentos gerados pelo robô de teste (negociação com postos) passaram
// a ser gravados direto em profrotas_abastecimentos e aparecem junto com os
// demais abastecimentos (API, importação, lançamento manual) na tela
// /abastecimentos já existente — não deveriam ficar numa tela à parte.
// Mantido como redirect (em vez de excluir o arquivo) para não deixar um
// link antigo quebrado, caso alguém tenha essa URL salva.
export default function AbastecimentosPostosPageDescontinuada() {
  redirect("/abastecimentos");
}
