import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { IndicadorColorido, type CorIndicador } from "@/components/IndicadorColorido";

// Fase Plano-Metricas-Fidelidade (15/09/2026) — pedido do Daniel: quanto uma
// frota (cliente) abastece DENTRO da rede de postos negociada (postos com
// negociação status='aceita' com ela) vs FORA, nos últimos 90 dias. Dados
// vêm da RPC public.aderencia_rede_negociada (ver migração
// aderencia_rede_negociada_normaliza_cnpj), chamada só na visão do CLIENTE
// (não faz sentido pro posto: a "rede negociada" é um conceito do lado de
// quem compra).
//
// Semáforo calibrado pelo enunciado do plano (não pelos dados reais — só
// existe 1 cliente de teste com abastecimento hoje, abde6b34-..., com 5,9%
// de aderência, não dá pra calibrar corte por distribuição real ainda):
// <30% vermelho (quase todo o litro vaza pra fora da rede negociada — é
// dinheiro que a FNI não está capturando via os postos parceiros), 30-60%
// âmbar (metade dentro, metade fora — ainda dá pra crescer), >60% verde
// (maioria do consumo já concentrado na rede negociada).
function corAderencia(pct: number): CorIndicador {
  if (pct < 30) return "red";
  if (pct < 60) return "amber";
  return "green";
}

export type TopPostoExterno = {
  cnpj: string;
  nome: string | null;
  litros: number;
  valor: number;
  abastecimentos: number;
};

export type AderenciaRedeData = {
  litros_dentro: number;
  litros_fora: number;
  valor_dentro: number;
  valor_fora: number;
  percentual_dentro: number;
  percentual_dentro_periodo_anterior: number;
  top_postos_externos: TopPostoExterno[];
};

function formatarLitros(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L`;
}

function formatarMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AderenciaRede({ dados, empresaId }: { dados: AderenciaRedeData; empresaId: string }) {
  const totalLitros = dados.litros_dentro + dados.litros_fora;
  const pct = dados.percentual_dentro;
  const pctAnterior = dados.percentual_dentro_periodo_anterior;
  const diferenca = pct - pctAnterior;

  // Sem litro nenhum abastecido nos últimos 90 dias não há aderência pra
  // calcular — evita mostrar "0%" (vermelho, alarmante) quando na verdade é
  // "sem dado".
  if (totalLitros === 0) {
    return (
      <div className="card mb-6 p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Target className="h-4 w-4" aria-hidden="true" />
          Aderência à Rede Negociada
        </h2>
        <p className="text-sm text-slate-400">Nenhum abastecimento registrado para este cliente nos últimos 90 dias.</p>
      </div>
    );
  }

  let tendencia: { texto: string; tom: "positivo" | "negativo" | "neutro" };
  if (Math.abs(diferenca) < 0.5) {
    tendencia = { texto: `≈ estável (período anterior: ${pctAnterior.toFixed(1)}%)`, tom: "neutro" };
  } else if (diferenca > 0) {
    tendencia = { texto: `↑ subiu ${diferenca.toFixed(1)} p.p. vs período anterior (${pctAnterior.toFixed(1)}%)`, tom: "positivo" };
  } else {
    tendencia = { texto: `↓ caiu ${Math.abs(diferenca).toFixed(1)} p.p. vs período anterior (${pctAnterior.toFixed(1)}%)`, tom: "negativo" };
  }

  const IconeTendencia = Math.abs(diferenca) < 0.5 ? Minus : diferenca > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <IndicadorColorido
          cor={corAderencia(pct)}
          icon={Target}
          label="Aderência à rede negociada (90 dias)"
          valor={`${pct.toFixed(1)}%`}
          sub={`${formatarLitros(dados.litros_dentro)} de ${formatarLitros(totalLitros)}`}
          delta={tendencia}
        />
        <IndicadorColorido
          cor="sky"
          icon={IconeTendencia}
          label="Gasto dentro da rede"
          valor={formatarMoeda(dados.valor_dentro)}
          sub={`${formatarLitros(dados.litros_dentro)} abastecidos com posto parceiro`}
        />
        <IndicadorColorido
          cor="violet"
          icon={IconeTendencia}
          label="Gasto fora da rede (vazamento)"
          valor={formatarMoeda(dados.valor_fora)}
          sub={`${formatarLitros(dados.litros_fora)} abastecidos fora da negociação`}
        />
      </div>

      {dados.top_postos_externos.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Postos externos recorrentes</h2>
            <p className="text-xs text-slate-400">
              Top {dados.top_postos_externos.length} postos fora da rede negociada, por litros abastecidos nos últimos 90 dias —
              candidatos a uma próxima negociação.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Posto</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Litros</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Abastecimentos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dados.top_postos_externos.map((p) => (
                <tr key={p.cnpj || p.nome} className="transition-colors hover:bg-frota-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{p.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.cnpj || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatarLitros(p.litros)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatarMoeda(p.valor)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.abastecimentos}</td>
                  <td className="px-4 py-3 text-right">
                    {p.cnpj && (
                      <Link
                        href={`/negociacoes/novo?empresa=${empresaId}&cnpj=${encodeURIComponent(p.cnpj)}`}
                        className="text-frota-600 hover:underline"
                      >
                        Negociar com este posto
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
