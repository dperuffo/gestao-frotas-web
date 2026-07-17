// Categorias do catálogo de fidelidade "Estrada que Cuida" (app do
// motorista) — as 6 originais (curadas pelo admin FNI) + "Conveniência do
// Posto" (Fase Parcerias Locais, 17/07): itens físicos que o próprio posto
// oferece no local (vale-refeição, banho, estacionamento, lavagem/troca de
// óleo, lanches da conveniência etc.).
//
// Classes Tailwind ficam escritas por extenso (não construídas com
// template string tipo `bg-${cor}-100`) porque o compilador do Tailwind só
// inclui no bundle final as classes que aparecem literalmente no código.

export const CATEGORIAS_FIDELIDADE = [
  { valor: "conveniencia_posto", label: "Conveniência do Posto" },
  { valor: "economia_imediata", label: "Economia Imediata" },
  { valor: "marketplace_cabine", label: "Marketplace da Cabine" },
  { valor: "saude_estrada", label: "Saúde na Estrada" },
  { valor: "universidade_estrada", label: "Universidade da Estrada" },
  { valor: "clube_caminhao", label: "Clube do Caminhão" },
  { valor: "volte_para_casa", label: "Volte para Casa" },
] as const;

export type CategoriaFidelidade = (typeof CATEGORIAS_FIDELIDADE)[number]["valor"];

export const LABEL_CATEGORIA_FIDELIDADE: Record<string, string> = Object.fromEntries(
  CATEGORIAS_FIDELIDADE.map((c) => [c.valor, c.label])
);

export function eCategoriaFidelidadeValida(v: string): v is CategoriaFidelidade {
  return (CATEGORIAS_FIDELIDADE as readonly { valor: string }[]).some((c) => c.valor === v);
}

export const ESTILO_CATEGORIA_FIDELIDADE: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  conveniencia_posto: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", badge: "bg-amber-500" },
  economia_imediata: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", badge: "bg-emerald-500" },
  marketplace_cabine: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", badge: "bg-sky-500" },
  saude_estrada: { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700", badge: "bg-rose-500" },
  universidade_estrada: { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-700", badge: "bg-violet-500" },
  clube_caminhao: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", badge: "bg-indigo-500" },
  volte_para_casa: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700", badge: "bg-teal-500" },
};

export const ESTILO_CATEGORIA_PADRAO = ESTILO_CATEGORIA_FIDELIDADE.economia_imediata;
