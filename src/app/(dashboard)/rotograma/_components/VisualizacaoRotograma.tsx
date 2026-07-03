import {
  CATEGORIAS_RISCO,
  CATEGORIAS_PARADA,
  CORES_RISCO,
  CORES_PARADA,
  CONTATOS_EMERGENCIA,
  type RotogramaRisco,
  type RotogramaParada,
} from "../tipos";

function iconeRisco(categoria: RotogramaRisco["categoria"]): string {
  return CATEGORIAS_RISCO.find((c) => c.valor === categoria)?.icone ?? "⚠️";
}
function iconeParada(categoria: RotogramaParada["categoria"]): string {
  return CATEGORIAS_PARADA.find((c) => c.valor === categoria)?.icone ?? "📍";
}

// Bloco visual do Rotograma — pontos de risco, pontos de parada e contatos
// de emergência, cada um colorido por categoria. Reaproveitado tanto na
// página de detalhe quanto (em espírito, via RotogramaPdf) na exportação
// em PDF.
export function VisualizacaoRotograma({ riscos, paradas }: { riscos: RotogramaRisco[]; paradas: RotogramaParada[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">⚠️ Pontos de risco ({riscos.length})</h2>
        {riscos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum ponto de risco cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {riscos.map((r, i) => {
              const cor = CORES_RISCO[r.categoria] ?? CORES_RISCO.perigo;
              return (
                <li key={i} className={`rounded-lg border ${cor.border} ${cor.bg} px-3 py-2.5`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{iconeRisco(r.categoria)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.local}</p>
                      <p className={`text-xs ${cor.text}`}>{r.descricao}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">📍 Pontos de parada ({paradas.length})</h2>
        {paradas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma parada cadastrada.</p>
        ) : (
          <ul className="space-y-2">
            {paradas.map((p, i) => (
              <li key={i} className={`rounded-lg border ${CORES_PARADA.border} ${CORES_PARADA.bg} px-3 py-2.5`}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{iconeParada(p.categoria)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{p.local}</p>
                    <p className={`text-xs ${CORES_PARADA.text}`}>{p.descricao}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6 lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">☎️ Contatos de emergência</h2>
        <div className="flex flex-wrap gap-3">
          {CONTATOS_EMERGENCIA.map((c) => (
            <div key={c.nome} className="rounded-lg bg-slate-900 px-4 py-2 text-center text-white">
              <p className="text-[10px] uppercase tracking-wide text-slate-300">{c.nome}</p>
              <p className="text-lg font-bold tabular-nums">{c.numero}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
