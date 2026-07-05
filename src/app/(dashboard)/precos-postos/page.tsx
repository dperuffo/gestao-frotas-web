import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataBr } from "@/lib/utils";
import { FormularioPrecosPosto } from "./_components/FormularioPrecosPosto";

type SearchParams = { empresa?: string };

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
  const { empresa: empresaParam } = await searchParams;
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
      ) : souPosto ? (
        <PainelPosto empresaPostoId={empresaSelecionada} />
      ) : (
        <PainelCliente empresaClienteId={empresaSelecionada} nomeEmpresaSelecionada={nomeEmpresaSelecionada} />
      )}
    </div>
  );
}

async function PainelPosto({ empresaPostoId }: { empresaPostoId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("precos_postos")
    .select("combustivel, preco, atualizado_em")
    .eq("empresa_posto_id", empresaPostoId);

  return <FormularioPrecosPosto empresaPostoId={empresaPostoId} precosAtuais={data ?? []} />;
}

async function PainelCliente({
  empresaClienteId,
  nomeEmpresaSelecionada,
}: {
  empresaClienteId: string;
  nomeEmpresaSelecionada?: string;
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
    .select("empresa_posto_id, combustivel, preco, atualizado_em")
    .in("empresa_posto_id", idsPostos)
    .order("combustivel", { ascending: true });

  const porPosto = new Map<string, { combustivel: string; preco: number; atualizado_em: string }[]>();
  for (const p of precos ?? []) {
    const lista = porPosto.get(p.empresa_posto_id) ?? [];
    lista.push(p);
    porPosto.set(p.empresa_posto_id, lista);
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">Erro ao carregar preços: {error.message}</p>}
      {idsPostos.map((idPosto) => {
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => (
                  <tr key={p.combustivel} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{p.combustivel}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatarDataBr(p.atualizado_em.slice(0, 10))}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
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
