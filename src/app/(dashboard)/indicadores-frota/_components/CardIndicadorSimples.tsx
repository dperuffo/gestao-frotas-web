import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { formatarValor, statusDoValor, type UnidadeGauge } from "@/lib/statusIndicador";

// Fase Reformulacao-Indicadores-Frota (05/09/2026, pedido do Daniel: "não
// gostei da mistura de gráficos e dados abertos... reformulação pra
// facilitar leitura e tomada de decisão") — troca o velocímetro (anel
// gráfico) por um card numérico simples: número grande + selo Crítico/
// Atenção/Bom, sem o RadialBarChart. Mesma lógica de zona/formatação do
// GaugeIndicador (reaproveitada via import), só a apresentação visual muda
// — objetivo é reduzir o "peso" visual de cada indicador e caber mais por
// linha, deixando os gráficos (Recharts) como os únicos elementos gráficos
// de fato na tela.
//
// O GaugeIndicador em si NÃO foi alterado (além do export de
// formatarValor/statusDoValor) porque outras 4 telas do app
// (estoque-pecas, conciliacao-bancaria, manutencao-preditiva, motoristas)
// reusam o velocímetro — a decisão de simplificar foi só pra
// /indicadores-frota, que tem uma quantidade de indicadores muito maior
// numa página só.
export type CardIndicadorSimplesProps = {
  label: string;
  valor: number | null;
  /** true = valor MENOR é melhor. false/omitido = valor MAIOR é melhor. */
  invertido?: boolean;
  zonaVermelha: number;
  zonaVerde: number;
  unidade?: UnidadeGauge;
  semValorTexto?: string;
  ajudaChave?: string;
};

const COR_NEUTRA_BG = "#f1f5f9";
const COR_NEUTRA_TEXTO = "#64748b";

export function CardIndicadorSimples({
  label,
  valor,
  invertido = false,
  zonaVermelha,
  zonaVerde,
  unidade,
  semValorTexto = "—",
  ajudaChave,
}: CardIndicadorSimplesProps) {
  const temValor = valor !== null && !Number.isNaN(valor);
  const textoValor = temValor ? formatarValor(valor, unidade) : semValorTexto;
  const status = temValor
    ? statusDoValor(valor, zonaVermelha, zonaVerde, invertido)
    : { texto: "Sem dado", corFundo: COR_NEUTRA_BG, corTexto: COR_NEUTRA_TEXTO };

  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p className="text-2xl font-bold leading-tight text-slate-900">{textoValor}</p>
      <span
        className="self-start rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: status.corFundo, color: status.corTexto }}
      >
        {status.texto}
      </span>
    </div>
  );
}
