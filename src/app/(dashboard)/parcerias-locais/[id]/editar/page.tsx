import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ItemParceriaForm } from "../../_components/ItemParceriaForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

export default async function EditarItemParceriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div className="card p-6">
        <BotaoVoltar href="/parcerias-locais" />
        <h1 className="text-lg font-semibold text-slate-900">Selecione uma empresa</h1>
        <p className="mt-2 text-sm text-slate-500">
          Volte pra Parcerias Locais e escolha a empresa antes de editar um benefício.
        </p>
      </div>
    );
  }

  const { data: item } = await supabase
    .from("fidelidade_catalogo_itens")
    .select("id, categoria, titulo, descricao, parceiro_nome, pontos_necessarios, ativo, imagem_url, validade_dias")
    .eq("id", id)
    .eq("criador_empresa_id", empresaSelecionada)
    .maybeSingle();

  if (!item) notFound();

  return (
    <div>
      <BotaoVoltar href={`/parcerias-locais?empresa=${empresaSelecionada}`} />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Editar Benefício</h1>
      <p className="mb-6 text-sm text-slate-500">{item.titulo}</p>
      <ItemParceriaForm empresaId={empresaSelecionada} item={item} />
    </div>
  );
}
