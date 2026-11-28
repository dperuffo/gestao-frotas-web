// Drill down do painel "Preço pago vs. referência ANP": agrega, no servidor, os abastecimentos
// individuais (RPC cliente_preco_anp_detalhe) por posto, município, semana e por caso.
// Convenção: impacto > 0 = pagou ACIMA da ANP (custo a mais); impacto < 0 = abaixo (economia).

export type RegistroAnp = {
  id: string;
  d: string; // data (yyyy-mm-dd)
  pl: string | null; // placa
  mo: string | null; // motorista
  pc: string | null; // cnpj do posto
  pn: string | null; // nome do posto
  mu: string | null;
  uf: string | null;
  pr: string | null; // produto
  ct: string; // categoria ANP
  l: number; // litros
  v: number; // valor pago
  rf: number; // preço de referência (R$/L)
  nv: "municipio" | "estado" | "brasil";
};

export type LinhaAgregada = {
  chave: string;
  rotulo: string;
  sub?: string;
  litros: number;
  pago: number;
  ref: number;
  impacto: number; // pago - ref (R$)
  precoPago: number; // R$/L
  precoRef: number; // R$/L
  pct: number; // impacto / ref
  qtd: number;
  refMunicipio: number; // qtd com ref. municipal (qualidade da comparação)
};

export type SugestaoPosto = {
  postoAtual: string;
  municipio: string;
  litros: number;
  precoAtual: number;
  melhorPosto: string;
  melhorPreco: number;
  economia: number; // R$ se o volume fosse no melhor posto da cidade
};

type Acum = { litros: number; pago: number; ref: number; qtd: number; refMun: number; rotulo: string; sub?: string };

function agrupar(regs: RegistroAnp[], chaveDe: (r: RegistroAnp) => { chave: string; rotulo: string; sub?: string }): LinhaAgregada[] {
  const mapa = new Map<string, Acum>();
  for (const r of regs) {
    const { chave, rotulo, sub } = chaveDe(r);
    const a = mapa.get(chave) ?? { litros: 0, pago: 0, ref: 0, qtd: 0, refMun: 0, rotulo, sub };
    a.litros += r.l;
    a.pago += r.v;
    a.ref += r.l * r.rf;
    a.qtd += 1;
    if (r.nv === "municipio") a.refMun += 1;
    mapa.set(chave, a);
  }
  return Array.from(mapa.entries()).map(([chave, a]) => ({
    chave,
    rotulo: a.rotulo,
    sub: a.sub,
    litros: a.litros,
    pago: a.pago,
    ref: a.ref,
    impacto: a.pago - a.ref,
    precoPago: a.litros > 0 ? a.pago / a.litros : 0,
    precoRef: a.litros > 0 ? a.ref / a.litros : 0,
    pct: a.ref > 0 ? ((a.pago - a.ref) / a.ref) * 100 : 0,
    qtd: a.qtd,
    refMunicipio: a.refMun,
  }));
}

export const porImpacto = (a: LinhaAgregada, b: LinhaAgregada) => b.impacto - a.impacto;

export function resumir(regs: RegistroAnp[]) {
  const pago = regs.reduce((s, r) => s + r.v, 0);
  const ref = regs.reduce((s, r) => s + r.l * r.rf, 0);
  const litros = regs.reduce((s, r) => s + r.l, 0);
  return { pago, ref, litros, impacto: pago - ref, pct: ref > 0 ? ((pago - ref) / ref) * 100 : 0, qtd: regs.length };
}

export function agruparPorPosto(regs: RegistroAnp[]): LinhaAgregada[] {
  return agrupar(regs, (r) => ({
    chave: r.pc ?? "sem-posto",
    rotulo: r.pn?.trim() || "Posto não informado",
    sub: [r.mu, r.uf].filter(Boolean).join(" / ") || undefined,
  })).sort(porImpacto);
}

export function agruparPorMunicipio(regs: RegistroAnp[]): LinhaAgregada[] {
  return agrupar(regs, (r) => ({
    chave: `${r.mu ?? ""}|${r.uf ?? ""}`,
    rotulo: r.mu?.trim() || "Município não informado",
    sub: r.uf ?? undefined,
  })).sort(porImpacto);
}

// Semana começando na segunda-feira (data ISO, sem fuso: só aritmética de calendário).
export function inicioSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // segunda = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function agruparPorSemana(regs: RegistroAnp[]): LinhaAgregada[] {
  return agrupar(regs, (r) => {
    const s = inicioSemana(r.d);
    return { chave: s, rotulo: s };
  }).sort((a, b) => a.chave.localeCompare(b.chave));
}

// Casos individuais com maior custo a mais (R$) — só os que passaram da referência.
export function maioresDesvios(regs: RegistroAnp[], limite = 20) {
  return regs
    .map((r) => ({ ...r, impacto: r.v - r.l * r.rf, precoPago: r.l > 0 ? r.v / r.l : 0 }))
    .filter((r) => r.impacto > 0)
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, limite);
}

// Para cada posto acima da referência, procura na MESMA cidade (e mesmo combustível) o posto que
// a frota já usa com menor preço médio, e estima a economia de redirecionar aquele volume.
// Só sugere postos que a própria frota já abasteceu (preço real, não estimado) e com amostra mínima.
export function sugerirPostosMelhores(regs: RegistroAnp[], minLitrosMelhor = 100): SugestaoPosto[] {
  const comPosto = regs.filter((r) => r.pc && r.mu);
  const porCidade = new Map<string, RegistroAnp[]>();
  for (const r of comPosto) {
    const k = `${r.mu}|${r.uf}`;
    porCidade.set(k, [...(porCidade.get(k) ?? []), r]);
  }
  const saida: SugestaoPosto[] = [];
  for (const [k, lista] of porCidade) {
    const postos = agruparPorPosto(lista).filter((p) => p.chave !== "sem-posto");
    const candidatos = postos.filter((p) => p.litros >= minLitrosMelhor).sort((a, b) => a.precoPago - b.precoPago);
    const melhor = candidatos[0];
    if (!melhor) continue;
    for (const p of postos) {
      if (p.chave === melhor.chave || p.precoPago <= melhor.precoPago) continue;
      const economia = (p.precoPago - melhor.precoPago) * p.litros;
      if (economia < 1) continue;
      saida.push({
        postoAtual: p.rotulo,
        municipio: k.split("|")[0],
        litros: p.litros,
        precoAtual: p.precoPago,
        melhorPosto: melhor.rotulo,
        melhorPreco: melhor.precoPago,
        economia,
      });
    }
  }
  return saida.sort((a, b) => b.economia - a.economia);
}
