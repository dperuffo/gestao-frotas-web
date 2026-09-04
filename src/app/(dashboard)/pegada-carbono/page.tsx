import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { GraficoPegadaCarbono, type ItemCo2 } from "./_components/GraficoPegadaCarbono";

// Fase Onda-3 (benchmark TicketLog, item #10 — "Sustentabilidade / pegada de
// carbono") — pedido do Daniel. Estima emissões de CO2 a partir dos litros
// já registrados por abastecimento (abastecimentos_unificado), sem precisar
// de fonte de dado nova. Fatores de emissão ficam na tabela
// fatores_emissao_co2 (editável sem deploy) — ver RPC pegada_carbono_periodo
// (migration pegada_carbono). É uma ESTIMATIVA indicativa pra
// acompanhamento interno/ESG, não um inventário certificado (isso exigiria
// metodologia própria e auditoria).
const LABEL_CATEGORIA: Record<string, string> = {
  "GASOLINA COMUM": "⛽ Gasolina Comum",
  "GASOLINA ADITIVADA": "⛽ Gasolina Aditivada",
  "ETANOL HIDRATADO": "🌱 Etanol Hidratado",
  "OLEO DIESEL": "🛢️ Óleo Diesel",
  "OLEO DIESEL S10": "🛢️ Óleo Diesel S10",
  GNV: "🔥 GNV",
  GLP: "🔥 GLP",
};

// Aproximação amplamente usada em material de divulgação ESG (não é um
// fator científico exato, varia com espécie/idade da árvore) — só pra dar
// uma noção intuitiva do tamanho do número. Deixado explícito na tela.
const KG_CO2_ABSORVIDO_POR_ARVORE_AO_ANO = 22;

function formatarPeriodoPadrao() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 90);
  return { inicio: inicio.toISOString().slice(0, 10), fim: hoje.toISOString().slice(0, 10) };
}

export default async function PegadaCarbonoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; inicio?: string; fim?: string }>;
}) {
  const { empresa: empresaParam, inicio: inicioParam, fim: fimParam } = await searchParams;
  const supabase = await createClient();

  const { perfil, empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );
  const ehAdmin = perfil === "admin";
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  const padrao = formatarPeriodoPadrao();
  const dataInicio = inicioParam || padrao.inicio;
  const dataFim = fimParam || padrao.fim;

  const { data: linhasRaw, error } = empresaSelecionada
    ? await supabase.rpc("pegada_carbono_periodo", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      })
    : { data: [], error: null };

  const linhas = linhasRaw ?? [];
  const totalKg = linhas.reduce((soma, l) => soma + (l.co2_estimado_kg ?? 0), 0);
  const totalToneladas = totalKg / 1000;
  const litrosTotal = linhas.reduce((soma, l) => soma + (l.litros_total ?? 0), 0);
  const arvoresEquivalentes = Math.round(totalKg / KG_CO2_ABSORVIDO_POR_ARVORE_AO_ANO);
  const semFator = linhas.filter((l) => l.fator_kg_co2_por_litro == null);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — pizza por categoria, a partir
  // das linhas já carregadas (sem query nova).
  const co2PorCategoria: ItemCo2[] = linhas
    .filter((l) => l.co2_estimado_kg != null && l.co2_estimado_kg > 0)
    .map((l) => ({ label: LABEL_CATEGORIA[l.categoria] ?? l.categoria, toneladas: (l.co2_estimado_kg ?? 0) / 1000 }))
    .sort((a, b) => b.toneladas - a.toneladas);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🌍 Pegada de Carbono</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estimativa de CO2 emitido pela frota, calculada a partir dos litros já registrados nos abastecimentos
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Indicador indicativo para
          acompanhamento interno/ESG — não substitui um inventário de emissões certificado.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">{ehAdmin ? "Todos os clientes" : "Selecione um cliente..."}</option>
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

      {semClienteEscolhido && (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver a pegada de carbono dele.</p>
      )}

      {!semClienteEscolhido && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Indicador label="CO2 estimado no período" valor={`${totalToneladas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t`} />
            <Indicador label="Litros abastecidos" valor={litrosTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} />
            <Indicador
              label="Equivalente a"
              valor={arvoresEquivalentes > 0 ? `🌳 ${arvoresEquivalentes.toLocaleString("pt-BR")} árvores/ano` : "—"}
            />
          </div>

          <GraficoPegadaCarbono dados={co2PorCategoria} />

          <div className="card mb-6 p-4 text-xs leading-relaxed text-slate-500">
            <p>
              O cálculo multiplica os litros abastecidos de cada combustível por um fator médio de emissão (kg
              de CO2 por litro), publicado pelo Programa Brasileiro GHG Protocol. A equivalência em árvores usa
              uma aproximação de {KG_CO2_ABSORVIDO_POR_ARVORE_AO_ANO} kg de CO2 absorvidos por árvore adulta por
              ano — só pra dar uma noção intuitiva do tamanho do número, não é um fator científico exato.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Erro ao carregar a pegada de carbono: {error.message}
            </p>
          )}

          {!error && linhas.length === 0 && (
            <div className="card p-8 text-center text-sm text-slate-400">
              Nenhum abastecimento encontrado neste período.
            </div>
          )}

          {!error && linhas.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Combustível</th>
                    <th className="px-4 py-3">Litros</th>
                    <th className="px-4 py-3">Fator (kg CO2/L)</th>
                    <th className="px-4 py-3">CO2 estimado</th>
                    <th className="px-4 py-3">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.categoria} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">{LABEL_CATEGORIA[l.categoria] ?? l.categoria}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.litros_total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.fator_kg_co2_por_litro != null ? l.fator_kg_co2_por_litro : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {l.co2_estimado_kg != null
                          ? `${(l.co2_estimado_kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t`
                          : "não estimado"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.co2_estimado_kg != null && totalKg > 0
                          ? `${((l.co2_estimado_kg / totalKg) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {semFator.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {semFator.map((l) => LABEL_CATEGORIA[l.categoria] ?? l.categoria).join(", ")} sem fator de emissão
              cadastrado — não entrou no total.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
