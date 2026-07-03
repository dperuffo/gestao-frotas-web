import type { ScorePosto } from "@/lib/roteirizacaoScore";

const CORES: Record<ScorePosto["grade"], string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-sky-100 text-sky-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

export function ScoreBadge({ score }: { score: ScorePosto }) {
  return (
    <span
      title={`Preço: ${score.detalhePreco} · Serviços: ${score.detalheServicos} · Distância: ${score.detalheDistancia}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CORES[score.grade]}`}
    >
      {score.grade} {score.score.toFixed(0)}
    </span>
  );
}
