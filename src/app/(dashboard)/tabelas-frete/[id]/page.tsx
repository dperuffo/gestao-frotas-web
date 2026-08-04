import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabelaFreteForm } from "../_components/TabelaFreteForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

export default async function EditarTabelaFretePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: tabela } = await supabase.from("tabelas_frete").select("*").eq("id", id).maybeSingle();
  if (!tabela) notFound();

  const empresaId = empresaParam ?? tabela.empresa_id;

  const [{ data: faixas }, { data: parceiros }] = await Promise.all([
    supabase
      .from("tabelas_frete_faixas")
      .select("peso_min_kg, peso_max_kg, valor_por_kg, valor_minimo")
      .eq("tabela_frete_id", id)
      .order("peso_min_kg"),
    supabase.from("cadastros_parceiros").select("id, razao_social, cnpj_cpf").eq("empresa_id", tabela.empresa_id).eq("papel", "tomador").order("razao_social"),
  ]);

  return (
    <div>
      <BotaoVoltar href={`/tabelas-frete?empresa=${empresaId}`} label="Voltar para a lista" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">📋 Editar tabela de frete</h1>
        <p className="mt-1 text-sm text-slate-500">{tabela.nome}</p>
      </div>
      <TabelaFreteForm
        empresaId={empresaId}
        tabela={tabela}
        faixasIniciais={(faixas ?? []).map((f) => ({
          pesoMinKg: f.peso_min_kg,
          pesoMaxKg: f.peso_max_kg,
          valorPorKg: f.valor_por_kg,
          valorMinimo: f.valor_minimo,
        }))}
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, razaoSocial: p.razao_social, cnpjCpf: p.cnpj_cpf }))}
      />
    </div>
  );
}
