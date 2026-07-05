import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanoViagemForm } from "../../_components/PlanoViagemForm";

export default async function EditarPlanoViagemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plano } = await supabase.from("planos_viagem").select("*").eq("id", id).single();
  if (!plano) notFound();

  const [
    { data: pedagiosData },
    { data: veiculosData },
    { data: motoristasData },
    { data: rotogramasData },
    { data: rotasSalvasData },
    { data: centrosCustoData },
  ] = await Promise.all([
    supabase.from("planos_viagem_pedagios").select("praca_nome, valor").eq("plano_viagem_id", id).order("ordem"),
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: plano.empresa_id }),
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", plano.empresa_id).order("nome_completo"),
    supabase.from("rotogramas").select("id, numero, origem, destino").eq("empresa_id", plano.empresa_id).order("numero", { ascending: false }),
    supabase.from("rotas_salvas").select("id, nome").eq("empresa_id", plano.empresa_id).order("criado_em", { ascending: false }),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", plano.empresa_id).order("nome"),
  ]);

  const veiculos = (veiculosData ?? [])
    .filter((v) => v.ativo !== false)
    .map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, autonomia: v.autonomia }));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Plano de Viagem — {plano.nome}</h1>
      <PlanoViagemForm
        empresaId={plano.empresa_id}
        plano={plano}
        pedagiosIniciais={pedagiosData ?? []}
        veiculos={veiculos}
        motoristas={motoristasData ?? []}
        rotogramas={rotogramasData ?? []}
        rotasSalvas={rotasSalvasData ?? []}
        centrosCusto={centrosCustoData ?? []}
      />
    </div>
  );
}
