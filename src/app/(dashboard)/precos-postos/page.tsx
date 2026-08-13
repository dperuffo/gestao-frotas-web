import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataHoraBr } from "@/lib/utils";
import { FormularioPrecosPosto } from "./_components/FormularioPrecosPosto";
import { ReplicarParaGrupoButton } from "@/components/replicacao/ReplicarParaGrupoButton";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.62 — "atualizado_por" guarda só o e-mail; resolve o nome à parte
// via usuarios_app (mesmo padrão usado em /negociacoes e dashboard/layout.tsx
// — sem FK entre as tabelas, o e-mail é a chave de junção universal).
async function resolverNomesPorEmail(
  supabase: SupabaseClient<Database>,
  emails: (string | null)[]
): Promise<Record<string, string>> {
  const unicos = Array.from(new Set(emails.filter((e): e is string => !!e)));
  if (unicos.length === 0) return {};
  const { data } = await supabase.from("usuarios_app").select("nome, email").in("email", unicos);
  return Object.fromEntries((data ?? []).map((u) => [u.email, u.nome || u.email]));
}

type SearchParams = { empresa?: string; q?: string };

// Fase 27.57 — Preços de combustíveis do posto. Uma única tela serve os
// dois lados (mesmo espírito de /negociacoes e /abastecimentos-postos): o
// posto cadastra/atualiza o próprio preço por combustível; o cliente de
// frota vê os preços de qualquer posto com quem já tenha negociação
// (mesmo pendente) — a RLS de precos_postos (ver migração
// precos_postos_tabela_e_rls) já garante esse recorte, sem precisar
// filtrar de novo aqui.
export default async function PrecosPostosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  const souPosto = segmentoSelecionado === "Revenda";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {souPosto ? "Meus Preços" : "Preços dos Postos Parceiros"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {souPosto
            ? "Preço por combustível que você fornece — visível aos clientes com quem você negocia."
            : "Preços informados pelos postos com quem você tem alguma negociação, pendente ou fechada."}
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {souPosto ? "Empresa" : "Cliente"}
            </label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">{souPosto ? "Selecione..." : "Selecione um cliente..."}</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            {souPosto ? "Trocar" : "Filtrar"}
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : souPosto ? (
        <PainelPosto empresaPostoId={empresaSelecionada} />
      ) : (
        <PainelCliente
          empresaClienteId={empresaSelecionada}
          nomeEmpresaSelecionada={nomeEmpresaSelecionada}
          empresaParam={empresaParam}
          q={q}
        />
      )}
    </div>
  );
}

async function PainelPosto({ empresaPostoId }: { empresaPostoId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("precos_postos")
    .select("combustivel, preco, atualizado_em, atualizado_por")
    .eq("empresa_posto_id", empresaPostoId);

  const nomePorEmail = await resolverNomesPorEmail(supabase, (data ?? []).map((p) => p.atualizado_por));
  const precosAtuais = (data ?? []).map((p) => ({
    ...p,
    atualizado_por_nome: p.atualizado_por ? (nomePorEmail[p.atualizado_por] ?? p.atualizado_por) : null,
  }));

  return (
    <div className="space-y-4">
      {precosAtuais.length > 0 && (
        <div className="flex justify-end">
          <ReplicarParaGrupoButton
            chaveTabela="precos_postos"
            empresaId={empresaPostoId}
            rotuloRegistro="a tabela de preços"
          />
        </div>
      )}
      <FormularioPrecosPosto empresaPostoId={empresaPostoId} precosAtuais={precosAtuais} />
    </div>
  );
}

async function PainelCliente({
  empresaClienteId,
  nomeEmpresaSelecionada,
  empresaParam,
  q,
}: {
  empresaClienteId: string;
  nomeEmpresaSelecionada?: string;
  empresaParam?: string;
  q?: string;
}) {
  const supabase = await createClient();

  // Postos com quem este cliente já tem alguma negociação (qualquer status).
  const { data: negociacoes } = await supabase
    .from("negociacoes_postos")
    .select("empresa_posto_id, posto_nome")
    .eq("empresa_cliente_id", empresaClienteId)
    .not("empresa_posto_id", "is", null);

  const postosMap = new Map<string, string>();
  for (const n of negociacoes ?? []) {
    if (n.empresa_posto_id) postosMap.set(n.empresa_posto_id, n.posto_nome ?? "Posto");
  }
  const idsPostos = Array.from(postosMap.keys());

  if (idsPostos.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-500">
        Você ainda não tem negociação com nenhum posto — os preços aparecem aqui assim que houver
        pelo menos uma negociação{nomeEmpresaSelecionada ? ` para ${nomeEmpresaSelecionada}` : ""}.
      </p>
    );
  }

  const { data: precos, error } = await supabase
    .from("precos_postos")
    .select("empresa_posto_id, combustivel, preco, atualizado_em, atualizado_por")
    .in("empresa_posto_id", idsPostos)
    .order("combustivel", { ascending: true });

  const nomePorEmail = await resolverNomesPorEmail(supabase, (precos ?? []).map((p) => p.atualizado_por));

  const porPosto = new Map<
    string,
    { combustivel: string; preco: number; atualizado_em: string; atualizado_por: string | null }[]
  >();
  for (const p of precos ?? []) {
    const lista = porPosto.get(p.empresa_posto_id) ?? [];
    lista.push(p);
    porPosto.set(p.empresa_posto_id, lista);
  }

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: "quando tiver
  // muitos registros, ficará inviável ficar navegando para encontrar o posto
  // necessário") — mesmo padrão de busca via ?q= já usado em /veiculos,
  // /motoristas, /usuarios etc.: filtra em memória (a lista inteira já foi
  // buscada acima) por nome do posto OU por combustível informado por ele,
  // pra achar rápido também quem lembra só do combustível, não do posto.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const idsPostosFiltrados = termoBusca
    ? idsPostos.filter((idPosto) => {
        const nomePosto = (postosMap.get(idPosto) ?? "").toLowerCase();
        if (nomePosto.includes(termoBusca)) return true;
        return (porPosto.get(idPosto) ?? []).some((p) => p.combustivel.toLowerCase().includes(termoBusca));
      })
    : idsPostos;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">Erro ao carregar preços: {error.message}</p>}

      <form>
        {/* Fase busca-generica-listas — form próprio (separado do form do seletor
            de Cliente acima), com o cliente atual em campo oculto pra não se
            perder da URL ao buscar (mesmo cuidado da Fase 27.31 em /veiculos). */}
        <input type="hidden" name="empresa" value={empresaParam ?? ""} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por posto ou combustível..."
          className="input max-w-sm"
        />
      </form>

      {idsPostosFiltrados.length === 0 && (
        <p className="p-4 text-sm text-slate-400">Nenhum posto encontrado para &quot;{q}&quot;.</p>
      )}

      {idsPostosFiltrados.map((idPosto) => {
        const lista = porPosto.get(idPosto) ?? [];
        return (
          <div key={idPosto} className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{postosMap.get(idPosto)}</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Combustível</th>
                  <th className="px-4 py-3">Preço/L</th>
                  <th className="px-4 py-3">Atualizado em</th>
                  <th className="px-4 py-3">Atualizado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => (
                  <tr key={p.combustivel} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 text-slate-700">{p.combustivel}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatarDataHoraBr(p.atualizado_em)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.atualizado_por ? (
                        <>
                          <span className="text-slate-700">{nomePorEmail[p.atualizado_por] ?? p.atualizado_por}</span>
                          <br />
                          <span className="text-xs text-slate-400">{p.atualizado_por}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      Este posto ainda não informou preços.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
