// Score composto do posto — mesma fórmula usada em Postos Revendedores
// (ScoreFrota) e reaproveitada em Relatórios (Score × Performance): preço
// vs ANP 50% + cobertura de serviços/infraestrutura 30% + distância neutra
// 20% (sem ponto de referência de rota nessas telas). Graus: A>=75, B>=55,
// C>=35, D<35. Extraído pra lib porque agora tem dois consumidores.
export type GrauPosto = "A" | "B" | "C" | "D";

export function calcularScorePosto(diffPctSigned: number, nServicos: number): { score: number; grade: GrauPosto } {
  const diff = diffPctSigned / 100;
  const sPreco = Math.max(0, Math.min(100, 50 - diff * 500));
  const sServ = Math.max(0, Math.min(100, (nServicos / 11) * 100));
  const sDist = 50;
  const score = Math.round((0.5 * sPreco + 0.3 * sServ + 0.2 * sDist) * 10) / 10;
  const grade: GrauPosto = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
  return { score, grade };
}

export const CORES_GRADE: Record<GrauPosto, string> = { A: "#27AE60", B: "#3498DB", C: "#F39C12", D: "#E74C3C" };
