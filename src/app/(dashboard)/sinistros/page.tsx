import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { ClipboardList, AlertTriangle, Wallet } from "lucide-react";

type SearchParams = { empresa?: string; q?: string };

type Sinistro = {
  id: number;
  placa: string;
  motorista_nome: string | null;
  data_sinistro: string;
  tipo: string;
  gravidade: string | null;
  houve_vitima: boolean;
  custo_estimado: number | null;
  local_ocorrencia: string | null;
};

const GRAVIDADE_COR: Record<string, string> = {
  Leve: "bg-emerald-50 text-emerald-700",
  Moderada: "bg-amber-50 text-amber-700",
  Grave: "bg-red-50 text-red-700",
};

// Fase Indicadores-da-Frota — Sinistros (30/07/2026). Registro simples de
// ocorrências (colisão, furto/roubo, incêndio, avaria) usado para o KPI de
// índice de sinistralidade (kpis_frota_resumo.indice_sinistralidade),
// mesmo espírito de /multas mas sem fluxo de indicação de condutor.
export default async function SinistrosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase Auditoria-Paginacao (17/08/2026, risco médio) — mesmo achado de
  // /multas: cap fixo de 200 alimentava também os indicadores do topo
  // (com vítima, custo total). Busca em lotes de 1.000 até esgotar.
  const LOTE_SINISTROS = 1000;
  let sinistrosRaw: Sinistro[] = [];
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      const { data: lote } = await supabase
        .from("sinistros_veiculos")
        .select("id, placa, motorista_nome, data_sinistro, tipo, gravidade, houve_vitima, custo_estimado, local_ocorrencia")
        .eq("empresa_id", empresaSelecionada)
        .order("data_sinistro", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_SINISTROS - 1);
      const linhas = lote ?? [];
      if (linhas.length === 0) break;
      sinistrosRaw.push(...linhas);
      if (linhas.length < LOTE_SINISTROS) break;
      offsetBusca += LOTE_SINISTROS;
    }
  }

  const termoBusca = (q ?? "").trim().toLowerCase();
  const sinistros = termoBusca
    ? sinistrosRaw.filter(
        (s) =>
          s.placa?.toLowerCase().includes(termoBusca) ||
          s.tipo?.toLowerCase().includes(termoBusca) ||
          s.motorista_nome?.toLowerCase().includes(termoBusca) ||
          s.local_ocorrencia?.toLowerCase().includes(termoBusca)
      )
    : sinistrosRaw;

  const comVitima = sinistrosRaw.filter((s) => s.houve_vitima).length;
  const custoTotal = sinistrosRaw.reduce((sum, s) => sum + (s.custo_estimado ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sinistros e Acidentes</h1>
          <p className="mt-1 text-sm text-slate-500">Registro de sinistros por veículo, usado no índice de sinistralidade.</p>
        </div>
        {empresaSelecionada && (
          <Link href={`/sinistros/nova?empresa=${empresaSelecionada}`} className="btn-primary text-sm">
            + Novo Sinistro
          </Link>
        )}
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Placa, tipo, motorista ou local..."
            className="input text-sm"
          />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver os sinistros da frota dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={ClipboardList} label="Total no período" valor={String(sinistrosRaw.length)} />
            <IndicadorColorido
              cor={comVitima > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Com vítima"
              valor={String(comVitima)}
            />
            <IndicadorColorido
              cor="amber"
              icon={Wallet}
              label="Custo estimado total"
              valor={custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Gravidade</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Vítima</th>
                  <th className="px-4 py-3">Custo estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sinistros.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 text-slate-600">{new Date(`${s.data_sinistro}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.placa}</td>
                    <td className="px-4 py-3 text-slate-600">{s.tipo}</td>
                    <td className="px-4 py-3">
                      {s.gravidade ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRAVIDADE_COR[s.gravidade] ?? "bg-slate-100 text-slate-600"}`}>
                          {s.gravidade}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.motorista_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{s.local_ocorrencia ?? "—"}</td>
                    <td className="px-4 py-3">{s.houve_vitima ? "Sim" : "Não"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {s.custo_estimado ? s.custo_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                    </td>
                  </tr>
                ))}
                {sinistros.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum sinistro registrado para esse filtro.
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
