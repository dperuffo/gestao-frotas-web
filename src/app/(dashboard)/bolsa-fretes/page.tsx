import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovaCapacidadeForm } from "./_components/NovaCapacidadeForm";
import { AcoesCapacidade } from "./_components/AcoesCapacidade";
import { Truck, MapPin } from "lucide-react";

// Fase Bolsa-Fretes-Grupo (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Bolsa de fretes / marketplace de retorno").
// Escopo confirmado com o Daniel via pergunta direta: NÃO é cross-tenant
// entre clientes diferentes — só entre empresas do MESMO Grupo Econômico
// (ver comentário grande na migration bolsa_fretes_grupo_economico). Sem
// negociação/contato nesta v1: só cruza "minha capacidade ociosa" com
// "fretes disponíveis do grupo" pra reduzir viagem vazia na volta — quem
// quiser fechar negócio ainda combina por fora, como já fazem hoje.
export default async function BolsaFretesPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let minhaCapacidade: {
    id: string;
    placa: string | null;
    tipo_veiculo: string | null;
    origem_cidade: string;
    origem_uf: string;
    destino_pretendido: string | null;
    disponivel_a_partir: string;
    capacidade_kg: number | null;
    status: string;
  }[] = [];
  let fretesDoGrupo: {
    frete_id: string;
    empresa_nome: string;
    titulo: string;
    origem_cidade: string | null;
    origem_uf: string | null;
    destino_cidade: string | null;
    destino_uf: string | null;
    tipo_carga: string | null;
    peso_carga_kg: number | null;
    km_estimado: number | null;
    data_saida_prevista: string | null;
    prazo_entrega: string | null;
  }[] = [];

  if (!semClienteEscolhido && empresaSelecionada) {
    const [{ data: capacidade }, { data: fretes }] = await Promise.all([
      supabase
        .from("capacidade_ociosa_frota")
        .select("id, placa, tipo_veiculo, origem_cidade, origem_uf, destino_pretendido, disponivel_a_partir, capacidade_kg, status")
        .eq("empresa_id", empresaSelecionada)
        .order("disponivel_a_partir"),
      supabase.rpc("bolsa_fretes_grupo", { p_empresa_id: empresaSelecionada }),
    ]);
    minhaCapacidade = capacidade ?? [];
    fretesDoGrupo = fretes ?? [];
  }

  const ufsComCapacidadeAtiva = new Set(
    minhaCapacidade.filter((c) => c.status === "ativo").map((c) => c.origem_uf)
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bolsa de Fretes do Grupo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cruze sua capacidade ociosa com fretes disponíveis de outras empresas do seu Grupo Econômico
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
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
          Selecione um cliente acima pra ver a bolsa de fretes do grupo econômico dele.
        </p>
      ) : (
        <>
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Truck className="h-4 w-4 text-slate-400" /> Minha capacidade ociosa
              </h2>
              <NovaCapacidadeForm empresaId={empresaSelecionada} />
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Destino pretendido</th>
                    <th className="px-4 py-3">Disponível a partir de</th>
                    <th className="px-4 py-3">Capacidade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {minhaCapacidade.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.placa ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.origem_cidade}/{c.origem_uf}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.destino_pretendido ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(`${c.disponivel_a_partir}T00:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.capacidade_kg != null ? `${c.capacidade_kg.toLocaleString("pt-BR")} kg` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.status === "ativo" ? "badge-ativo" : c.status === "cancelada" ? "badge-inativo" : "badge-atencao"
                          }
                        >
                          {c.status === "ativo" ? "Ativo" : c.status === "utilizada" ? "Utilizada" : "Cancelada"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AcoesCapacidade id={c.id} status={c.status} />
                      </td>
                    </tr>
                  ))}
                  {minhaCapacidade.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Nenhuma capacidade ociosa declarada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-slate-400" /> Fretes disponíveis no grupo
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Fretes com status &quot;disponível&quot; postados por outras empresas do mesmo Grupo Econômico. Linhas destacadas
              batem com a UF de origem de alguma capacidade ociosa ativa sua.
            </p>

            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Frete</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3">Carga</th>
                    <th className="px-4 py-3">Saída prevista</th>
                    <th className="px-4 py-3">Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fretesDoGrupo.map((f) => {
                    const compativel = f.origem_uf != null && ufsComCapacidadeAtiva.has(f.origem_uf);
                    return (
                      <tr key={f.frete_id} className={compativel ? "bg-frota-50" : undefined}>
                        <td className="px-4 py-3 text-slate-600">{f.empresa_nome}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {f.titulo}
                          {compativel && (
                            <span className="ml-2 rounded-full bg-frota-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-frota-700">
                              Compatível
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {[f.origem_cidade, f.origem_uf].filter(Boolean).join("/") || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {[f.destino_cidade, f.destino_uf].filter(Boolean).join("/") || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.tipo_carga ?? "—"}
                          {f.peso_carga_kg != null ? ` · ${f.peso_carga_kg.toLocaleString("pt-BR")} kg` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.data_saida_prevista ? new Date(`${f.data_saida_prevista}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.prazo_entrega ? new Date(`${f.prazo_entrega}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {fretesDoGrupo.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Nenhum frete disponível nas outras empresas do grupo agora, ou esta empresa não pertence a um Grupo
                        Econômico.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
