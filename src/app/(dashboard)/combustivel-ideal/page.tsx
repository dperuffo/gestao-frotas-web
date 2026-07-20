import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ListaVeiculosCombustivelIdeal } from "./_components/ListaVeiculosCombustivelIdeal";
import { ListaVeiculosDieselIdeal } from "./_components/ListaVeiculosDieselIdeal";

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

  const [{ data: linhasRaw, error }, { data: linhasDieselRaw, error: erroDiesel }] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("comparador_combustivel_ideal", { p_empresa_id: empresaSelecionada }),
        supabase.rpc("comparador_diesel_ideal", { p_empresa_id: empresaSelecionada }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const linhas = linhasRaw ?? [];
  const totalEtanol = linhas.filter((l) => l.recomendacao === "etanol").length;
  const totalGasolina = linhas.filter((l) => l.recomendacao === "gasolina").length;
  const semDados = linhas.filter((l) => !l.recomendacao).length;

  const linhasDiesel = linhasDieselRaw ?? [];
  const totalAditivadoCompensa = linhasDiesel.filter((l) => l.recomendacao === "aditivado").length;
  const totalComumCompensa = linhasDiesel.filter((l) => l.recomendacao === "comum").length;

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

          <h2 className="mb-3 text-sm font-semibold text-slate-700">🌱⛽ Veículos flex — etanol × gasolina</h2>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Erro ao carregar o comparador: {error.message}
            </p>
          )}

          {!error && <ListaVeiculosCombustivelIdeal itens={linhas} />}

          {semDados > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {semDados} veículo(s) sem dados suficientes de preço regional ou histórico de abastecimento pra
              recomendar.
            </p>
          )}

          <div className="mt-10">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">🛢️✨ Veículos a diesel — comum × aditivado</h2>
            <p className="mb-3 text-xs text-slate-500">
              Diferente do etanol × gasolina, não existe uma razão física universal pra estimar se o aditivado
              compensa — a recomendação só aparece quando a placa já tem histórico de rendimento com os dois. Sem
              isso, mostramos o prêmio de preço do aditivado pra você decidir.
            </p>

            {linhasDiesel.length > 0 && (
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Indicador label="Veículo × família" valor={String(linhasDiesel.length)} />
                <Indicador label="Aditivado compensa" valor={String(totalAditivadoCompensa)} destaque />
                <Indicador label="Comum compensa" valor={String(totalComumCompensa)} />
              </div>
            )}

            {erroDiesel && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                Erro ao carregar o comparador de diesel: {erroDiesel.message}
              </p>
            )}

            {!erroDiesel && <ListaVeiculosDieselIdeal itens={linhasDiesel} />}
          </div>
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
