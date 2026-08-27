import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { formatarMoeda } from "@/lib/financeiro";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { ExcluirApolice } from "./_components/ExcluirApolice";
import { ShieldCheck, AlertTriangle, Clock } from "lucide-react";

// Fase Apolices-Seguro (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Gestão de Apólices de Seguro"). Alerta de
// vencimento aqui é calculado ao vivo (vigencia_fim vs. hoje) — não passa
// pelo motor de Ações Sugeridas porque não existe uma "execução automática"
// óbvia pra uma apólice vencida (diferente de bloquear motorista): é o
// gestor que precisa renovar com a seguradora, então o alerta é só
// informativo, direto nesta tela.
export default async function ApolicesSeguroPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let apolices: {
    id: string;
    placa: string | null;
    seguradora: string;
    numero_apolice: string;
    vigencia_inicio: string;
    vigencia_fim: string;
    cobertura: string | null;
    valor_franquia: number | null;
    valor_premio: number | null;
  }[] = [];

  if (!semClienteEscolhido && empresaSelecionada) {
    const { data } = await supabase
      .from("apolices_seguro")
      .select("id, placa, seguradora, numero_apolice, vigencia_inicio, vigencia_fim, cobertura, valor_franquia, valor_premio")
      .eq("empresa_id", empresaSelecionada)
      .order("vigencia_fim", { ascending: true });
    apolices = data ?? [];
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const em30Dias = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const vencidas = apolices.filter((a) => a.vigencia_fim < hoje);
  const vencendoEm30 = apolices.filter((a) => a.vigencia_fim >= hoje && a.vigencia_fim <= em30Dias);
  const ativas = apolices.length - vencidas.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Apólices de Seguro</h1>
          <p className="mt-1 text-sm text-slate-500">
            Número da apólice, seguradora, vigência, cobertura e franquia — num lugar só, com alerta de
            vencimento{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/apolices-seguro/nova?empresa=${empresaSelecionada}`} className="btn-primary">
            + Nova Apólice
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
          Selecione um cliente acima pra ver as apólices dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <IndicadorColorido cor="green" icon={ShieldCheck} label="Ativas" valor={String(ativas)} />
            <IndicadorColorido
              cor={vencendoEm30.length > 0 ? "amber" : "green"}
              icon={Clock}
              label="Vencendo em 30 dias"
              valor={String(vencendoEm30.length)}
            />
            <IndicadorColorido
              cor={vencidas.length > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Vencidas"
              valor={String(vencidas.length)}
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Seguradora</th>
                  <th className="px-4 py-3">Nº apólice</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Cobertura</th>
                  <th className="px-4 py-3">Vigência</th>
                  <th className="px-4 py-3">Franquia</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apolices.map((a) => {
                  const vencida = a.vigencia_fim < hoje;
                  const vencendo = !vencida && a.vigencia_fim <= em30Dias;
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{a.seguradora}</td>
                      <td className="px-4 py-3 text-slate-600">{a.numero_apolice}</td>
                      <td className="px-4 py-3 text-slate-600">{a.placa ?? "Frota toda"}</td>
                      <td className="px-4 py-3 text-slate-600">{a.cobertura ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(a.vigencia_inicio)} até {formatDate(a.vigencia_fim)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {a.valor_franquia != null ? formatarMoeda(a.valor_franquia) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={vencida ? "badge-inativo" : vencendo ? "badge-atencao" : "badge-ativo"}>
                          {vencida ? "Vencida" : vencendo ? "Vencendo" : "Ativa"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/apolices-seguro/${a.id}/editar`}
                            className="text-xs font-medium text-frota-600 hover:underline"
                          >
                            Editar
                          </Link>
                          <ExcluirApolice id={a.id} numero={a.numero_apolice} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {apolices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma apólice cadastrada. Clique em &quot;Nova Apólice&quot; para começar.
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
