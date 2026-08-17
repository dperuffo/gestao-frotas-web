import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { formatDate } from "@/lib/utils";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, AlertTriangle, HelpCircle } from "lucide-react";

type SearchParams = { empresa?: string; busca?: string };

// Fase Indicadores-da-Frota — Checklist de Inspeção (30/07/2026). Lista de
// veículos com a última inspeção e pendências abertas (itens não conformes
// ainda não resolvidos), mesmo espírito de /manutencao-preditiva mas sem
// score — aqui é binário: tem pendência aberta ou não.
export default async function ChecklistVeiculosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, busca } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase Reuso-Operacional-Grupo (Fase 2) — checklist_veiculos_resumo não
  // tem paginação nem lógica pesada (diferente da Manutenção Preditiva), então
  // dá pra reaproveitar o mesmo truque de Fase 1: chama a RPC uma vez por
  // empresa do grupo e junta no JS, rotulando os veículos "emprestados".
  type VeiculoChecklist = {
    placa: string;
    marca: string | null;
    modelo: string | null;
    centro_custo_nome: string | null;
    ultima_inspecao: string | null;
    pendencias_abertas: number;
  };

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: checklist_veiculos_resumo
  // devolve 1 linha por veículo, chamada sem `.range()` (uma vez pra empresa
  // própria, mais uma vez por empresa "irmã" do grupo) — sujeita ao corte
  // padrão de 1.000 linhas do PostgREST em frotas grandes (mesmo bug já
  // corrigido em /veiculos, Fase 27.38). Busca em lotes de 1.000 por
  // empresa, mantendo o paralelismo entre empresas do grupo.
  const LOTE_CHECKLIST = 1000;
  async function buscarChecklistCompleto(empresaId: string): Promise<{ data: VeiculoChecklist[]; error: { message: string } | null }> {
    const todos: VeiculoChecklist[] = [];
    let offsetBusca = 0;
    for (;;) {
      const { data: lote, error: erroLote } = await supabase
        .rpc("checklist_veiculos_resumo", { p_empresa_id: empresaId, p_busca: busca || null })
        .range(offsetBusca, offsetBusca + LOTE_CHECKLIST - 1);
      if (erroLote) return { data: todos, error: erroLote };
      if (!lote || lote.length === 0) break;
      todos.push(...lote);
      if (lote.length < LOTE_CHECKLIST) break;
      offsetBusca += LOTE_CHECKLIST;
    }
    return { data: todos, error: null };
  }

  let veiculosProprios: VeiculoChecklist[] | null = null;
  let error: { message: string } | null = null;
  let listaGrupo: (VeiculoChecklist & { empresaNome: string })[] = [];

  if (empresaSelecionada) {
    const irmas = await empresasIrmasAcao(supabase, empresaSelecionada);
    const [resultadoProprio, resultadosGrupo] = await Promise.all([
      buscarChecklistCompleto(empresaSelecionada),
      Promise.all(irmas.map((e) => buscarChecklistCompleto(e.id))),
    ]);
    veiculosProprios = resultadoProprio.data;
    error = resultadoProprio.error;
    listaGrupo = resultadosGrupo.flatMap((r, i) => r.data.map((v) => ({ ...v, empresaNome: irmas[i].nome })));
  }

  const lista = [...(veiculosProprios ?? []).map((v) => ({ ...v, empresaNome: undefined as string | undefined })), ...listaGrupo];
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
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Truck} label="Veículos" valor={String(lista.length)} />
            <IndicadorColorido
              cor={comPendencia > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Com pendência aberta"
              valor={String(comPendencia)}
            />
            <IndicadorColorido cor="amber" icon={HelpCircle} label="Nunca inspecionados" valor={String(nuncaInspecionados)} />
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
                  <tr key={v.placa} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/checklist-veiculos/${v.placa}`} className="font-medium text-frota-600 hover:underline">
                        {v.placa}
                      </Link>
                      {v.empresaNome && <span className="ml-2 text-xs text-slate-400">({v.empresaNome})</span>}
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
