import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { STATUS_NEGOCIACAO, STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";
import { formatarDataBr } from "@/lib/utils";

type SearchParams = { empresa?: string; status?: string };

// Fase 27.50 — Negociação com Postos Revendedores. Uma única tela serve os
// dois lados (cliente de frota e posto revendedor): o que muda é o "papel"
// de quem está olhando, derivado do segmento da empresa selecionada
// (Frota = cliente, Revenda = posto) — não do perfil do usuário, pra
// funcionar também pro admin trocando de empresa no seletor.
export default async function NegociacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, status } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  const souPosto = segmentoSelecionado === "Revenda";

  let negociacoes: {
    id: string;
    posto_cnpj: string;
    status: string;
    rodada_atual: number;
    criado_em: string;
    atualizado_em: string;
    cliente_nome: string | null;
    posto_nome: string | null;
  }[] = [];
  let erro: string | undefined;

  if (empresaSelecionada) {
    // Fase 27.51 — achado real: o nome da CONTRAPARTE (cliente, do ponto de
    // vista do posto, ou vice-versa) vinha de um join do PostgREST pra
    // empresas, que respeita a RLS daquela tabela — e um usuário só enxerga
    // empresas das quais é membro. Isso deixava o nome sempre em branco pro
    // lado de fora da negociação. Corrigido lendo direto as colunas
    // denormalizadas cliente_nome/posto_nome (ver src/lib/negociacoesPostos.ts).
    let query = supabase
      .from("negociacoes_postos")
      .select("id, posto_cnpj, status, rodada_atual, criado_em, atualizado_em, cliente_nome, posto_nome")
      .order("atualizado_em", { ascending: false })
      .limit(500);

    query = souPosto ? query.eq("empresa_posto_id", empresaSelecionada) : query.eq("empresa_cliente_id", empresaSelecionada);

    if (status && (STATUS_NEGOCIACAO as readonly string[]).includes(status)) {
      query = query.eq("status", status as StatusNegociacao);
    }

    const resultado = await query;
    if (resultado.error) erro = resultado.error.message;
    negociacoes = (resultado.data ?? []) as typeof negociacoes;
  }

  const pendentesDoMeuLado = negociacoes.filter(
    (n) => n.status === (souPosto ? "pendente_posto" : "pendente_cliente")
  ).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {souPosto ? "Negociação com Clientes" : "Negociação com Postos Revendedores"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {souPosto
              ? "Propostas de fornecimento de combustível trocadas com seus clientes: vigência, volume mínimo e preço por litro."
              : "Vigência, combustível, volume mínimo e preço por litro negociados com os postos parceiros."}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/negociacoes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Nova negociação
          </Link>
        )}
      </div>

      {empresas.length > 1 && (
        <form className="mb-6 flex items-end gap-2">
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
            Aplicar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Negociações" valor={negociacoes.length} />
            <Indicador label={`Aguardando ${souPosto ? "você" : "sua resposta"}`} valor={pendentesDoMeuLado} />
            <Indicador label="Aceitas" valor={negociacoes.filter((n) => n.status === "aceita").length} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={`/negociacoes?empresa=${empresaSelecionada}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Todos
            </Link>
            {STATUS_NEGOCIACAO.map((s) => (
              <Link
                key={s}
                href={`/negociacoes?empresa=${empresaSelecionada}&status=${s}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {STATUS_NEGOCIACAO_LABEL[s]}
              </Link>
            ))}
          </div>

          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar negociações: {erro}</p>}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{souPosto ? "Cliente" : "Posto"}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rodada</th>
                  <th className="px-4 py-3">Atualizado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {negociacoes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {souPosto ? (n.cliente_nome ?? "—") : (n.posto_nome ?? n.posto_cnpj)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STATUS_NEGOCIACAO_LABEL[n.status as StatusNegociacao] ?? n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">#{n.rodada_atual}</td>
                    <td className="px-4 py-3 text-slate-500">{formatarDataBr(n.atualizado_em.slice(0, 10))}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
                {negociacoes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma negociação encontrada.
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

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}
