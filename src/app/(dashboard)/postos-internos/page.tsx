import { createClient } from "@/lib/supabase/server";
import { obterOuCriarPostoInternoAcao } from "./actions";
import { FormPostoInterno } from "./_components/FormPostoInterno";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// Fase Abastecimento-Interno (21/08/2026, pedido do Daniel) — tela
// self-service (mesmo padrão de /postos) pro cliente configurar o posto
// interno (garagem própria) da matriz e/ou de cada filial: ativar/desativar
// e cadastrar o preço de cada combustível vendido ali dentro. Mesma
// convenção de seleção de empresa das outras telas "por cliente" (admin vê
// todas via seletor; cliente com só 1 empresa não vê seletor nenhum;
// cliente de grupo econômico escolhe entre matriz e filiais).
export default async function PostosInternosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  let empresas: { id: string; nome: string }[] = [];
  if (perfil === "admin") {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
    const { data } = await supabase.from("empresas").select("id, nome").in("id", minhasEmpresasIds).order("nome");
    empresas = data ?? [];
  }

  const empresaSelecionada =
    (empresaParam && empresas.some((e) => e.id === empresaParam) ? empresaParam : null) ??
    (empresas.length === 1 ? empresas[0].id : null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            Postos Internos
            <AjudaIcon chave="postos-internos.visao_geral" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Abastecimento feito na garagem própria (matriz ou filial), antes do veículo sair pra rota — entra no
            custo total da Roteirização junto com os postos externos.
          </p>
        </div>
      </div>

      {empresas.length > 1 && (
        <form className="mb-6 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa (matriz/filial)</label>
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
            Selecionar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione uma empresa acima para configurar o posto interno dela.
        </p>
      ) : (
        <ConteudoEmpresa empresaId={empresaSelecionada} />
      )}
    </div>
  );
}

async function ConteudoEmpresa({ empresaId }: { empresaId: string }) {
  const posto = await obterOuCriarPostoInternoAcao(empresaId);

  if (!posto) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar/criar o posto interno desta empresa. Tente novamente ou fale com o suporte.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: precos } = await supabase
    .from("postos_internos_precos")
    .select("combustivel, preco")
    .eq("posto_interno_id", posto.id);

  return (
    <FormPostoInterno
      empresaId={empresaId}
      postoInternoId={posto.id}
      nome={posto.nome}
      ativo={posto.ativo}
      precos={(precos ?? []).map((p) => ({ combustivel: p.combustivel, preco: Number(p.preco) }))}
    />
  );
}
