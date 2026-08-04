import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { NovaMultaForm } from "../_components/NovaMultaForm";

export default async function NovaMultaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, empresas } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente em <Link href="/multas" className="underline">Multas</Link> antes de registrar uma nova multa.
        </p>
      </div>
    );
  }

  // cadastro_veiculos não tem empresa_id (vínculo é por cnpj_frota) — usa a
  // RPC veiculos_da_empresa, mesmo padrão de /veiculos.
  //
  // Fase Reuso-Operacional-Grupo (Fase 2) — placa de veículo de empresa
  // irmã do mesmo Grupo Econômico ativo também entra como opção, rotulada
  // com o nome da empresa dona do cadastro (mesmo padrão de Fretes/Planos
  // de Viagem/MDF-e).
  const irmas = await empresasIrmasAcao(supabase, empresaSelecionada);
  const [{ data: veiculosDaEmpresa }, resultadosVeiculosGrupo] = await Promise.all([
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada }),
    Promise.all(irmas.map((e) => supabase.rpc("veiculos_da_empresa", { p_empresa_id: e.id }))),
  ]);

  const placasGrupo = resultadosVeiculosGrupo.flatMap((r, i) =>
    (r.data ?? [])
      .filter((v) => v.ativo !== false && v.placa)
      .map((v) => ({ placa: v.placa as string, empresaNome: irmas[i].nome }))
  );

  const placas = [
    ...(veiculosDaEmpresa ?? [])
      .filter((v) => v.ativo !== false && v.placa)
      .map((v) => ({ placa: v.placa as string, empresaNome: undefined as string | undefined })),
    ...placasGrupo,
  ].sort((a, b) => a.placa.localeCompare(b.placa));

  return (
    <div>
      <div className="mb-6">
        <Link href={`/multas?empresa=${empresaSelecionada}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Nova Multa</h1>
      </div>
      <NovaMultaForm empresaId={empresaSelecionada} placas={placas} />
    </div>
  );
}
