// Fase Grupo 1 Rodopar item 2 (03/08/2026) — Estoque de Peças na Manutenção:
// rótulos/cores compartilhados entre lista, detalhe e formulários. Espelha o
// gap do benchmark Rodopar/Datapar ("Materiais integrado à Manutenção, sem
// requisição fantasma") com um ledger imutável (pecas_estoque_movimentos).
export const TIPO_MOVIMENTO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

export const TIPO_MOVIMENTO_COR: Record<string, string> = {
  entrada: "bg-green-100 text-green-800",
  saida: "bg-red-100 text-red-800",
};

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
