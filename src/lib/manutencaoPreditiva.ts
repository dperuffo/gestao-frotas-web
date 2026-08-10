// Espelho, no lado do app, da config usada pela função SQL
// manutencao_preditiva_base() (ver migration "manutencao_preditiva_base").
// Serve só pra exibição (ícone, ordem, cor) — os números (score, km, %)
// sempre vêm calculados do banco, nunca recalculados aqui.
export type ComponenteManutencao =
  | "oleo"
  | "pneus"
  | "filtros"
  | "lubrificacao"
  | "alinhamento"
  | "arrefecimento"
  | "ruidos"
  | "revisao";

export const ORDEM_COMPONENTES: ComponenteManutencao[] = [
  "oleo",
  "pneus",
  "filtros",
  "alinhamento",
  "arrefecimento",
  "lubrificacao",
  "revisao",
  "ruidos",
];

export const ICONE_COMPONENTE: Record<ComponenteManutencao, string> = {
  oleo: "🛢️",
  pneus: "🛞",
  filtros: "🔧",
  lubrificacao: "⚙️",
  alinhamento: "🎯",
  arrefecimento: "🌡️",
  ruidos: "🔊",
  revisao: "📋",
};

export type UrgenciaManutencao = "ok" | "alerta" | "critico";
export type StatusManutencao = "ok" | "alerta" | "critico";

export const LABEL_STATUS: Record<StatusManutencao, string> = {
  ok: "OK",
  alerta: "Alerta",
  critico: "Crítico",
};

export const COR_STATUS: Record<StatusManutencao, { texto: string; fundo: string; borda: string }> = {
  ok: { texto: "text-emerald-700", fundo: "bg-emerald-50", borda: "border-emerald-200" },
  alerta: { texto: "text-amber-700", fundo: "bg-amber-50", borda: "border-amber-200" },
  critico: { texto: "text-red-700", fundo: "bg-red-50", borda: "border-red-200" },
};

export function corBarraScore(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

// 16 itens de serviço usados hoje no formulário de manutenção do app
// Flutter de produção (flutter/lib/features/manutencao/screens/
// manutencao_screen.dart) — reaproveitados aqui pra manter o mesmo
// vocabulário entre os apps que escrevem em manutencoes_realizadas. A
// função SQL casa esses itens com os 8 componentes acima por palavra-chave
// (ex: qualquer item contendo "óleo" conta pro componente "oleo"), não por
// igualdade exata, já que dados antigos usam rótulos um pouco diferentes.
//
// Achado (10/08/2026, Daniel reportou pela tela de manutenção preditiva):
// "Lubrificação Geral" e "Monitoramento de Ruídos" (2 dos 8 componentes
// calculados por manutencao_preditiva_base, ver ORDEM_COMPONENTES acima)
// não tinham NENHUM item aqui que casasse com as palavras-chave 'lubrific'
// e 'ruido' da função SQL — ou seja, mesmo o usuário registrando manutenção
// via este formulário, esses dois cards nunca saíam do modo "estimado"
// (nunca dava pra "confirmar" que o serviço foi feito, ficavam sempre
// vencidos pelo módulo do hodômetro). Adicionados "Lubrificação geral" e
// "Verificação de ruídos e vibrações" — únicos dois itens novos, resto
// inalterado. Pendência: o app Flutter citado acima (fora deste repo) tem
// a mesma lista hardcoded e precisa dos mesmos dois itens novos pra manter
// o vocabulário igual entre os dois apps — não localizamos esse arquivo
// nas pastas conectadas nesta sessão.
export const ITENS_MANUTENCAO = [
  "Troca de óleo e filtro",
  "Revisão de freios",
  "Alinhamento e balanceamento",
  "Troca de pneus",
  "Revisão elétrica",
  "Troca de filtro de ar",
  "Troca de filtro de combustível",
  "Revisão de suspensão",
  "Troca de correia dentada",
  "Revisão do sistema de arrefecimento",
  "Troca de velas",
  "Revisão geral",
  "Troca de pastilhas de freio",
  "Troca de fluido de freio",
  "Revisão de transmissão",
  "Troca de amortecedores",
  "Lubrificação geral",
  "Verificação de ruídos e vibrações",
] as const;

export type ComponenteResultado = {
  componente: string;
  componente_label: string;
  componente_icone: string;
  score: number;
  urgencia: UrgenciaManutencao;
  km_since: number;
  km_next: number;
  pct: number;
  fonte: "real" | "estimado";
};

// Recomendações em texto, geradas a partir do resultado por componente —
// porte direto da lógica de `_mp_analisar_veiculo()` da ferramenta em
// Streamlit (estudo_de_rede.py).
export function gerarRecomendacoes(
  componentes: ComponenteResultado[],
  degradacao: number,
  idadeAnos: number
): string[] {
  const recs: string[] = [];
  const criticos = componentes.filter((c) => c.urgencia === "critico");
  const alertas = componentes.filter((c) => c.urgencia === "alerta");

  if (criticos.length > 0) {
    const nomes = criticos.map((c) => c.componente_label).join(", ");
    recs.push(`🔴 Ação imediata: ${nomes} — vencido(s) pelo hodômetro.`);
  }
  if (degradacao > 0.15) {
    recs.push(`🛢️ Consumo degradado ${Math.round(degradacao * 100)}%. Verificar filtros e injeção.`);
  } else if (degradacao > 0.07) {
    recs.push(`⚠️ Leve queda de rendimento (${Math.round(degradacao * 100)}%). Monitorar tendência.`);
  }
  if (idadeAnos >= 10) {
    recs.push(`📅 Veículo com ${idadeAnos} anos. Reduzir intervalos de manutenção em 20-30%.`);
  }
  if (alertas.length > 0 && criticos.length === 0) {
    const proximos = alertas
      .slice(0, 2)
      .map((c) => `${c.componente_icone} ${c.componente_label} (~${c.km_next.toLocaleString("pt-BR")} km)`)
      .join(", ");
    recs.push(`🟡 Próximos: ${proximos}`);
  }
  if (criticos.length === 0 && alertas.length === 0) {
    recs.push("✅ Veículo em bom estado. Manter cronograma preventivo.");
  }
  return recs;
}
