import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";

type SearchParams = { empresa?: string; busca?: string };

// Fase Indicadores-da-Frota — Checklist de Inspeção (30/07/2026). Lista de
// veículos com a última inspeção e pendências abertas (itens não conformes
// ainda não resolvidos), mesmo espírito de /manutencao-preditiva mas sem
// score — aqui é binário: tem pendência aberta ou não.
export default async function ChecklistVeiculosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, busca } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: veiculos, error } = empresaSelecionada
    ? await supabase.rpc("checklist_veiculos_resumo", { p_empresa_id: empresaSelecionada, p_busca: busca || null })
    : { data: null, error: null };

  const lista = veiculos ?? [];
  const comPendencia = lista.filter((v) => v.pendencias_abertas > 0).length;
  const nuncaInspecionados = lista.filter((v) => !v.ultima_inspecao).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Checklist de Inspeção Veicular</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro de inspeções periódicas (pneus, freios, luzes, documentação e outros itens de segurança), com
          histórico de não conformidades e tempo de resolução.
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Placa, marca ou modelo..."
            className="input text-sm"
          />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o checklist da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Indicador label="Veículos" valor={String(lista.length)} />
            <Indicador label="Com pendência aberta" valor={String(comPendencia)} destaque={comPendencia > 0} />
            <Indicador label="Nunca inspecionados" valor={String(nuncaInspecionados)} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Centro de custo</th>
                  <th className="px-4 py-3">Última inspeção</th>
                  <th className="px-4 py-3">Pendências</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((v) => (
                  <tr key={v.placa} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/checklist-veiculos/${v.placa}`} className="font-medium text-frota-600 hover:underline">
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.centro_custo_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.ultima_inspecao ? formatDate(v.ultima_inspecao) : "Nunca inspecionado"}
                    </td>
                    <td className="px-4 py-3">
                      {v.pendencias_abertas > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {v.pendencias_abertas} pendente(s)
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum veículo encontrado.
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

function Indicador({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`card p-4 ${destaque ? "border-red-200 bg-red-50/50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-red-700" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}
