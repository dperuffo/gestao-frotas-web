import { COR_STATUS, corBarraScore, type ComponenteResultado } from "@/lib/manutencaoPreditiva";

export function ComponenteCard({ c }: { c: ComponenteResultado }) {
  const cor = COR_STATUS[c.urgencia];
  return (
    <div className={`rounded-lg border p-3 ${cor.borda} ${cor.fundo}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
          <span>{c.componente_icone}</span>
          {c.componente_label}
        </span>
        <span className="text-sm font-bold" style={{ color: corBarraScore(c.score) }}>
          {c.score}
        </span>
      </div>
      <div className="mb-1.5 h-1.5 w-full rounded-full bg-white/70">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, background: corBarraScore(c.score) }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          {c.urgencia === "critico" ? "Vencido" : `~${c.km_next.toLocaleString("pt-BR")} km`}
        </span>
        <span className="text-[10px] text-slate-400">{c.fonte === "real" ? "✅ registro real" : "📐 estimado"}</span>
      </div>
    </div>
  );
}
