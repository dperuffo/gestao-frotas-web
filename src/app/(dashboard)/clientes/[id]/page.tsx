import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "../_components/ClienteForm";
import {
  CicloAbastecimentoPagamento,
  type NegociacaoDoCliente,
  type FaturaDoCliente,
} from "../_components/CicloAbastecimentoPagamento";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("empresas").select("*").eq("id", id).single();

  if (!cliente) notFound();

  // Fase 27.42 — o checkbox de bypass de limite de frota só aparece pro
  // admin (mesma checagem que já protege o gravado no servidor, em
  // atualizarCliente).
  const { data: perfilAtual } = await supabase.rpc("perfil_usuario_atual");
  const souAdmin = perfilAtual === "admin";

  // Fase 27.71 — pedido do Daniel: resumo consolidado do ciclo de
  // abastecimento + pagamento deste cliente, cruzando TODOS os postos com
  // quem ele já negociou (não só um posto por vez, como em /negociacoes ou
  // /financeiro-posto). negociacoes_postos já tem posto_nome denormalizado;
  // faturas_postos NÃO tem (só cliente_nome) — em vez de arriscar um join
  // cross-tenant em `empresas` (mesmo problema de RLS da Fase 27.68), o
  // nome do posto de cada fatura é resolvido a partir do mapa
  // empresa_posto_id -> posto_nome já construído com as negociações (toda
  // fatura vem de uma negociação, então o posto sempre aparece lá também).
  const [{ data: negociacoesData }, { data: faturasData }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select(
        "id, empresa_posto_id, posto_nome, status, combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario"
      )
      .eq("empresa_cliente_id", id)
      .order("atualizado_em", { ascending: false }),
    supabase
      .from("faturas_postos")
      .select("id, empresa_posto_id, periodo_inicio, periodo_fim, vencimento, valor_total, status")
      .eq("empresa_cliente_id", id)
      .order("vencimento", { ascending: false })
      .limit(200),
  ]);

  const negociacoesBrutas = negociacoesData ?? [];
  const nomePorPostoId = new Map(negociacoesBrutas.map((n) => [n.empresa_posto_id, n.posto_nome]));

  const negociacoes: NegociacaoDoCliente[] = negociacoesBrutas;
  const faturas: FaturaDoCliente[] = (faturasData ?? []).map((f) => ({
    ...f,
    posto_nome: nomePorPostoId.get(f.empresa_posto_id) ?? null,
  }));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Cliente — {cliente.nome}</h1>
      <ClienteForm cliente={cliente} souAdmin={souAdmin} />
      <CicloAbastecimentoPagamento negociacoes={negociacoes} faturas={faturas} />
    </div>
  );
}
