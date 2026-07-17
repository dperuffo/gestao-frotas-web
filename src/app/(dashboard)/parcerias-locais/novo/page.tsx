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
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Novo Benefício</h1>
      <p className="mb-6 text-sm text-slate-500">
        Fica disponível pro motorista resgatar no app &quot;Estrada que Cuida&quot; assim que salvo — sem
        aprovação prévia.
      </p>
      <ItemParceriaForm empresaId={empresaSelecionada} />
    </div>
  );
}
