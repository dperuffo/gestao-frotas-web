import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CentroCustoForm } from "../_components/CentroCustoForm";
import { AlocarVeiculoForm } from "../_components/AlocarVeiculoForm";
import { AlocarMotoristaForm } from "../_components/AlocarMotoristaForm";

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

  // Fase 27.36 — mesma alocação em massa, agora pra motoristas. Motoristas
  // já têm `empresa_id` direto (diferente de veículos, que usam
  // cnpj_frota), e centro_custo_id/nome vêm via join com centros_custo (não
  // existe coluna de cache "centro_custo_nome" na tabela, ao contrário de
  // cadastro_veiculos).
  const { data: motoristasDaEmpresaRaw } = centro.empresa_id
    ? await supabase
        .from("motoristas")
        .select("id, nome_completo, cpf, centro_custo_id, centros_custo(nome)")
        .eq("empresa_id", centro.empresa_id)
        .order("nome_completo")
    : { data: [] };

  const motoristasDaEmpresa = (motoristasDaEmpresaRaw ?? []).map((m) => ({
    id: m.id,
    nome_completo: m.nome_completo,
    cpf: m.cpf,
    centro_custo_id: m.centro_custo_id,
    centro_custo_nome: m.centros_custo?.nome ?? null,
  }));
  const motoristasAlocados = motoristasDaEmpresa.filter((m) => m.centro_custo_id === id);
  const motoristasDisponiveis = motoristasDaEmpresa.filter((m) => m.centro_custo_id !== id);

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
      <AlocarMotoristaForm
        centroCustoId={id}
        motoristasAlocados={motoristasAlocados}
        motoristasDisponiveis={motoristasDisponiveis}
      />
    </div>
  );
}
