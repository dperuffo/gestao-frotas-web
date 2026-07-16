import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { RegraAntifraudeForm } from "../_components/RegraAntifraudeForm";

export default async function NovaRegraAntifraudePage({
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
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Nova Regra Antifraude</h1>
        <p className="text-sm text-slate-500">
          Selecione um cliente na tela de{" "}
          <Link href="/antifraude" className="text-frota-600 hover:underline">
            Antifraude
          </Link>{" "}
          antes de criar uma regra.
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
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Nova Regra Antifraude</h1>
      <p className="mb-6 text-sm text-slate-500">
        {nomeEmpresaSelecionada ? `Cliente: ${nomeEmpresaSelecionada}.` : ""} Sistemas externos consultam essa regra
        antes de autorizar um abastecimento.
      </p>
      <RegraAntifraudeForm
        empresaId={empresaSelecionada}
        veiculos={(veiculos ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo }))}
        motoristas={motoristas ?? []}
      />
    </div>
  );
}
