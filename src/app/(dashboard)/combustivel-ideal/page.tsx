import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ListaVeiculosCombustivelIdeal } from "./_components/ListaVeiculosCombustivelIdeal";
import { ListaVeiculosDieselIdeal } from "./_components/ListaVeiculosDieselIdeal";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { GraficoCombustivelIdeal } from "./_components/GraficoCombustivelIdeal";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, Leaf, Fuel, Sparkles } from "lucide-react";

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

  // Fase Plano-Graficos (04/09/2026, pedido do Daniel) — distribuição de
  // recomendação + ranking dos veículos com maior economia (%), a partir
  // dos itens já carregados acima (sem query nova).
  const distribuicaoFlex = [
    { label: "Etanol", total: totalEtanol },
    { label: "Gasolina", total: totalGasolina },
    { label: "Sem dados", total: semDados },
  ];
  const rankingFlex = linhas
    .filter((l) => l.recomendacao && l.economia_pct != null)
    .map((l) => ({ placa: l.placa, economiaPct: Number(l.economia_pct) }))
    .sort((a, b) => b.economiaPct - a.economiaPct)
    .slice(0, 8);

  const totalDieselSemDados = linhasDiesel.filter((l) => !l.recomendacao).length;
  const distribuicaoDiesel = [
    { label: "Aditivado", total: totalAditivadoCompensa },
    { label: "Comum", total: totalComumCompensa },
    { label: "Sem dados", total: totalDieselSemDados },
  ];
  const rankingDiesel = linhasDiesel
    .filter((l) => l.recomendacao === "comum" && l.premio_aditivado_pct != null)
    .map((l) => ({ placa: l.placa, economiaPct: Number(l.premio_aditivado_pct) }))
    .sort((a, b) => b.economiaPct - a.economiaPct)
    .slice(0, 8);

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
        // Pedido do Daniel: "ter um filtro para selecionar Veículos Flex ou
        // Veículos Diesel para facilitar a busca pelo usuário" — antes as
        // duas seções ficavam sempre empilhadas na mesma página (rolagem
        // longa, sobretudo em frotas grandes). Reaproveita o mesmo
        // AbasPainel já usado em Fretes/Relatórios/Inteligência de Rede/
        // Integrações/Postos, espelhando as abas "Flex"/"Diesel" que o PWA
        // Cliente já tinha (DefaultTabController em combustivel_ideal_screen.dart).
        <AbasPainel
          abas={[
            {
              id: "flex",
              label: "🌱⛽ Flex",
              conteudo: (
                <>
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <IndicadorColorido cor="sky" icon={Truck} label="Veículos" valor={String(linhas.length)} />
                    <IndicadorColorido cor="green" icon={Leaf} label="Etanol compensa" valor={String(totalEtanol)} />
                    <IndicadorColorido cor="amber" icon={Fuel} label="Gasolina compensa" valor={String(totalGasolina)} />
                  </div>

                  <GraficoCombustivelIdeal
                    distribuicao={distribuicaoFlex}
                    coresDistribuicao={{ Etanol: "#16a34a", Gasolina: "#d97706", "Sem dados": "#94A3B8" }}
                    ranking={rankingFlex}
                    tituloDistribuicao="Recomendação por veículo"
                    tituloRanking="Maior economia (top 8)"
                  />

                  <div className="card mb-6 p-4 text-xs leading-relaxed text-slate-500">
                    <p className="mb-1 font-medium text-slate-700">Como funciona a conta:</p>
                    <p>
                      <strong>Custo por km = preço do litro ÷ rendimento (km/l)</strong>. O rendimento real de
                      cada veículo vem do histórico de abastecimentos dele (distância percorrida entre um
                      abastecimento e o próximo, dividida pelos litros postos). Quando a placa ainda não
                      abasteceu com os dois combustíveis, o que falta é estimado a partir do outro pela regra
                      física padrão (etanol ≈ 70% do rendimento da gasolina) — essas linhas aparecem com o selo
                      &quot;estimado&quot;. O preço regional usa a rede própria do cliente na UF do veículo, com
                      fallback para a média da ANP no estado quando a rede não tem postos suficientes ali.
                    </p>
                  </div>

                  {error && (
                    <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      Erro ao carregar o comparador: {error.message}
                    </p>
                  )}

                  {!error && <ListaVeiculosCombustivelIdeal itens={linhas} />}

                  {semDados > 0 && (
                    <p className="mt-3 text-xs text-slate-400">
                      {semDados} veículo(s) sem dados suficientes de preço regional ou histórico de abastecimento
                      pra recomendar.
                    </p>
                  )}
                </>
              ),
            },
            {
              id: "diesel",
              label: "🛢️✨ Diesel",
              conteudo: (
                <>
                  <p className="mb-3 text-xs text-slate-500">
                    Diferente do etanol × gasolina, não existe uma razão física universal pra estimar se o
                    aditivado compensa — a recomendação só aparece quando a placa já tem histórico de rendimento
                    com os dois. Sem isso, mostramos o prêmio de preço do aditivado pra você decidir.
                  </p>

                  {linhasDiesel.length > 0 && (
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <IndicadorColorido cor="sky" icon={Truck} label="Veículo × família" valor={String(linhasDiesel.length)} />
                      <IndicadorColorido cor="green" icon={Sparkles} label="Aditivado compensa" valor={String(totalAditivadoCompensa)} />
                      <IndicadorColorido cor="amber" icon={Fuel} label="Comum compensa" valor={String(totalComumCompensa)} />
                    </div>
                  )}

                  <GraficoCombustivelIdeal
                    distribuicao={distribuicaoDiesel}
                    coresDistribuicao={{ Aditivado: "#0ea5e9", Comum: "#d97706", "Sem dados": "#94A3B8" }}
                    ranking={rankingDiesel}
                    tituloDistribuicao="Recomendação por veículo × família"
                    tituloRanking="Maior prêmio do aditivado (top 8, onde comum compensa)"
                  />

                  {erroDiesel && (
                    <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      Erro ao carregar o comparador de diesel: {erroDiesel.message}
                    </p>
                  )}

                  {!erroDiesel && <ListaVeiculosDieselIdeal itens={linhasDiesel} />}
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
