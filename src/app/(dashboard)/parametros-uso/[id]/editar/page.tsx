import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { VinculoForm } from "../../_components/VinculoForm";

export default async function EditarVinculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vinculo } = await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .select("id, empresa_id, placa, motorista_id, data_inicio, data_fim, observacao, status")
    .eq("id", id)
    .maybeSingle();

  if (!vinculo) notFound();

  // Fase Reuso-Operacional-Grupo (Fase 3) — mesma expansão de "novo".
  const irmas = await empresasIrmasAcao(supabase, vinculo.empresa_id);
  const nomePorEmpresaId = new Map(irmas.map((e) => [e.id, e.nome]));
  const idsIrmas = irmas.map((e) => e.id);

  const [{ data: veiculos }, { data: motoristas }, resultadosVeiculosGrupo, { data: motoristasGrupoData }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, vinculo.empresa_id),
    supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", vinculo.empresa_id)
      .order("nome_completo"),
    Promise.all(irmas.map((e) => buscarTodosVeiculosDaEmpresa(supabase, e.id))),
    idsIrmas.length > 0
      ? supabase.from("motoristas").select("id, nome_completo, cpf, empresa_id").in("empresa_id", idsIrmas).order("nome_completo")
      : Promise.resolve({ data: [] as { id: string; nome_completo: string; cpf: string | null; empresa_id: string }[] }),
  ]);

  const veiculosGrupo = resultadosVeiculosGrupo.flatMap((r, i) =>
    (r.data ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, empresaNome: irmas[i].nome }))
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Vínculo</h1>
      <VinculoForm
        vinculo={vinculo}
        empresaId={vinculo.empresa_id}
        veiculos={[
          ...(veiculos ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, empresaNome: undefined as string | undefined })),
          ...veiculosGrupo,
        ]}
        motoristas={[
          ...(motoristas ?? []),
          ...(motoristasGrupoData ?? []).map((m) => ({ id: m.id, nome_completo: m.nome_completo, cpf: m.cpf, empresaNome: nomePorEmpresaId.get(m.empresa_id) })),
        ]}
      />
    </div>
  );
}
