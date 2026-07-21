import {
  resolverLinhaDoTempo,
  CORES_RISCO,
  CORES_PARADA,
  categoriaRiscoLabel,
  categoriaParadaLabel,
  type RotogramaRisco,
  type RotogramaParada,
} from "../tipos";

const CORES_RISCO_HEX: Record<string, string> = {
  perigo: "#ef4444",
  crime: "#be123c",
  radar: "#f59e0b",
};
const COR_PARADA_HEX = "#06b6d4";

// Linha do tempo horizontal da viagem: origem à esquerda, destino à
// direita, riscos acima da linha e paradas abaixo, posicionados pelo Km
// (explícito, extraído do texto, ou distribuído — ver resolverLinhaDoTempo
// em tipos.ts). Layout puramente geométrico calculado aqui e desenhado em
// SVG; o mesmo cálculo é reaproveitado no PDF (RotogramaPdf.tsx) para o
// gráfico ficar idêntico na tela e no arquivo exportado.
export function LinhaDoTempoRotograma({
  origem,
  destino,
  riscos,
  paradas,
}: {
  origem: string;
  destino: string;
  riscos: RotogramaRisco[];
  paradas: RotogramaParada[];
}) {
  const pontos = resolverLinhaDoTempo(riscos, paradas);

  if (pontos.length === 0) {
    return null;
  }

  const kmMaximo = Math.max(...pontos.map((p) => p.km), 1);
  const largura = 1000;
  const altura = 260;
  const yLinha = altura / 2;
  const margem = 60;

  function x(km: number) {
    const fracao = Math.min(1, Math.max(0, km / kmMaximo));
    return margem + fracao * (largura - margem * 2);
  }

  // Distribui os stems em alturas alternadas dentro de cada grupo (riscos
  // acima, paradas abaixo) pra reduzir sobreposição de rótulos quando há
  // vários pontos próximos.
  const riscosOrdenados = pontos.filter((p) => p.tipo === "risco");
  const paradasOrdenadas = pontos.filter((p) => p.tipo === "parada");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" style={{ minWidth: 600 }}>
        {/* linha base */}
        <line x1={margem} y1={yLinha} x2={largura - margem} y2={yLinha} stroke="#cbd5e1" strokeWidth={3} />

        {/* origem */}
        <circle cx={margem} cy={yLinha} r={7} fill="#16a34a" />
        <text x={margem} y={yLinha + 34} textAnchor="middle" fontSize={13} fontWeight={600} fill="#166534">
          Origem
        </text>
        <text x={margem} y={yLinha + 50} textAnchor="middle" fontSize={10} fill="#64748b">
          {truncar(origem, 20)}
        </text>

        {/* destino */}
        <circle cx={largura - margem} cy={yLinha} r={7} fill="#dc2626" />
        <text x={largura - margem} y={yLinha + 34} textAnchor="middle" fontSize={13} fontWeight={600} fill="#991b1b">
          Destino
        </text>
        <text x={largura - margem} y={yLinha + 50} textAnchor="middle" fontSize={10} fill="#64748b">
          {truncar(destino, 20)}
        </text>

        {/* riscos — acima da linha */}
        {riscosOrdenados.map((p, i) => {
          const cx = x(p.km);
          const stemAltura = 46 + (i % 2) * 26;
          const cor = CORES_RISCO_HEX[p.categoria] ?? CORES_RISCO_HEX.perigo;
          return (
            <g key={`risco-${i}`}>
              <line
                x1={cx}
                y1={yLinha}
                x2={cx}
                y2={yLinha - stemAltura}
                stroke={cor}
                strokeWidth={1.5}
                strokeDasharray={p.kmEstimado ? "3,3" : undefined}
              />
              <circle cx={cx} cy={yLinha - stemAltura} r={6} fill={cor} />
              <text x={cx} y={yLinha - stemAltura - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
                {truncar(p.local, 18)}
              </text>
              <text x={cx} y={yLinha - stemAltura - 22} textAnchor="middle" fontSize={9} fill="#64748b">
                {Math.round(p.km)} km
              </text>
            </g>
          );
        })}

        {/* paradas — abaixo da linha */}
        {paradasOrdenadas.map((p, i) => {
          const cx = x(p.km);
          const stemAltura = 46 + (i % 2) * 26;
          return (
            <g key={`parada-${i}`}>
              <line
                x1={cx}
                y1={yLinha}
                x2={cx}
                y2={yLinha + stemAltura}
                stroke={COR_PARADA_HEX}
                strokeWidth={1.5}
                strokeDasharray={p.kmEstimado ? "3,3" : undefined}
              />
              <circle cx={cx} cy={yLinha + stemAltura} r={6} fill={COR_PARADA_HEX} />
              <text x={cx} y={yLinha + stemAltura + 20} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
                {truncar(p.local, 18)}
              </text>
              <text x={cx} y={yLinha + stemAltura + 32} textAnchor="middle" fontSize={9} fill="#64748b">
                {Math.round(p.km)} km
              </text>
            </g>
          );
        })}
      </svg>

      {pontos.some((p) => p.kmEstimado) && (
        <p className="mt-2 text-xs text-slate-400">
          Pontos com linha tracejada tiveram o Km estimado (não informado nem encontrado no texto do
          local) — edite o Rotograma e preencha o campo Km de cada ponto para uma posição exata.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(CORES_RISCO).map(([categoria, cor]) => (
          <span key={categoria} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${cor.dot}`} />
            {categoriaRiscoLabel(categoria as RotogramaRisco["categoria"])}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${CORES_PARADA.dot}`} />
          {categoriaParadaLabel("abastecimento")} / {categoriaParadaLabel("alimentacao")} /{" "}
          {categoriaParadaLabel("pernoite")} / {categoriaParadaLabel("pedagio")}
        </span>
      </div>
    </div>
  );
}

function truncar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
