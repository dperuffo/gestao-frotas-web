import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { CentroCustoForm } from "../_components/CentroCustoForm";
import { AlocarVeiculoForm } from "../_components/AlocarVeiculoForm";
import { AlocarMotoristaForm } from "../_components/AlocarMotoristaForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

export default async function EditarCentroCustoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: centro } = await supabase.from("centros_custo").select("*").eq("id", id).single();
  if (!centro) notFound();

  // Fase 27.38 — achado real (reportado pelo Daniel, frota de teste com mais
  // de 2000 veículos): esta consulta buscava cadastro_veiculos direto por
  // cnpj_frota sem nenhum range/limit, então caía no limite padrão de 1000
  // linhas por resposta do Supabase/PostgREST (db-max-rows) — a lista de
  // "Disponíveis" aqui já vinha cortada em 1000 veículos, então mesmo
  // "selecionar todos os filtrados" na alocação em massa não conseguia
  // mover o resto da frota. buscarTodosVeiculosDaEmpresa pagina em lotes de
  // 1000 até esgotar os resultados, e já resolve a normalização de CNPJ
  // pela RPC veiculos_da_empresa (sem precisar buscar o cnpj da empresa à
  // parte, como antes).
  const { data: veiculosDaEmpresa } = centro.empresa_id
    ? await buscarTodosVeiculosDaEmpresa(supabase, centro.empresa_id)
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
      <BotaoVoltar href="/centros-custo" />
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
