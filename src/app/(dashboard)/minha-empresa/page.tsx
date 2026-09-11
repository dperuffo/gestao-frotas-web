import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { FormularioPix } from "./_components/FormularioPix";
import { FormularioDadosBancarios } from "./_components/FormularioDadosBancarios";

type SearchParams = { empresa?: string };

// Fase 27.92 — pedido do Daniel: o boleto/documento de cobrança usa o posto
// como "cedente", com a chave PIX dele — precisa de um lugar pro posto
// cadastrar essa chave (self-service, não é campo administrativo). Só
// empresas segmento='Revenda' aparecem aqui (mesmo recorte de
// /precos-postos) — não faz sentido uma empresa Frota (cliente) configurar
// "chave PIX de recebimento".
export default async function MinhaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: postosDoUsuario } = await supabase
    .from("empresas")
    .select(
      "id, nome, cnpj, segmento, logradouro, numero, complemento, bairro, municipio, uf, cep, pix_chave, banco_codigo, banco_nome, agencia, agencia_digito, conta, conta_digito, tipo_conta, titular_nome, titular_documento"
    )
    .in(
      "id",
      empresas.map((e) => e.id)
    )
    .eq("segmento", "Revenda")
    .order("nome");

  const opcoes = postosDoUsuario ?? [];
  const atual = opcoes.find((p) => p.id === empresaSelecionada) ?? opcoes[0] ?? null;

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Meus dados"
        descricao="Dados do posto usados no boleto/documento de cobrança enviado aos clientes."
      />

      {opcoes.length > 1 && (
        <form className="mb-4 flex items-end gap-2 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Posto</label>
            <select name="empresa" defaultValue={atual?.id} className="input">
              {opcoes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            Trocar
          </button>
        </form>
      )}

      {!atual ? (
        <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">
          Nenhum posto (Revenda) vinculado a este usuário.
        </div>
      ) : (
        <>
          <div className="mb-6 card p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{atual.nome}</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-400">CNPJ</dt>
                <dd className="text-slate-700 dark:text-slate-300">{atual.cnpj || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Endereço</dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {[atual.logradouro, atual.numero, atual.complemento].filter(Boolean).join(", ") || "—"}
                  {atual.bairro ? ` — ${atual.bairro}` : ""}
                  {atual.municipio ? `, ${atual.municipio}/${atual.uf ?? ""}` : ""}
                  {atual.cep ? ` — CEP ${atual.cep}` : ""}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              Nome, CNPJ e endereço vêm do cadastro da empresa. Pra corrigir algum desses dados, fale
              com a FNI.
            </p>
          </div>

          <FormularioPix empresaId={atual.id} pixChaveAtual={atual.pix_chave} />

          <FormularioDadosBancarios
            empresaId={atual.id}
            dadosAtuais={{
              banco_codigo: atual.banco_codigo,
              banco_nome: atual.banco_nome,
              agencia: atual.agencia,
              agencia_digito: atual.agencia_digito,
              conta: atual.conta,
              conta_digito: atual.conta_digito,
              tipo_conta: atual.tipo_conta,
              titular_nome: atual.titular_nome,
              titular_documento: atual.titular_documento,
            }}
          />
        </>
      )}
    </div>
  );
}
