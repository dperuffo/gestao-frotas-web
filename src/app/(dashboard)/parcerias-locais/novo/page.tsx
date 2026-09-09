import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ItemParceriaForm } from "../_components/ItemParceriaForm";

export default async function NovoItemParceriaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Selecione uma empresa</h1>
        <p className="mt-2 text-sm text-slate-500">
          Volte pra Parcerias Locais e escolha a empresa antes de criar um benefício.
        </p>
      </div>
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Novo Benefício"
        descricao={'Fica disponível pro motorista resgatar no app "Estrada que Cuida" assim que salvo — sem aprovação prévia.'}
      />
      <ItemParceriaForm empresaId={empresaSelecionada} />
    </div>
  );
}
