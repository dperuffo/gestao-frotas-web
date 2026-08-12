import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda, formatarDataSemFuso } from "@/lib/financeiro";
import { STATUS_PLANO_VIAGEM, STATUS_PLANO_VIAGEM_LABEL } from "@/lib/constants";
import { BotaoExcluirPlano } from "./_components/BotaoExcluirPlano";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Luggage, Wallet, Gauge, TrendingUp, TrendingDown } from "lucide-react";

type LinhaPlano = {
  id: string;
  nome: string;
  status: string;
  placa: string | null;
  data_saida: string | null;
  km_estimado: number | null;
  custo_total_estimado: number;
  custo_total_real: number | null;
  receita_viagem: number;
  motoristas: { nome_completo: string } | null;
  empresas: { nome: string } | null;
};

// Fase 27.48 — Planos de Viagem: orçamento de custo/receita por viagem
// planejada, linkado opcionalmente a Rotograma ou rota salva da
// Roteirização. Escala esperada é baixa (dezenas/centenas de planos, não
// milhares como Abastecimentos) — por isso não tem paginação server-side
// como as demais telas grandes, só um limite de 500 registros mais recentes.
export default async function PlanosViagemPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; placa?: string; empresa?: string }>;
}) {
  const { status, placa, empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { perfil, empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );
  const ehAdmin = perfil === "admin";
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada && !ehAdmin;

  let query = supabase
    .from("planos_viagem")
    .select("id, nome, status, placa, data_saida, km_estimado, custo_total_estimado, custo_total_real, receita_viagem, motoristas(nome_completo), empresas(nome)")
    .order("criado_em", { ascending: false })
    .limit(500);

  if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
  if (status && (STATUS_PLANO_VIAGEM as readonly string[]).includes(status)) {
    query = query.eq("status", status as (typeof STATUS_PLANO_VIAGEM)[number]);
  }
  if (placa) query = query.ilike("placa", `%${placa}%`);

  const { data, error } = semClienteEscolhido ? { data: [], error: null } : await query;
  const linhas = (data ?? []) as unknown as LinhaPlano[];

  // KPIs — sobre o resultado já filtrado.
  const totalPlanos = linhas.length;
  const orcamentoTotalEstimado = linhas.reduce((s, p) => s + (p.custo_total_estimado ?? 0), 0);
  const receitaTotal = linhas.reduce((s, p) => s + (p.receita_viagem ?? 0), 0);
  const margemEstimada = receitaTotal - orcamentoTotalEstimado;
  const kmTotalEstimado = linhas.reduce((s, p) => s + (p.km_estimado ?? 0), 0);
  const custoMedioPorKm = kmTotalEstimado > 0 ? orcamentoTotalEstimado / kmTotalEstimado : 0;

  // Desempenho por veículo — agrupado em JS (volume baixo, sem necessidade
  // de RPC dedicado).
  const porVeiculo = new Map<string, { planos: number; km: number; custo: number }>();
  for (const p of linhas) {
    if (!p.placa) continue;
    const atual = porVeiculo.get(p.placa) ?? { planos: 0, km: 0, custo: 0 };
    atual.planos += 1;
    atual.km += p.km_estimado ?? 0;
    atual.custo += p.custo_total_estimado ?? 0;
    porVeiculo.set(p.placa, atual);
  }
  const veiculosOrdenados = Array.from(porVeiculo.entries()).sort((a, b) => b[1].custo - a[1].custo);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Planos de Viagem</h1>
          <p className="mt-1 text-sm text-slate-500">
            Orçamento estimado de custos e receita por viagem e veículo
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {!semClienteEscolhido && (empresaSelecionada || !ehAdmin) && (
          <Link href={`/planos-viagem/novo${empresaSelecionada ? `?empresa=${empresaSelecionada}` : ""}`} className="btn-primary">
            + Novo Plano
          </Link>
        )}
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
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os planos de viagem dele.</p>
      )}

      {!semClienteEscolhido && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <IndicadorColorido cor="sky" icon={Luggage} label="Planos de viagem" valor={String(totalPlanos)} />
            <IndicadorColorido cor="violet" icon={Wallet} label="Orçamento total estimado" valor={formatarMoeda(orcamentoTotalEstimado)} />
            <IndicadorColorido
              cor="amber"
              icon={Gauge}
              label="Custo médio por km"
              valor={custoMedioPorKm > 0 ? `${formatarMoeda(custoMedioPorKm)}/km` : "—"}
            />
            <IndicadorColorido
              cor={margemEstimada >= 0 ? "green" : "red"}
              icon={margemEstimada >= 0 ? TrendingUp : TrendingDown}
              label="Margem estimada (receita − custo)"
              valor={formatarMoeda(margemEstimada)}
            />
          </div>

          <form className="mb-4 flex flex-wrap gap-3">
            <input type="hidden" name="empresa" value={empresaParam ?? ""} />
            <select name="status" defaultValue={status ?? ""} className="input text-sm">
              <option value="">Todos os status</option>
              {STATUS_PLANO_VIAGEM.map((s) => (
                <option key={s} value={s}>
                  {STATUS_PLANO_VIAGEM_LABEL[s]}
                </option>
              ))}
            </select>
            <input type="text" name="placa" defaultValue={placa ?? ""} placeholder="Filtrar placa..." className="input" />
            <button type="submit" className="btn-secondary text-sm">
              Filtrar
            </button>
          </form>

          <div className="card mb-6 overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar planos: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Data Saída</th>
                  <th className="px-4 py-3">KM Est.</th>
                  <th className="px-4 py-3">Custo Total Est.</th>
                  <th className="px-4 py-3">Margem Est.</th>
                  <th className="px-4 py-3">Status</th>
                  {ehAdmin && !empresaSelecionada && <th className="px-4 py-3">Cliente</th>}
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((p) => {
                  const margem = (p.receita_viagem ?? 0) - (p.custo_total_estimado ?? 0);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/planos-viagem/${p.id}/editar`} className="font-medium text-frota-600 hover:underline">
                          {p.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.placa ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.motoristas?.nome_completo ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.data_saida ? formatarDataSemFuso(p.data_saida) : "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.km_estimado ? `${p.km_estimado.toLocaleString("pt-BR")} km` : "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatarMoeda(p.custo_total_estimado ?? 0)}</td>
                      <td className={`px-4 py-3 font-medium ${margem >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatarMoeda(margem)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-atencao">{STATUS_PLANO_VIAGEM_LABEL[p.status as (typeof STATUS_PLANO_VIAGEM)[number]] ?? p.status}</span>
                      </td>
                      {ehAdmin && !empresaSelecionada && (
                        <td className="px-4 py-3 text-slate-600">{p.empresas?.nome ?? "—"}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/planos-viagem/${p.id}/editar`} className="text-frota-600 hover:underline">
                            Editar
                          </Link>
                          <BotaoExcluirPlano id={p.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Nenhum plano de viagem encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {veiculosOrdenados.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Desempenho por Veículo</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {veiculosOrdenados.map(([veiculoPlaca, dados]) => (
                  <div key={veiculoPlaca} className="card p-4 transition hover:border-frota-300">
                    <p className="text-sm font-semibold text-slate-900">{veiculoPlaca}</p>
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Planos</dt>
                        <dd className="font-medium text-slate-900">{dados.planos}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">KM total</dt>
                        <dd className="font-medium text-slate-900">{dados.km.toLocaleString("pt-BR")} km</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Custo estimado</dt>
                        <dd className="font-medium text-slate-900">{formatarMoeda(dados.custo)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Custo/km</dt>
                        <dd className="font-medium text-slate-900">
                          {dados.km > 0 ? `${formatarMoeda(dados.custo / dados.km)}/km` : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
