import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { VinculoForm } from "../_components/VinculoForm";

export default async function NovoVinculoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Novo Vínculo</h1>
        <p className="text-sm text-slate-500">
          Selecione um cliente na tela de{" "}
          <Link href="/parametros-uso" className="text-frota-600 hover:underline">
            Parâmetros de Uso
          </Link>{" "}
          antes de criar um vínculo.
        </p>
      </div>
    );
  }

  // Fase Reuso-Operacional-Grupo (Fase 3) — veículo/motorista de empresa
  // irmã do grupo também entra como opção (rotulado). O vínculo em si
  // continua gravado com empresa_id = empresa operando.
  const irmas = await empresasIrmasAcao(supabase, empresaSelecionada);
  const nomePorEmpresaId = new Map(irmas.map((e) => [e.id, e.nome]));
  const idsIrmas = irmas.map((e) => e.id);

  const [{ data: veiculos }, { data: motoristas }, resultadosVeiculosGrupo, { data: motoristasGrupoData }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada),
    supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", empresaSelecionada)
      .eq("status", "Ativo")
      .order("nome_completo"),
    Promise.all(irmas.map((e) => buscarTodosVeiculosDaEmpresa(supabase, e.id))),
    idsIrmas.length > 0
      ? supabase.from("motoristas").select("id, nome_completo, cpf, empresa_id").in("empresa_id", idsIrmas).eq("status", "Ativo").order("nome_completo")
      : Promise.resolve({ data: [] as { id: string; nome_completo: string; cpf: string | null; empresa_id: string }[] }),
  ]);

  const veiculosGrupo = resultadosVeiculosGrupo.flatMap((r, i) =>
    (r.data ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, empresaNome: irmas[i].nome }))
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Novo Vínculo</h1>
      <p className="mb-6 text-sm text-slate-500">Motorista ↔ Veículo{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.</p>
      <VinculoForm
        empresaId={empresaSelecionada}
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
