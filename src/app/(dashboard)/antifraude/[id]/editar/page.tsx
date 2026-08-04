import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { RegraAntifraudeForm } from "../../_components/RegraAntifraudeForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

export default async function EditarRegraAntifraudePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: regra } = await supabase
    .from("regras_antifraude")
    .select("id, empresa_id, nome, tipo, escopo, escopo_referencia, condicoes, vigencia_inicio, vigencia_fim, status")
    .eq("id", id)
    .maybeSingle();

  if (!regra) notFound();

  const [{ data: veiculos }, { data: motoristas }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, regra.empresa_id),
    supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", regra.empresa_id)
      .order("nome_completo"),
  ]);

  return (
    <div>
      <BotaoVoltar href="/antifraude" />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Regra Antifraude</h1>
      <RegraAntifraudeForm
        regra={regra as any}
        empresaId={regra.empresa_id}
        veiculos={(veiculos ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo }))}
        motoristas={motoristas ?? []}
      />
    </div>
  );
}
