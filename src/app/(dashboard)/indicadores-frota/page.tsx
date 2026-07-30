import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

type SearchParams = { empresa?: string; inicio?: string; fim?: string };

function paraISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type KpisFrota = {
  total_veiculos: number;
  dias_periodo: number;
  dias_parado_total: number;
  disponibilidade_pct: number | null;
  km_total: number | null;
  custo_operacional_total: number;
  cpk_operacional: number | null;
  litros_total: number | null;
  media_km_l: number | null;
  dias_disponivel_total: number;
  dias_com_movimento_total: number;
  utilizacao_pct: number | null;
  manutencao_preventiva_custo: number;
  manutencao_corretiva_custo: number;
  manutencao_nao_classificada_custo: number;
  pct_corretiva: number | null;
  // Fase C (30/07/2026) — checklist de inspeção veicular (/checklist-veiculos)
  // e registro de sinistros (/sinistros), os 2 fluxos de captura que faltavam.
  itens_inspecionados: number;
  itens_conformes: number;
  conformidade_pct: number | null;
  tmrnc_horas: number | null;
  total_sinistros: number;
  indice_sinistralidade: number | null;
};

// Fase Indicadores-da-Frota (30/07/2026) — pedido do Daniel a partir de um
// artigo sobre os "8 KPIs essenciais" de gestão de frotas. Fase A/B: os 5 que
// dava pra calcular com dado já coletado (disponibilidade, CPK operacional,
// consumo médio, utilização, proporção corretiva/preventiva — esta última
// via nova coluna `tipo` em manutencoes_realizadas). Fase C: os 3 que
// faltavam — conformidade por checklist e TMRNC (checklist de inspeção
// veicular, novo) e índice de sinistralidade (registro de sinistros, novo)
// — completando os 8 do benchmark.
export default async function IndicadoresFrotaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, inicio, fim } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const agora = new Date();
  const inicioDefault = new Date(agora);
  inicioDefault.setDate(inicioDefault.getDate() - 90);
  const dataInicio = inicio || paraISO(inicioDefault);
  const dataFim = fim || paraISO(agora);

  const { data: kpisRaw, error } = empresaSelecionada
    ? await supabase.rpc("kpis_frota_resumo", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      })
    : { data: null, error: null };

  const kpis = (Array.isArray(kpisRaw) ? kpisRaw[0] : kpisRaw) as KpisFrota | null | undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Indicadores da Frota</h1>
        <p className="mt-1 text-sm text-slate-500">
          Os principais KPIs de gestão de frota, calculados a partir dos dados já cadastrados — abastecimentos,
          manutenções e hodômetro.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className="input text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver os indicadores da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && kpis && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador
              label="Índice de disponibilidade"
              valor={kpis.disponibilidade_pct !== null ? `${kpis.disponibilidade_pct}%` : "—"}
              ajudaChave="indicadores_frota.disponibilidade"
              destaque={kpis.disponibilidade_pct !== null && kpis.disponibilidade_pct < 90 ? "aviso" : undefined}
            />
            <Indicador
              label="Custo por km (CPK operacional)"
              valor={kpis.cpk_operacional !== null ? `${formatarMoeda(kpis.cpk_operacional)}/km` : "—"}
              ajudaChave="indicadores_frota.cpk"
            />
            <Indicador
              label="Consumo médio da frota"
              valor={kpis.media_km_l !== null ? `${kpis.media_km_l} km/l` : "—"}
              ajudaChave="indicadores_frota.consumo"
            />
            <Indicador
              label="Taxa de utilização"
              valor={kpis.utilizacao_pct !== null ? `${kpis.utilizacao_pct}%` : "—"}
              ajudaChave="indicadores_frota.utilizacao"
              destaque={kpis.utilizacao_pct !== null && kpis.utilizacao_pct < 70 ? "aviso" : undefined}
            />
            <Indicador
              label="Manutenção corretiva (% do custo)"
              valor={kpis.pct_corretiva !== null ? `${kpis.pct_corretiva}%` : "Sem manutenção classificada"}
              ajudaChave="indicadores_frota.corretiva"
              destaque={kpis.pct_corretiva !== null && kpis.pct_corretiva > 20 ? "aviso" : undefined}
            />
            <Indicador label="Veículos ativos no período" valor={String(kpis.total_veiculos)} />
            <Indicador
              label="Taxa de conformidade (checklist)"
              valor={kpis.conformidade_pct !== null ? `${kpis.conformidade_pct}%` : "Sem inspeções no período"}
              ajudaChave="indicadores_frota.conformidade"
              destaque={kpis.conformidade_pct !== null && kpis.conformidade_pct < 90 ? "aviso" : undefined}
            />
            <Indicador
              label="Tempo médio de resolução (TMRNC)"
              valor={kpis.tmrnc_horas !== null ? `${kpis.tmrnc_horas}h` : "Sem pendências resolvidas"}
              ajudaChave="indicadores_frota.tmrnc"
            />
            <Indicador
              label="Índice de sinistralidade"
              valor={kpis.indice_sinistralidade !== null ? `${kpis.indice_sinistralidade}%` : "—"}
              ajudaChave="indicadores_frota.sinistralidade"
              destaque={kpis.indice_sinistralidade !== null && kpis.indice_sinistralidade > 10 ? "aviso" : undefined}
            />
          </div>

          {kpis.manutencao_nao_classificada_custo > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ {formatarMoeda(kpis.manutencao_nao_classificada_custo)} em manutenções deste período ainda não foram
              classificadas como Preventiva ou Corretiva — o indicador de manutenção corretiva acima considera só as
              já classificadas. Classifique as novas manutenções em{" "}
              <Link href="/manutencao-preditiva" className="underline">
                Manutenção Preditiva
              </Link>
              .
            </div>
          )}

          {kpis.itens_inspecionados === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nenhuma inspeção registrada neste período — a taxa de conformidade e o TMRNC aparecem assim que a
              primeira inspeção for feita em{" "}
              <Link href="/checklist-veiculos" className="underline">
                Checklist de Inspeção
              </Link>
              .
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({
  label,
  valor,
  destaque,
  ajudaChave,
}: {
  label: string;
  valor: string;
  destaque?: "aviso";
  ajudaChave?: string;
}) {
  return (
    <div className={`card p-4 ${destaque === "aviso" ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${destaque === "aviso" ? "text-amber-700" : "text-slate-900"}`}>
        {valor}
      </p>
    </div>
  );
}
