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
// Técnica: recharts não tem um componente de "gauge" pronto — usamos um
// `RadialBarChart` com um único arco completo, a prop `background` do
// `RadialBar` desenha a trilha cinza cheia atrás, e o próprio `RadialBar`
// desenha só a fatia colorida proporcional ao valor por cima — como
// `ScoreFrota.tsx` (postos) já usa `PieChart`/`Pie` pra um "medidor" de
// score, mas aquilo é um donut de distribuição, não um gauge de valor
// único; aqui é o primeiro gauge de verdade do app.
//
// `min`/`max`/as 2 zonas de cor (`zonaVermelha`/`zonaVerde`, em unidade
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
//
// Redesenho (05/08/2026, mesmo dia — pedido do Daniel: "Nao gostei muito
// deste modelo de velocimetro... mais apresentavel, mais imponente"):
// mostrei 3 alternativas via mockup (ponteiro clássico com zonas fixas,
// arco grosso com marcações, anel completo com selo) e ele escolheu a
// opção C — anel completo (360°, não mais meia-lua) com o número grande no
// centro e um selo de status (Crítico/Atenção/Bom) embaixo. Trocou
// `startAngle={180}/endAngle={0}` (semicírculo) por
// `startAngle={90}/endAngle={-270}` (círculo cheio, começando no topo,
// sentido horário) e removeu o wrapper `overflow-hidden` que recortava a
// metade de baixo — não precisa mais recortar nada. Rótulos de min/max
// saíram (não faziam parte do visual aprovado); o selo de status substitui
// essa referência.
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
  /** Como formatar o valor cru (número central). Default: número puro. */
  unidade?: UnidadeGauge;
  semValorTexto?: string;
  ajudaChave?: string;
};

const COR_VERMELHA = "#dc2626"; // red-600
const COR_AMBAR = "#d97706"; // amber-600
const COR_VERDE = "#16a34a"; // green-600
const COR_TRILHA = "#e2e8f0"; // slate-200
const COR_NEUTRA_BG = "#f1f5f9"; // slate-100
const COR_NEUTRA_TEXTO = "#64748b"; // slate-500

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

// Selo de status embaixo do anel — mesma lógica de zona de `corDoValor`,
// mas devolvendo texto + par de cores fundo/texto claras (padrão "badge"
// já usado em outras telas do app, ex.: STATUS_AGENDAMENTO_COR).
//
// Exportado (Fase Plano-Graficos, 05/09/2026, pedido do Daniel: "os antigos
// [velocímetros] precisam ser removidos se os gráficos novos já refletem a
// mesma informação") — OTIF, Km rodado vazio e ROI da frota tiveram seus
// gauges removidos de /indicadores-frota (substituídos pelos gráficos de
// composição/financeiro), mas o "selo" Crítico/Atenção/Bom que eles
// mostravam continua útil como resumo rápido — os gráficos novos importam
// esta função pra desenhar o mesmo selo, em vez de duplicar a lógica de
// zona em cada Grafico*.tsx.
export function statusDoValor(
  valor: number,
  zonaVermelha: number,
  zonaVerde: number,
  invertido: boolean
): { texto: string; corFundo: string; corTexto: string } {
  const cor = corDoValor(valor, zonaVermelha, zonaVerde, invertido);
  if (cor === COR_VERDE) return { texto: "Bom", corFundo: "#dcfce7", corTexto: "#15803d" };
  if (cor === COR_AMBAR) return { texto: "Atenção", corFundo: "#fef3c7", corTexto: "#b45309" };
  return { texto: "Crítico", corFundo: "#fee2e2", corTexto: "#b91c1c" };
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
  const status = temValor
    ? statusDoValor(valor, zonaVermelha, zonaVerde, invertido)
    : { texto: "Sem dado", corFundo: COR_NEUTRA_BG, corTexto: COR_NEUTRA_TEXTO };

  return (
    <div className="card flex flex-col items-center p-4">
      <p className="flex items-center gap-1 self-start text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>

      <div className="relative mx-auto mt-2 h-[160px] w-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={16}
            startAngle={90}
            endAngle={-270}
            data={[{ valor: percentual }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="valor" cornerRadius={8} fill={cor} background={{ fill: COR_TRILHA }} isAnimationActive={false} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-xl font-bold text-slate-900">{textoValor}</p>
        </div>
      </div>

      <span
        className="mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: status.corFundo, color: status.corTexto }}
      >
        {status.texto}
      </span>
    </div>
  );
}
