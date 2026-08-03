import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  formatarCnpjCpf,
  TIPO_INTERACAO_LABEL,
  STATUS_PROPOSTA_LABEL,
  STATUS_PROPOSTA_COR,
} from "@/lib/crm";
import { ClienteForm } from "../_components/ClienteForm";
import { InteracaoForm } from "../_components/InteracaoForm";
import { BotaoExcluirInteracao } from "../_components/BotaoExcluirInteracao";

export default async function ClienteCrmDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("cadastros_parceiros")
    .select(
      "id, empresa_id, cnpj_cpf, razao_social, ie, endereco_logradouro, endereco_numero, endereco_bairro, endereco_municipio, endereco_uf, endereco_cep, telefone, email"
    )
    .eq("id", id)
    .eq("papel", "tomador")
    .maybeSingle();

  if (!cliente) notFound();

  const empresaId = empresaParam ?? cliente.empresa_id;

  type CotacaoLinha = { id: string; origem_label: string; destino_label: string; valor_total: number; status: string; criado_em: string; frete_id: string | null };
  type InteracaoLinha = { id: string; tipo: string; descricao: string; proxima_acao_data: string | null; criado_por: string | null; criado_em: string };

  const [{ data: cotacoesRaw }, { data: interacoesRaw }] = await Promise.all([
    supabase
      .from("cotacoes")
      .select("id, origem_label, destino_label, valor_total, status, criado_em, frete_id")
      .eq("cliente_tomador_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("clientes_interacoes")
      .select("id, tipo, descricao, proxima_acao_data, criado_por, criado_em")
      .eq("cliente_id", id)
      .order("criado_em", { ascending: false }),
  ]);

  const cotacoes = (cotacoesRaw ?? []) as CotacaoLinha[];
  const interacoes = (interacoesRaw ?? []) as InteracaoLinha[];

  const freteIds = cotacoes.filter((c) => c.status === "convertida" && c.frete_id).map((c) => c.frete_id as string);
  type FreteLinha = { id: string; titulo: string; status: string; valor_oferecido: number; criado_em: string };
  let fretes: FreteLinha[] = [];
  if (freteIds.length > 0) {
    const { data: fretesRaw } = await supabase.from("fretes").select("id, titulo, status, valor_oferecido, criado_em").in("id", freteIds);
    fretes = fretesRaw ?? [];
  }

  const totalGanho = cotacoes.filter((c) => c.status === "convertida").reduce((s, c) => s + c.valor_total, 0);
  const totalAberto = cotacoes.filter((c) => c.status === "simulada").reduce((s, c) => s + c.valor_total, 0);

  const valoresIniciais = {
    cnpjCpf: cliente.cnpj_cpf,
    razaoSocial: cliente.razao_social,
    ie: cliente.ie,
    enderecoLogradouro: cliente.endereco_logradouro,
    enderecoNumero: cliente.endereco_numero,
    enderecoBairro: cliente.endereco_bairro,
    enderecoMunicipio: cliente.endereco_municipio,
    enderecoUf: cliente.endereco_uf,
    enderecoCep: cliente.endereco_cep,
    telefone: cliente.telefone,
    email: cliente.email,
  };

  return (
    <div>
      <div className="mb-6">
        <Link href={`/crm-comercial?empresa=${empresaId}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <div className="mt-2">
          <h1 className="text-xl font-semibold text-slate-900">{cliente.razao_social}</h1>
          <p className="text-sm text-slate-500">{formatarCnpjCpf(cliente.cnpj_cpf)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Funil de propostas</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Em aberto</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-800">{formatarMoeda(totalAberto)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Ganho (total)</dt>
                <dd className="mt-0.5 text-lg font-semibold text-green-700">{formatarMoeda(totalGanho)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Propostas</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-800">{cotacoes.length}</dd>
              </div>
            </div>
            {cotacoes.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Rota</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotacoes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3">
                        <Link href={`/cotacoes/${c.id}?empresa=${empresaId}`} className="text-frota-600 hover:underline">
                          {c.origem_label} → {c.destino_label}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{formatarMoeda(c.valor_total)}</td>
                      <td className="py-2 pr-3">
                        <span className={STATUS_PROPOSTA_COR[c.status] ?? "badge-inativo"}>{STATUS_PROPOSTA_LABEL[c.status] ?? c.status}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{formatarData(c.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400">
                Nenhuma proposta ainda. Simule uma em{" "}
                <Link href={`/cotacoes/novo?empresa=${empresaId}`} className="font-medium text-frota-600 hover:underline">
                  Cotações
                </Link>
                .
              </p>
            )}
          </div>

          {fretes.length > 0 && (
            <div className="card space-y-2 p-6">
              <h2 className="text-sm font-semibold text-slate-700">Fretes realizados</h2>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Frete</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fretes.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2 pr-3">
                        <Link href={`/fretes/${f.id}?empresa=${empresaId}`} className="text-frota-600 hover:underline">
                          {f.titulo}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{formatarMoeda(f.valor_oferecido)}</td>
                      <td className="py-2 pr-3 text-slate-600">{f.status}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatarData(f.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Histórico de relacionamento</h2>
            <InteracaoForm clienteId={cliente.id} empresaId={empresaId} />
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {interacoes.length === 0 && <p className="text-sm text-slate-400">Nenhuma interação registrada ainda.</p>}
              {interacoes.map((i) => (
                <div key={i.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{TIPO_INTERACAO_LABEL[i.tipo] ?? i.tipo}</span>
                    <span className="text-xs text-slate-400">{formatarDataHora(i.criado_em)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{i.descricao}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {i.criado_por ?? "—"}
                      {i.proxima_acao_data && <span className="ml-2 font-medium text-amber-700">Próxima ação: {formatarData(i.proxima_acao_data)}</span>}
                    </span>
                    <BotaoExcluirInteracao interacaoId={i.id} clienteId={cliente.id} empresaId={empresaId} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Dados cadastrais</h2>
            <ClienteForm empresaId={empresaId} modo="editar" clienteId={cliente.id} valoresIniciais={valoresIniciais} />
          </div>
        </div>
      </div>
    </div>
  );
}
