import { corBarraScore } from "@/lib/manutencaoPreditiva";

export function ScoreBar({ score }: { score: number }) {
  const cor = corBarraScore(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: cor }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color: cor }}>
        {score}
      </span>
    </div>
  );
}
