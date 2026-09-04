import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { MissoesGestao } from "./MissoesGestao";
import { listarMissoes } from "./missoesActions";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Users, Droplet, Award, Gift } from "lucide-react";
import { GraficoFidelidade, type ItemDistribuicao, type ItemRankingPontos } from "./_components/GraficoFidelidade";

// Painel de indicadores do programa "Estrada que Cuida" (app do motorista)
// por motorista — pedido do Daniel em 17/07: visão do cliente (só os
// motoristas da empresa dele) e visão do admin (qualquer empresa, mesmo
// seletor multi-cliente já usado em /antifraude). Dados vêm da RPC
// indicadores_fidelidade_motoristas (SECURITY DEFINER — precisa bypassar
// RLS porque agrega linhas de fidelidade_pontos_ledger etc. de VÁRIOS
// motoristas de uma vez, e essas tabelas só liberam SELECT pro próprio
// motorista via app; a autorização por empresa é feita dentro da própria
// função, com a mesma checagem de empresas_do_usuario()/admin usada em
// toda a aplicação).

const NIVEIS = [
  { nome: "Bronze", min: 0 },
  { nome: "Prata", min: 10000 },
  { nome: "Ouro", min: 30000 },
  { nome: "Diamante", min: 70000 },
  { nome: "Herói da Estrada", min: 150000 },
] as const;

function nivelDoSaldo(saldo: number): string {
  let atual = NIVEIS[0].nome as string;
  for (const n of NIVEIS) {
    if (saldo >= n.min) atual = n.nome;
  }
  return atual;
}

type IndicadorRow = {
  motorista_id: string;
  nome_completo: string;
  telefone: string | null;
  aderido: boolean | null;
  aderiu_em: string | null;
  saldo_pontos: number;
  abastecimentos_confirmados: number;
  missoes_concluidas: number;
  resgates_total: number;
  resgates_concluidos: number;
};

export default async function FidelidadeMotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let indicadores: IndicadorRow[] = [];
  let erroConsulta: string | undefined;
  let missoes: Awaited<ReturnType<typeof listarMissoes>> = [];
  if (empresaSelecionada) {
    const { data, error } = await supabase.rpc("indicadores_fidelidade_motoristas", {
      p_empresa_id: empresaSelecionada,
    });
    indicadores = (data ?? []) as IndicadorRow[];
    erroConsulta = error?.message;
    missoes = await listarMissoes(empresaSelecionada);
  }

  const aderidos = indicadores.filter((i) => i.aderido);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — agregações do gráfico, todas
  // a partir do indicadores já carregado (sem query nova).
  const porNivelMap = new Map<string, number>();
  for (const i of aderidos) {
    const nivel = nivelDoSaldo(i.saldo_pontos);
    porNivelMap.set(nivel, (porNivelMap.get(nivel) ?? 0) + 1);
  }
  const porNivel: ItemDistribuicao[] = NIVEIS.map((n) => ({ label: n.nome, total: porNivelMap.get(n.nome) ?? 0 })).filter(
    (d) => d.total > 0
  );

  const porAdesao: ItemDistribuicao[] = [
    { label: "Aderiu", total: aderidos.length },
    { label: "Não aderiu", total: indicadores.length - aderidos.length },
  ].filter((d) => d.total > 0);

  const rankingPontos: ItemRankingPontos[] = [...aderidos]
    .sort((a, b) => b.saldo_pontos - a.saldo_pontos)
    .slice(0, 8)
    .map((i) => ({ nome: i.nome_completo, pontos: i.saldo_pontos }))
    .reverse();

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🎁 Fidelidade dos Motoristas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Engajamento dos motoristas no programa &quot;Estrada que Cuida&quot; (app próprio do motorista)
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
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
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os indicadores dele.</p>
      ) : (
        <>
          {/* Pedido do Daniel (19/07): missões (de engajamento + padrão) no topo
              da tela — é o que o cliente mais mexe (criar/editar/inativar
              missão), não faz sentido rolar a página toda pra achar. */}
          <MissoesGestao empresaId={empresaSelecionada} missoesIniciais={missoes} />

          <div className="mb-4 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido
              cor="sky"
              icon={Users}
              label="Motoristas aderidos"
              valor={`${aderidos.length} / ${indicadores.length}`}
            />
            <IndicadorColorido
              cor="violet"
              icon={Droplet}
              label="Abastecimentos confirmados"
              valor={String(indicadores.reduce((soma, i) => soma + i.abastecimentos_confirmados, 0))}
            />
            <IndicadorColorido
              cor="amber"
              icon={Award}
              label="Missões concluídas"
              valor={String(indicadores.reduce((soma, i) => soma + i.missoes_concluidas, 0))}
            />
            <IndicadorColorido
              cor="green"
              icon={Gift}
              label="Resgates (concluídos / total)"
              valor={`${indicadores.reduce((soma, i) => soma + i.resgates_concluidos, 0)} / ${indicadores.reduce((soma, i) => soma + i.resgates_total, 0)}`}
            />
          </div>

          <GraficoFidelidade porNivel={porNivel} porAdesao={porAdesao} rankingPontos={rankingPontos} />

          <div className="card overflow-x-auto">
            {erroConsulta && <p className="p-4 text-sm text-red-600">Erro ao carregar indicadores: {erroConsulta}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Adesão</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Pontos</th>
                  <th className="px-4 py-3">Abastecimentos</th>
                  <th className="px-4 py-3">Missões</th>
                  <th className="px-4 py-3">Resgates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indicadores.map((m) => (
                  <tr key={m.motorista_id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{m.nome_completo}</td>
                    <td className="px-4 py-3">
                      <span className={m.aderido ? "badge-ativo" : "badge-inativo"}>
                        {m.aderido ? "Aderido" : "Não aderiu"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.aderido ? nivelDoSaldo(m.saldo_pontos) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m.saldo_pontos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-slate-600">{m.abastecimentos_confirmados}</td>
                    <td className="px-4 py-3 text-slate-600">{m.missoes_concluidas}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {m.resgates_concluidos}/{m.resgates_total}
                    </td>
                  </tr>
                ))}
                {indicadores.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhum motorista cadastrado pra este cliente.
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
