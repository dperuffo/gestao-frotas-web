import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CentroCustoForm } from "../_components/CentroCustoForm";
import { AlocarVeiculoForm } from "../_components/AlocarVeiculoForm";

export default async function EditarCentroCustoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: centro } = await supabase.from("centros_custo").select("*").eq("id", id).single();
  if (!centro) notFound();

  let cnpjFrota: string | null = null;
  if (centro.empresa_id) {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("cnpj")
      .eq("id", centro.empresa_id)
      .maybeSingle();
    cnpjFrota = empresa?.cnpj ?? null;
  }

  const { data: veiculosDaEmpresa } = cnpjFrota
    ? await supabase
        .from("cadastro_veiculos")
        .select("placa, marca, modelo, centro_custo_id, centro_custo_nome")
        .eq("cnpj_frota", cnpjFrota)
        .order("placa")
    : { data: [] };

  const veiculosAlocados = (veiculosDaEmpresa ?? []).filter((v) => v.centro_custo_id === id);
  const veiculosDisponiveis = (veiculosDaEmpresa ?? []).filter((v) => v.centro_custo_id !== id);

  const { data: historicoRaw } = await supabase
    .from("centros_custo_veiculos")
    .select("id, placa, data_inicio, data_fim, ativo")
    .eq("centro_custo_id", id)
    .order("data_inicio", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Editar Centro de Custo — {centro.nome}</h1>
      <CentroCustoForm centroCusto={centro} />
      <AlocarVeiculoForm
        centroCustoId={id}
        empresaId={centro.empresa_id}
        veiculosAlocados={veiculosAlocados}
        veiculosDisponiveis={veiculosDisponiveis}
        historico={historicoRaw ?? []}
      />
    </div>
  );
}
