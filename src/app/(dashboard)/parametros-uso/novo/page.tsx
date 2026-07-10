import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
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

  const [{ data: veiculos }, { data: motoristas }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada),
    supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", empresaSelecionada)
      .eq("status", "Ativo")
      .order("nome_completo"),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Novo Vínculo</h1>
      <p className="mb-6 text-sm text-slate-500">Motorista ↔ Veículo{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.</p>
      <VinculoForm
        empresaId={empresaSelecionada}
        veiculos={(veiculos ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo }))}
        motoristas={motoristas ?? []}
      />
    </div>
  );
}
