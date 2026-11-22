import type { FormatoValor } from "@/lib/assistenteIA";

// Formatação de valores dos gráficos/tabelas do Assistente FNI (tela e PDF usam a mesma).
export function formatarValor(v: number, formato: FormatoValor): string {
  switch (formato) {
    case "moeda":
      return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "litros":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
    case "km":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`;
    case "percentual":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    default:
      return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
}
