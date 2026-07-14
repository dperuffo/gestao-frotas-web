import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarCiclosAbertos } from "@/lib/ciclosAbertos";
import {
  CicloAbastecimentoPagamento,
  type NegociacaoDoCliente,
  type FaturaDoCliente,
} from "@/app/(dashboard)/clientes/_components/CicloAbastecimentoPagamento";

type SearchParams = { empresa?: string };

// Fase 27.85 — pedido do Daniel: "um posto pode ter muitos ciclos... com
// muitos clientes" — a visão agrupada por contraparte (VisaoCiclosPorContraparte)
// trocou a lista plana de faturas por 1 linha por posto/cliente, com um
// link "Ver histórico" pro drill-down completo. Do lado do POSTO esse
// drill-down já existia (/clientes-posto/[clienteId], Fase 27.72). Esta
// página é o espelho do lado do CLIENTE — histórico completo (negociações
// + faturas + ciclo em andamento) com UM posto específico, reaproveitando
// o mesmo componente CicloAbastecimentoPagamento.
export default async function MeuPostoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ postoId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { postoId } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase 27.111 — mesma rede de segurança aplicada em clientes-posto/[clienteId]:
  // com 2+ empresas vinculadas, mostra seletor em vez de beco sem saída.
  if (!empresaSelecionada) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        {empresas.length > 1 ? (
          <form className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
              <select name="empresa" defaultValue="" className="input text-sm">
                <option value="">Selecione...</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary text-sm">
              Aplicar
            </button>
          </form>
        ) : (
          "Nenhuma empresa vinculada ao seu usuário."
        )}
      </div>
    );
  }

  const [{ data: negociacoesData }, { data: faturasData }, { data: clienteEmpresa }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select(
        "id, empresa_posto_id, posto_nome, status, combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario"
      )
      .eq("empresa_cliente_id", empresaSelecionada)
      .eq("empresa_posto_id", postoId)
      .order("atualizado_em", { ascending: false }),
    supabase
      .from("faturas_postos")
      .select("id, empresa_posto_id, periodo_inicio, periodo_fim, vencimento, valor_total, status")
      .eq("empresa_cliente_id", empresaSelecionada)
      .eq("empresa_posto_id", postoId)
      .order("vencimento", { ascending: false })
      .limit(200),
    // Fase 27.108 — ciclo/prazo agora é atributo do cliente (empresas), não
    // mais de cada negociação.
    supabase
      .from("empresas")
      .select("ciclo_faturamento_dias")
      .eq("id", empresaSelecionada)
      .maybeSingle(),
  ]);

  const negociacoesBrutas = negociacoesData ?? [];
  const faturasBrutas = faturasData ?? [];
  if (negociacoesBrutas.length === 0 && faturasBrutas.length === 0) notFound();

  const postoNome = negociacoesBrutas[0]?.posto_nome ?? "Posto";

  const negociacoes: NegociacaoDoCliente[] = negociacoesBrutas;
  const faturas: FaturaDoCliente[] = faturasBrutas.map((f) => ({ ...f, posto_nome: postoNome }));

  // Fase 27.84 — ciclo ATUAL (ainda não fechado pelo robô).
  const todosCiclosAbertos = await buscarCiclosAbertos(supabase);
  const ciclosAbertos = todosCiclosAbertos.filter(
    (c) => c.empresa_cliente_id === empresaSelecionada && c.empresa_posto_id === postoId
  );

  return (
    <div>
      <Link href="/financeiro" className="text-sm text-frota-600 hover:underline">
        ← Voltar para o Painel Financeiro
      </Link>

      <h1 className="mt-3 mb-6 text-xl font-semibold text-slate-900">{postoNome}</h1>

      <CicloAbastecimentoPagamento
        empresaClienteId={empresaSelecionada}
        cicloFaturamentoDias={clienteEmpresa?.ciclo_faturamento_dias ?? 30}
        negociacoes={negociacoes}
        faturas={faturas}
        ciclosAbertos={ciclosAbertos}
        rotuloCiclos="cliente"
      />
    </div>
  );
}
