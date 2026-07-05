import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { PlanoViagemForm } from "../_components/PlanoViagemForm";

// Fase 27.48 — a escolha de cliente acontece igual ao resto do app (via
// ?empresa= já resolvido no seletor da tela de listagem), não dentro do
// formulário — diferente do mockup original, que tinha um dropdown de
// cliente dentro do próprio modal. Mantém a mesma navegação já usada em
// Abastecimentos/Anomalias/Veículos.
export default async function NovoPlanoViagemPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        Selecione um cliente na tela de{" "}
        <Link href="/planos-viagem" className="text-frota-600 hover:underline">
          Planos de Viagem
        </Link>{" "}
        antes de criar um novo plano.
      </div>
    );
  }

  const [
    { data: veiculosData },
    { data: motoristasData },
    { data: rotogramasData },
    { data: rotasSalvasData },
    { data: centrosCustoData },
  ] = await Promise.all([
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada }),
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", empresaSelecionada).order("nome_completo"),
    supabase.from("rotogramas").select("id, numero, origem, destino").eq("empresa_id", empresaSelecionada).order("numero", { ascending: false }),
    supabase.from("rotas_salvas").select("id, nome").eq("empresa_id", empresaSelecionada).order("criado_em", { ascending: false }),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaSelecionada).order("nome"),
  ]);

  const veiculos = (veiculosData ?? [])
    .filter((v) => v.ativo !== false)
    .map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, autonomia: v.autonomia }));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Plano de Viagem</h1>
      <PlanoViagemForm
        empresaId={empresaSelecionada}
        veiculos={veiculos}
        motoristas={motoristasData ?? []}
        rotogramas={rotogramasData ?? []}
        rotasSalvas={rotasSalvasData ?? []}
        centrosCusto={centrosCustoData ?? []}
      />
      {empresas.length > 1 && (
        <p className="mt-4 text-xs text-slate-400">
          Criando para: <strong>{empresas.find((e) => e.id === empresaSelecionada)?.nome}</strong>
        </p>
      )}
    </div>
  );
}
