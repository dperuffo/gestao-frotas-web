import Link from "next/link";
import { Users, AlertTriangle, TrendingDown, Ban } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

type SearchParams = { empresa?: string };

const STATUS_LABEL: Record<string, string> = {
  em_dia: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
  sem_historico: "Sem histórico",
  nunca_abasteceu: "Nunca abasteceu aqui",
};

const STATUS_CLASSE: Record<string, string> = {
  em_dia: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  critico: "bg-red-100 text-red-700",
  sem_historico: "bg-slate-100 text-slate-600",
  nunca_abasteceu: "bg-slate-100 text-slate-600",
};

// Fase Inteligência-Comercial-Posto (09/09/2026, pedido do Daniel: "desenhar a
// tela de devolutiva para o posto" a partir da discussão sobre o programa de
// fidelidade como ferramenta de inteligência comercial, não só promoção).
// Devolve pro posto, em cima do próprio histórico de abastecimento, o mesmo
// tipo de sinal que hoje só existe do lado da frota (Ações Sugeridas,
// Insights de IA) — "quais clientes pararam de abastecer aqui" é a primeira
// pergunta respondida.
//
// Vem da RPC `clientes_em_risco_churn` (SECURITY DEFINER com guarda manual,
// mesmo padrão de `clientes_do_posto`): cruza `negociacoes_postos` (quem é
// cliente do posto) com o histórico real em `abastecimentos_unificado`,
// calcula o intervalo médio histórico de cada cliente e classifica quem está
// atrasado em relação ao próprio padrão (decisão confirmada pelo Daniel:
// atenção a partir de 1,5x o intervalo médio do cliente, crítico a partir de
// 2,5x).
export default async function InteligenciaComercialPostoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return <div className="card p-6 text-sm text-slate-600">Esta tela é exclusiva para postos revendedores.</div>;
  }

  const { data: clientesData, error } = empresaSelecionada
    ? await supabase.rpc("clientes_em_risco_churn", { p_empresa_posto_id: empresaSelecionada })
    : { data: null, error: null };

  const clientes = clientesData ?? [];

  const emDia = clientes.filter((c) => c.status === "em_dia").length;
  const emRisco = clientes.filter((c) => c.status === "atencao" || c.status === "critico").length;
  const criticos = clientes.filter((c) => c.status === "critico").length;
  const nuncaAbasteceram = clientes.filter((c) => c.status === "nunca_abasteceu").length;

  return (
    <div>
      <CabecalhoPagina
        titulo="Inteligência Comercial"
        descricao={`Sinais do seu próprio histórico de abastecimento, organizados pra ação comercial${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar clientes: {error.message}</p>}

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <IndicadorColorido label="Clientes em dia" valor={String(emDia)} icon={Users} cor="green" />
            <IndicadorColorido label="Clientes em risco" valor={String(emRisco)} icon={AlertTriangle} cor="amber" />
            <IndicadorColorido label="Críticos (2,5x+ atraso)" valor={String(criticos)} icon={TrendingDown} cor="red" />
            <IndicadorColorido label="Nunca abasteceram aqui" valor={String(nuncaAbasteceram)} icon={Ban} cor="violet" />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Última compra</th>
                  <th className="px-4 py-3">Intervalo médio</th>
                  <th className="px-4 py-3">Atraso</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map((c) => (
                  <tr key={c.empresa_cliente_id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{c.municipio ? `${c.municipio}/${c.uf ?? ""}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.ultima_compra
                        ? `${new Date(c.ultima_compra).toLocaleDateString("pt-BR")} (${c.dias_desde_ultima_compra}d)`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.intervalo_medio_dias != null ? `${c.intervalo_medio_dias} dias` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.razao_atraso != null ? `${c.razao_atraso}x` : "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASSE[c.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/clientes-posto/${c.empresa_cliente_id}?empresa=${empresaSelecionada}`}
                        className="text-frota-600 hover:underline"
                      >
                        Ver cliente
                      </Link>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhum cliente negociou com este posto ainda. Cadastro dos clientes fica em{" "}
                      <Link href="/clientes-posto" className="text-frota-600 hover:underline">
                        Clientes
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Status calculado a partir do intervalo médio histórico de cada cliente com este posto — atenção a partir
            de 1,5x o próprio intervalo, crítico a partir de 2,5x.
          </p>
        </>
      )}
    </div>
  );
}
