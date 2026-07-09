// Fase 27.95 — pedido do Daniel: "precisa ter um painel de indicadores, em
// todas as visões, com os percentuais de notas fiscais emitidas, pendentes
// de emissão, entre outros... pode ter uma barra de indicação com o
// percentual de recolha de NF realizado, vai ficando mais verde à medida
// que vai completando a recolha de NF em 100%". A cor interpola
// vermelho -> âmbar -> verde conforme o percentual sobe (não é um degrau
// fixo) pra dar a sensação de progresso contínuo. Dados vêm da RPC
// indicador_notas_fiscais() (agregado no banco, não no client — pedido do
// Daniel de cuidar da performance com muitos abastecimentos).
export function IndicadorNotasFiscais({
  total,
  comNota,
  semNota,
  rejeitadas,
  percentual,
}: {
  total: number;
  comNota: number;
  semNota: number;
  rejeitadas: number;
  percentual: number;
}) {
  const cor = corDoPercentual(percentual);
  // Fase 27.100 — semNota agora se divide em "rejeitadas" (teve tentativa,
  // foi recusada — ver Fase 27.99) e "pendentes" (nunca teve tentativa).
  const pendentes = semNota - rejeitadas;

  return (
    <div className="mb-6 card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Recolha de notas fiscais</h3>
          <p className="text-xs text-slate-500">
            Últimos 90 dias · {comNota} de {total} abastecimento{total === 1 ? "" : "s"} com NF-e vinculada
            {rejeitadas > 0 && <span className="text-red-600"> · {rejeitadas} rejeitada{rejeitadas === 1 ? "" : "s"}</span>}
            {pendentes > 0 && <span className="text-amber-600"> · {pendentes} pendente{pendentes === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <span className="text-2xl font-bold" style={{ color: cor }}>
          {percentual.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percentual))}%`, backgroundColor: cor }}
        />
      </div>
    </div>
  );
}

// Interpola de vermelho (#DC2626, 0%) passando por âmbar (#D97706, 50%) até
// verde (#16A34A, 100%) — cada faixa de 50 pontos percentuais mistura
// linearmente entre as duas cores vizinhas.
function corDoPercentual(percentual: number): string {
  const p = Math.min(100, Math.max(0, percentual));
  const vermelho = { r: 220, g: 38, b: 38 };
  const ambar = { r: 217, g: 119, b: 6 };
  const verde = { r: 22, g: 163, b: 74 };

  const [de, para, t] = p <= 50 ? [vermelho, ambar, p / 50] : [ambar, verde, (p - 50) / 50];

  const r = Math.round(de.r + (para.r - de.r) * t);
  const g = Math.round(de.g + (para.g - de.g) * t);
  const b = Math.round(de.b + (para.b - de.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
