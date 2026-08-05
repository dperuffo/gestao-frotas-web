"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { formatarMoeda } from "@/lib/financeiro";

// Fase Velocímetro (05/08/2026, pedido do Daniel: "Utilizar grafico de
// velocimetro nos indicadores de frota") — substitui os cards de número
// simples (componente `Indicador` em page.tsx) por um gauge tipo
// velocímetro nos indicadores que representam uma métrica de desempenho
// (têm min/max e uma direção de "bom"/"ruim"). Fica de fora (continuam como
// card de número simples): contadores/rótulos informativos sem essa
// semântica, como "Veículos no filtro" ou a placa do veículo selecionado.
//
// Técnica: recharts não tem um componente de "gauge" pronto — o padrão
// usado pela comunidade (e aqui) é um `RadialBarChart` com um único arco de
// 180° (`startAngle={180}` a `endAngle={0}`), a prop `background` do
// `RadialBar` desenha a trilha cinza cheia atrás, e o próprio `RadialBar`
// desenha só a fatia colorida proporcional ao valor por cima — como
// `ScoreFrota.tsx` (postos) já usa `PieChart`/`Pie` pra um "medidor" de
// score, mas aquilo é um donut de distribuição, não um gauge de valor
// único; aqui é o primeiro gauge de verdade do app.
//
// `min`/`max`/as 2 zonas de cor (`zonaAmarela`/`zonaVerde`, em unidade
// "crua", não normalizada) foram calibradas por indicador a partir dos
// thresholds de "aviso" que já existiam nos cards de número (ex.:
// disponibilidade < 90% já virava âmbar) — não são um número aleatório.
// Indicadores sem threshold prévio (CPK, consumo, OCT, TMRNC, km vazio,
// reentregas) ganharam faixas de referência de mercado/bom-senso
// operacional, ajustáveis depois se o Daniel achar que a faixa não bate com
// a realidade da frota dele.
//
// Bugfix pós-deploy (05/08/2026) — a v1 recebia um `formatar: (v) => string`
// via prop: essa função foi definida no Server Component (page.tsx) e
// derrubou toda a tela ("Functions cannot be passed directly to Client
// Components..." — mesma classe de bug da Fase Acesso-Rápido-Favoritos, ver
// comentário em BarraAtalhosFavoritos.tsx). Trocado por `unidade`, um enum
// (string, serializável) — a formatação agora acontece AQUI DENTRO do
// próprio client component, nunca cruzando a fronteira.
export type UnidadeGauge = "percentual" | "moeda_por_km" | "km_por_litro" | "horas" | "numero";

export type GaugeIndicadorProps = {
  label: string;
  valor: number | null;
  min: number;
  max: number;
  /** true = valor MENOR é melhor (CPK, corretiva%, sinistralidade%, TMRNC, OCT, km vazio%, avarias%, reclamações%, reentregas). false/omitido = valor MAIOR é melhor. */
  invertido?: boolean;
  /** Fronteira entre vermelho e âmbar, em unidade crua (mesma escala de `min`/`max`). */
  zonaVermelha: number;
  /** Fronteira entre âmbar e verde, em unidade crua. */
  zonaVerde: number;
  /** Como formatar o valor cru (central e legendas min/max). Default: número puro. */
  unidade?: UnidadeGauge;
  semValorTexto?: string;
  ajudaChave?: string;
};

const COR_VERMELHA = "#dc2626"; // red-600
const COR_AMBAR = "#d97706"; // amber-600
const COR_VERDE = "#16a34a"; // green-600
const COR_TRILHA = "#e2e8f0"; // slate-200

function formatarValor(valor: number, unidade: UnidadeGauge | undefined): string {
  switch (unidade) {
    case "percentual":
      return `${valor}%`;
    case "moeda_por_km":
      return `${formatarMoeda(valor)}/km`;
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

function corDoValor(valor: number, zonaVermelha: number, zonaVerde: number, invertido: boolean): string {
  // Sem `invertido`: valor sobe = melhora (verde fica pro lado de cima).
  // Com `invertido`: valor sobe = piora (verde fica pro lado de baixo).
  if (invertido) {
    if (valor <= zonaVerde) return COR_VERDE;
    if (valor <= zonaVermelha) return COR_AMBAR;
    return COR_VERMELHA;
  }
  if (valor >= zonaVerde) return COR_VERDE;
  if (valor >= zonaVermelha) return COR_AMBAR;
  return COR_VERMELHA;
}

export function GaugeIndicador({
  label,
  valor,
  min,
  max,
  invertido = false,
  zonaVermelha,
  zonaVerde,
  unidade,
  semValorTexto = "—",
  ajudaChave,
}: GaugeIndicadorProps) {
  const temValor = valor !== null && !Number.isNaN(valor);
  const valorClampado = temValor ? Math.min(max, Math.max(min, valor)) : min;
  const percentual = ((valorClampado - min) / (max - min)) * 100;
  const cor = temValor ? corDoValor(valor, zonaVermelha, zonaVerde, invertido) : COR_TRILHA;
  const textoValor = temValor ? formatarValor(valor, unidade) : semValorTexto;

  return (
    <div className="card flex flex-col items-center p-4">
      <p className="flex items-center gap-1 self-start text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>

      {/* Técnica: desenha um RadialBarChart de CÍRCULO INTEIRO (cx/cy 50%,
          matemática de raio previsível, sem percentuais >100% nem cy
          espremido no canto — mais confiável entre versões do recharts) num
          box quadrado, e recorta a metade de baixo com `overflow-hidden` no
          wrapper visível (metade da altura do box interno) — só a metade de
          cima (o semicírculo do velocímetro) fica visível. */}
      <div className="relative mx-auto mt-1 h-[110px] w-full max-w-[220px] overflow-hidden">
        <div className="absolute inset-x-0 top-0" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="100%"
              barSize={14}
              startAngle={180}
              endAngle={0}
              data={[{ valor: percentual }]}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
              <RadialBar dataKey="valor" cornerRadius={7} fill={cor} background={{ fill: COR_TRILHA }} isAnimationActive={false} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className="text-xl font-bold text-slate-900">{textoValor}</p>
        </div>
      </div>

      <div className="mt-1 flex w-full max-w-[220px] justify-between text-[10px] text-slate-400">
        <span>{formatarValor(min, unidade)}</span>
        <span>{formatarValor(max, unidade)}</span>
      </div>
    </div>
  );
}
