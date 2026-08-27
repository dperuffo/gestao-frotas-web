import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { AcoesPneu } from "./_components/AcoesPneu";
import { CircleDot, Wrench, DollarSign } from "lucide-react";

// Fase Gestao-Pneus (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Módulo dedicado de Gestão de Pneus"). Km
// rodado e custo/km são calculados aqui, ao vivo, cruzando
// hodometro_instalacao do pneu com o hodômetro ATUAL do veículo (via RPC
// veiculos_da_empresa, mesma fonte que /veiculos usa) — ou, se o pneu já
// foi removido, com o hodômetro de remoção que ficou registrado.
export default async function PneusPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let pneus: {
    id: string;
    placa: string;
    posicao: string;
    marca: string | null;
    modelo: string | null;
    medida: string | null;
    status: string;
    hodometro_instalacao: number;
    hodometro_remocao: number | null;
    valor_aquisicao: number | null;
    numero_recapagens: number;
    custo_recapagens_total: number;
  }[] = [];
  let hodometroPorPlaca = new Map<string, number>();

  if (!semClienteEscolhido && empresaSelecionada) {
    const [{ data }, { data: veiculos }] = await Promise.all([
      supabase
        .from("pneus")
        .select(
          "id, placa, posicao, marca, modelo, medida, status, hodometro_instalacao, hodometro_remocao, valor_aquisicao, numero_recapagens, custo_recapagens_total"
        )
        .eq("empresa_id", empresaSelecionada)
        .order("placa")
        .order("posicao"),
      supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada }),
    ]);
    pneus = data ?? [];
    hodometroPorPlaca = new Map((veiculos ?? []).map((v) => [v.placa, v.hodometro_atual ?? 0]));
  }

  const ativos = pneus.filter((p) => p.status === "Em uso" || p.status === "Estepe");
  const comMaisDe3Recapagens = pneus.filter((p) => p.numero_recapagens >= 3).length;
  const custoTotalInvestido = pneus.reduce((soma, p) => soma + (p.valor_aquisicao ?? 0) + p.custo_recapagens_total, 0);

  function kmRodado(p: (typeof pneus)[number]): number | null {
    const hodometroFinal = p.status === "Em uso" || p.status === "Estepe" ? hodometroPorPlaca.get(p.placa) : p.hodometro_remocao;
    if (hodometroFinal == null) return null;
    const km = hodometroFinal - p.hodometro_instalacao;
    return km > 0 ? km : null;
  }

  function custoPorKm(p: (typeof pneus)[number]): number | null {
    const km = kmRodado(p);
    if (!km) return null;
    const custoTotal = (p.valor_aquisicao ?? 0) + p.custo_recapagens_total;
    return custoTotal > 0 ? custoTotal / km : null;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gestão de Pneus</h1>
          <p className="mt-1 text-sm text-slate-500">
            Posição no veículo, km rodado, recapagens e custo por km{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/pneus/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Novo Pneu
          </Link>
        )}
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
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Selecione um cliente acima pra ver os pneus dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <IndicadorColorido cor="green" icon={CircleDot} label="Em uso/estepe" valor={String(ativos.length)} />
            <IndicadorColorido
              cor={comMaisDe3Recapagens > 0 ? "amber" : "green"}
              icon={Wrench}
              label="3+ recapagens"
              valor={String(comMaisDe3Recapagens)}
            />
            <IndicadorColorido cor="sky" icon={DollarSign} label="Investido (compra + recapagens)" valor={formatarMoeda(custoTotalInvestido)} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Posição</th>
                  <th className="px-4 py-3">Marca/Modelo</th>
                  <th className="px-4 py-3">Km rodado</th>
                  <th className="px-4 py-3">Recapagens</th>
                  <th className="px-4 py-3">Custo/km</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pneus.map((p) => {
                  const km = kmRodado(p);
                  const custoKm = custoPorKm(p);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.placa}</td>
                      <td className="px-4 py-3 text-slate-600">{p.posicao}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {[p.marca, p.modelo].filter(Boolean).join(" ") || "—"}
                        {p.medida ? <span className="text-xs text-slate-400"> ({p.medida})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{km != null ? `${km.toLocaleString("pt-BR")} km` : "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.numero_recapagens}</td>
                      <td className="px-4 py-3 text-slate-600">{custoKm != null ? formatarMoeda(custoKm) : "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            p.status === "Em uso" || p.status === "Estepe"
                              ? "badge-ativo"
                              : p.status === "Descartado"
                                ? "badge-inativo"
                                : "badge-atencao"
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AcoesPneu id={p.id} status={p.status} />
                      </td>
                    </tr>
                  );
                })}
                {pneus.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum pneu cadastrado. Clique em &quot;Novo Pneu&quot; para começar.
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
