import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatCNPJ } from "@/lib/utils";
import { STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";

type SearchParams = { empresa?: string };

// Fase 27.72 — pedido do Daniel: aba própria "Clientes" no menu do posto,
// pra ele ver o cadastro de TODOS os clientes que já negociaram (qualquer
// status — aceita, recusada, cancelada, pendente), com o ciclo de
// abastecimento/pagamento de cada um (ver /clientes-posto/[clienteId]).
//
// A lista vem da RPC `clientes_do_posto` (SECURITY DEFINER) em vez de uma
// consulta direta em `empresas`: RLS de `empresas` bloqueia SELECT
// cross-tenant pra quem não é membro da empresa (mesmo problema já
// documentado na Fase 27.68) — a RPC resolve isso expondo só os clientes
// com quem o posto chamador já tem uma negociação real, nunca a base
// inteira.
export default async function ClientesPostoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Esta tela é exclusiva para postos revendedores. Para o cadastro dos seus clientes (transportadoras),
        use{" "}
        <Link href="/clientes" className="text-frota-600 hover:underline">
          Clientes
        </Link>
        .
      </div>
    );
  }

  const { data: clientesData, error } = empresaSelecionada
    ? await supabase.rpc("clientes_do_posto", { p_empresa_posto_id: empresaSelecionada })
    : { data: null, error: null };

  const clientes = clientesData ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Transportadoras que já negociaram com este posto (qualquer status)
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
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
          {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar clientes: {error.message}</p>}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3">Negociações</th>
                  <th className="px-4 py-3">Última atualização</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCNPJ(c.cnpj)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.municipio ? `${c.municipio}/${c.uf ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.segmento_transporte ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STATUS_NEGOCIACAO_LABEL[c.status_negociacao as StatusNegociacao] ?? c.status_negociacao}
                      </span>{" "}
                      <span className="text-xs text-slate-400">({c.negociacoes_count})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.ultima_atualizacao ? new Date(c.ultima_atualizacao).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/clientes-posto/${c.id}`} className="text-frota-600 hover:underline">
                        Ver ciclo
                      </Link>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhum cliente negociou com este posto ainda.
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
