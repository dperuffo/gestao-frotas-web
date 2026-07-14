import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarCiclosAbertos } from "@/lib/ciclosAbertos";
import { formatCNPJ } from "@/lib/utils";
import {
  CicloAbastecimentoPagamento,
  type NegociacaoDoCliente,
  type FaturaDoCliente,
} from "@/app/(dashboard)/clientes/_components/CicloAbastecimentoPagamento";

type SearchParams = { empresa?: string };

// Fase 27.72 — detalhe de UM cliente na visão do posto: cadastro (via
// clientes_do_posto, mesma RPC da listagem — já garante que o posto só
// enxerga clientes com quem tem negociação real) + o mesmo componente de
// ciclo de abastecimento/pagamento usado no lado admin (Fase 27.71), só que
// aqui filtrado pra UM posto só (o do usuário logado) e UM cliente só (o da
// URL) — reaproveita o componente sem precisar duplicar a tabela de
// negociações/faturas.
export default async function ClientePostoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { clienteId } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase 27.111 — pedido do Daniel: "Verificar acesso de usuario Posto Teste
  // 2". Causa raiz: com 2+ empresas vinculadas (ex.: posto que faz parte de
  // uma Rede de Postos), resolverEmpresaAtual devolve empresaSelecionada
  // null até o usuário escolher uma — mas esta página só tinha a mensagem
  // de erro, sem seletor, virando um beco sem saída. Rede corrigida em
  // clientes-posto/page.tsx (link agora carrega ?empresa=), mas mantém este
  // seletor aqui como rede de segurança pra qualquer acesso direto/sem param.
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

  const { data: clientesData } = await supabase.rpc("clientes_do_posto", {
    p_empresa_posto_id: empresaSelecionada,
  });
  const cliente = (clientesData ?? []).find((c) => c.id === clienteId);

  if (!cliente) notFound();

  const [{ data: negociacoesData }, { data: faturasData }, { data: clienteEmpresa }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select(
        "id, empresa_posto_id, posto_nome, status, combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario"
      )
      .eq("empresa_posto_id", empresaSelecionada)
      .eq("empresa_cliente_id", clienteId)
      .order("atualizado_em", { ascending: false }),
    supabase
      .from("faturas_postos")
      .select("id, empresa_posto_id, periodo_inicio, periodo_fim, vencimento, valor_total, status")
      .eq("empresa_posto_id", empresaSelecionada)
      .eq("empresa_cliente_id", clienteId)
      .order("vencimento", { ascending: false })
      .limit(200),
    // Fase 27.108 — ciclo/prazo agora é atributo do cliente (empresas), não
    // mais de cada negociação; `clientes_do_posto` (RPC acima) não devolve
    // esses campos, então busca à parte, direto na empresa.
    supabase.from("empresas").select("ciclo_faturamento_dias").eq("id", clienteId).maybeSingle(),
  ]);

  const negociacoesBrutas = negociacoesData ?? [];
  const nomePorPostoId = new Map(negociacoesBrutas.map((n) => [n.empresa_posto_id, n.posto_nome]));

  const negociacoes: NegociacaoDoCliente[] = negociacoesBrutas;
  const faturas: FaturaDoCliente[] = (faturasData ?? []).map((f) => ({
    ...f,
    posto_nome: nomePorPostoId.get(f.empresa_posto_id) ?? null,
  }));

  // Fase 27.84 — pedido do Daniel: o ciclo ATUAL (ainda não fechado pelo
  // robô) não aparecia em nenhuma tela, só depois de fechado.
  const todosCiclosAbertos = await buscarCiclosAbertos(supabase);
  const ciclosAbertos = todosCiclosAbertos.filter(
    (c) => c.empresa_posto_id === empresaSelecionada && c.empresa_cliente_id === clienteId
  );

  return (
    <div>
      <Link href="/clientes-posto" className="text-sm text-frota-600 hover:underline">
        ← Voltar para Clientes
      </Link>

      <div className="mt-3 mb-6 card p-6">
        <h1 className="text-xl font-semibold text-slate-900">{cliente.nome}</h1>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
          <p>CNPJ: {formatCNPJ(cliente.cnpj)}</p>
          <p>Cidade/UF: {cliente.municipio ? `${cliente.municipio}/${cliente.uf ?? ""}` : "—"}</p>
          <p>Segmento: {cliente.segmento_transporte ?? "—"}</p>
          <p>Porte: {cliente.porte ?? "—"}</p>
          {cliente.telefone_contato && <p>Telefone: {cliente.telefone_contato}</p>}
          {cliente.email_contato && <p>E-mail: {cliente.email_contato}</p>}
        </div>
      </div>

      <CicloAbastecimentoPagamento
        empresaClienteId={clienteId}
        cicloFaturamentoDias={clienteEmpresa?.ciclo_faturamento_dias ?? 30}
        negociacoes={negociacoes}
        faturas={faturas}
        ciclosAbertos={ciclosAbertos}
        rotuloCiclos="posto"
        podeGerenciarFaturas
      />
    </div>
  );
}
