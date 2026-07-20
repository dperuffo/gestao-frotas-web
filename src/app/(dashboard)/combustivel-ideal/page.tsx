import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

// Fase Onda-2 (benchmark TicketLog, item #6 — "Comparador combustível ideal
// por região") — pedido do Daniel: "Etanol ou gasolina, conforme o
// rendimento do veículo e o preço vigente na região". Reaproveita
// indice_publico_precos_uf() (já usada no índice público de preços) pro
// preço regional e o mesmo padrão de cálculo de km/l de
// indicador_eficiencia_veiculos (Fase 27.119) pro rendimento real por placa.
// Quando falta histórico de um dos dois combustíveis pra uma placa, o
// rendimento que falta é estimado a partir do outro pela regra física
// padrão (etanol ≈ 70% do rendimento da gasolina) — ver RPC
// comparador_combustivel_ideal (migration comparador_combustivel_ideal).
export default async function CombustivelIdealPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { perfil, empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );
  const ehAdmin = perfil === "admin";
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  const { data: linhasRaw, error } = empresaSelecionada
    ? await supabase.rpc("comparador_combustivel_ideal", { p_empresa_id: empresaSelecionada })
    : { data: [], error: null };

  const linhas = linhasRaw ?? [];
  const totalEtanol = linhas.filter((l) => l.recomendacao === "etanol").length;
  const totalGasolina = linhas.filter((l) => l.recomendacao === "gasolina").length;
  const semDados = linhas.filter((l) => !l.recomendacao).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">⛽🌱 Combustível Ideal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pra cada veículo flex, qual combustível compensa mais agora — não é só olhar o preço por litro (a
          famosa &quot;regra dos 70%&quot;), é comparar o <strong>custo por km rodado</strong>: preço do litro
          dividido pelo rendimento real do veículo naquele combustível, no preço vigente da região dele
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
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
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido && (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver o comparador dele.</p>
      )}

      {!semClienteEscolhido && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Veículos" valor={String(linhas.length)} />
            <Indicador label="Etanol compensa" valor={String(totalEtanol)} destaque />
            <Indicador label="Gasolina compensa" valor={String(totalGasolina)} />
          </div>

          <div className="card mb-6 p-4 text-xs leading-relaxed text-slate-500">
            <p className="mb-1 font-medium text-slate-700">Como funciona a conta:</p>
            <p>
              <strong>Custo por km = preço do litro ÷ rendimento (km/l)</strong>. O rendimento real de cada
              veículo vem do histórico de abastecimentos dele (distância percorrida entre um abastecimento e o
              próximo, dividida pelos litros postos). Quando a placa ainda não abasteceu com os dois
              combustíveis, o que falta é estimado a partir do outro pela regra física padrão (etanol ≈ 70% do
              rendimento da gasolina) — essas linhas aparecem com o selo &quot;estimado&quot;. O preço regional
              usa a rede própria do cliente na UF do veículo, com fallback para a média da ANP no estado quando
              a rede não tem postos suficientes ali.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Erro ao carregar o comparador: {error.message}
            </p>
          )}

          {!error && linhas.length === 0 && (
            <div className="card p-8 text-center text-sm text-slate-400">
              Nenhum veículo flex encontrado para este cliente.
            </div>
          )}

          {!error && linhas.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Veículo</th>
                    <th className="px-4 py-3">UF</th>
                    <th className="px-4 py-3">Gasolina</th>
                    <th className="px-4 py-3">Etanol</th>
                    <th className="px-4 py-3">Custo/km gasolina</th>
                    <th className="px-4 py-3">Custo/km etanol</th>
                    <th className="px-4 py-3">Recomendação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.placa} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{l.placa}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.marca || l.modelo ? `${l.marca ?? ""} ${l.modelo ?? ""}`.trim() : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.uf ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.preco_gasolina != null ? (
                          <>
                            R$ {l.preco_gasolina.toFixed(3)}
                            {l.rendimento_gasolina != null && (
                              <span className="ml-1 text-xs text-slate-400">({l.rendimento_gasolina} km/l)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.preco_etanol != null ? (
                          <>
                            R$ {l.preco_etanol.toFixed(3)}
                            {l.rendimento_etanol != null && (
                              <span className="ml-1 text-xs text-slate-400">({l.rendimento_etanol} km/l)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.custo_km_gasolina != null ? `R$ ${l.custo_km_gasolina.toFixed(3)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.custo_km_etanol != null ? `R$ ${l.custo_km_etanol.toFixed(3)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {l.recomendacao ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              l.recomendacao === "etanol"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {l.recomendacao === "etanol" ? "🌱 Etanol" : "⛽ Gasolina"}
                            {l.economia_pct != null ? ` (${l.economia_pct}% mais barato)` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Dados insuficientes</span>
                        )}
                        {l.rendimento_estimado && l.recomendacao && (
                          <span className="ml-1 text-xs text-slate-400" title="Rendimento de um dos combustíveis foi estimado (sem histórico suficiente)">
                            (estimado)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {semDados > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {semDados} veículo(s) sem dados suficientes de preço regional ou histórico de abastecimento pra
              recomendar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-emerald-600" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}
