import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { MeuPostoForm } from "./_components/MeuPostoForm";

type SearchParams = { empresa?: string };

// Fase 27.137 — pedido do Daniel: "Uma nova aba 'Meu Posto' com CNPJ, Razão
// Social, endereço completo, contatos e, principalmente, latitude
// longitude [...] deverão ser preenchidos, comparados e checados com a base
// ANP de postos [...] para que nao hajam registros sobrepostos ou
// duplicados" — o cadastro aqui alimenta postos_gf (mesma tabela usada nas
// consultas de postos/roteirização) via a RPC
// verificar_e_registrar_posto_anp. Mesmo recorte de /minha-empresa (só
// segmento='Revenda').
export default async function MeuPostoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: postosDoUsuario } = await supabase
    .from("empresas")
    .select("*")
    .in(
      "id",
      empresas.map((e) => e.id)
    )
    .eq("segmento", "Revenda")
    .order("nome");

  const opcoes = postosDoUsuario ?? [];
  const atual = opcoes.find((p) => p.id === empresaSelecionada) ?? opcoes[0] ?? null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Meu Posto</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirme os dados do seu estabelecimento — CNPJ, endereço e localização são comparados com a base
          nacional da ANP pra evitar cadastro duplicado, e alimentam os preços exibidos pros clientes nas
          consultas de postos e roteirização.
        </p>
      </div>

      {opcoes.length > 1 && (
        <form className="mb-4 flex items-end gap-2 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Posto</label>
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
        <div className="card p-6 text-sm text-slate-500">Nenhum posto (Revenda) vinculado a este usuário.</div>
      ) : (
        <MeuPostoForm empresa={atual} />
      )}
    </div>
  );
}
