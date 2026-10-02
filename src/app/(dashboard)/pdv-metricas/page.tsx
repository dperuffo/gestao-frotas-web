import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Fuel, CheckCircle2, XCircle, Timer, Store } from "lucide-react";
import { GraficoPdvMetricas, type ItemRevenda, type ItemSerieDiaria } from "./_components/GraficoPdvMetricas";

type SearchParams = { dias?: string };

const OPCOES_PERIODO = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

type RespostaMetricas = {
  status: string;
  periodo_dias: number;
  total: number;
  por_status: Record<string, number> | null;
  tempo_medio_confirmacao_segundos: number | null;
  valor_total_confirmado: number;
  por_revenda: ItemRevenda[];
  serie_diaria: ItemSerieDiaria[];
};

function formatarSegundos(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const min = Math.floor(s / 60);
  const seg = Math.round(s % 60);
  return `${min}min ${seg}s`;
}

// Fase 4 PDV (02/10/2026, piloto controlado — ver Arquitetura_Solucao_PDV.docx)
// Dashboard admin-only pra acompanhar o uso real do PDV durante o piloto:
// volume, taxa de confirmação/negação, tempo médio de confirmação e
// ranking por revenda. Mesmo padrão de bloqueio das demais telas admin-only
// (/log-auditoria, /assinaturas) — perfil_usuario_atual() checado aqui E
// de novo dentro da RPC (dados cross-tenant, não dá pra confiar só na RLS).
export default async function PdvMetricasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { dias: diasParam } = await searchParams;
  const dias = Number(diasParam) || 30;

  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Esta tela é exclusiva do time interno (perfil administrador).
        </p>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("metricas_pdv_dashboard", { p_dias: dias });
  const metricas = data as RespostaMetricas | null;

  const porStatus = metricas?.por_status ?? {};
  const confirmados = porStatus.confirmado ?? 0;
  const negados = porStatus.negado ?? 0;
  const aguardando = porStatus.aguardando_pdv ?? 0;
  const expirados = porStatus.expirado ?? 0;
  const total = metricas?.total ?? 0;
  const taxaNegacao = total > 0 ? Math.round((negados / total) * 100) : 0;

  return (
    <div>
      <CabecalhoPagina
        titulo={
          <>
            <Fuel className="h-5 w-5" /> Dashboard PDV (Piloto)
          </>
        }
        descricao="Volume, confirmação e tempo de resposta do canal de abastecimento via PDV — acompanhamento da Fase 4 (piloto controlado)."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {OPCOES_PERIODO.map((o) => (
          <Link
            key={o.dias}
            href={`/pdv-metricas?dias=${o.dias}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              dias === o.dias ? "bg-frota-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {error || !metricas || metricas.status !== "ok" ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
          Não consegui carregar as métricas agora. Tente de novo em instantes.
        </p>
      ) : total === 0 ? (
        <p className="card p-6 text-sm text-slate-500 dark:text-slate-400">
          Nenhum abastecimento via PDV nos últimos {dias} dias. Os números aparecem aqui conforme as revendas do
          piloto começarem a usar.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <IndicadorColorido cor="sky" icon={Fuel} label="Total" valor={String(total)} />
            <IndicadorColorido
              cor="green"
              icon={CheckCircle2}
              label="Confirmados"
              valor={String(confirmados)}
              sub={`R$ ${metricas.valor_total_confirmado.toFixed(2)}`}
            />
            <IndicadorColorido
              cor={taxaNegacao > 10 ? "red" : "amber"}
              icon={XCircle}
              label="Negados"
              valor={String(negados)}
              sub={`${taxaNegacao}% do total`}
            />
            <IndicadorColorido
              cor="violet"
              icon={Timer}
              label="Tempo médio de confirmação"
              valor={formatarSegundos(metricas.tempo_medio_confirmacao_segundos)}
            />
            <IndicadorColorido
              cor="amber"
              icon={Store}
              label="Revendas ativas"
              valor={String(metricas.por_revenda.length)}
              sub={aguardando + expirados > 0 ? `${aguardando} aguardando, ${expirados} expirados` : undefined}
            />
          </div>

          <GraficoPdvMetricas serieDiaria={metricas.serie_diaria} porRevenda={metricas.por_revenda} />

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Revenda</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Confirmados</th>
                  <th className="px-4 py-3">Negados</th>
                  <th className="px-4 py-3">Valor confirmado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {metricas.por_revenda.map((r) => (
                  <tr key={r.revenda_empresa_id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.nome_revenda}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.total}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.confirmados}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.negados}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">R$ {r.valor_total.toFixed(2)}</td>
                  </tr>
                ))}
                {metricas.por_revenda.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma revenda com movimento no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
