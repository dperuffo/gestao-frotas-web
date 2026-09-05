// Fase Reformulacao-Indicadores-Frota (05/09/2026) — HOTFIX: statusDoValor/
// formatarValor viviam em GaugeIndicador.tsx, que tem "use client" no topo
// (por causa do RadialBarChart). page.tsx (Server Component) passou a
// chamar essas funções diretamente pro bloco "Pontos de atenção" e pro
// ranking de veículos mais críticos — isso quebrou em produção com "Error:
// Attempted to call statusDoValor() from the server but statusDoValor is
// on the client", porque uma função exportada de um módulo "use client" só
// pode ser passada como prop pra um Client Component, nunca invocada
// diretamente no server.
//
// Solução: extrair a lógica pura (sem nenhum import de recharts/React) pra
// este arquivo, sem "use client" — pode ser importado tanto por
// page.tsx (server) quanto por GaugeIndicador.tsx/CardIndicadorSimples.tsx
// (client), já que módulos sem "use client" rodam nos dois ambientes.
export type UnidadeGauge = "percentual" | "moeda_por_km" | "km_por_litro" | "horas" | "numero";

function formatarMoedaSimples(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarValor(valor: number, unidade: UnidadeGauge | undefined): string {
  switch (unidade) {
    case "percentual":
      return `${valor}%`;
    case "moeda_por_km":
      return `${formatarMoedaSimples(valor)}/km`;
    case "km_por_litro":
      return `${valor} km/l`;
    case "horas":
      return `${valor}h`;
    case "numero":
      return `${Math.round(valor)}`;
    default:
      return `${valor}`;
  }
}

const COR_VERMELHA = "#dc2626";
const COR_AMBAR = "#d97706";
const COR_VERDE = "#16a34a";

export function corDoValor(valor: number, zonaVermelha: number, zonaVerde: number, invertido: boolean): string {
  if (invertido) {
    if (valor <= zonaVerde) return COR_VERDE;
    if (valor <= zonaVermelha) return COR_AMBAR;
    return COR_VERMELHA;
  }
  if (valor >= zonaVerde) return COR_VERDE;
  if (valor >= zonaVermelha) return COR_AMBAR;
  return COR_VERMELHA;
}

export function statusDoValor(
  valor: number,
  zonaVermelha: number,
  zonaVerde: number,
  invertido: boolean
): { texto: string; corFundo: string; corTexto: string } {
  const cor = corDoValor(valor, zonaVermelha, zonaVerde, invertido);
  if (cor === COR_VERDE) return { texto: "Bom", corFundo: "#dcfce7", corTexto: "#15803d" };
  if (cor === COR_AMBAR) return { texto: "Atenção", corFundo: "#fef3c7", corTexto: "#b45309" };
  return { texto: "Crítico", corFundo: "#fee2e2", corTexto: "#b91c1c" };
}
