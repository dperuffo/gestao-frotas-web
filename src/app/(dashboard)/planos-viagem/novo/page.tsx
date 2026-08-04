import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { PlanoViagemForm, type PrefillPlanoViagem } from "../_components/PlanoViagemForm";

// Fase 27.48 — a escolha de cliente acontece igual ao resto do app (via
// ?empresa= já resolvido no seletor da tela de listagem), não dentro do
// formulário — diferente do mockup original, que tinha um dropdown de
// cliente dentro do próprio modal. Mantém a mesma navegação já usada em
// Abastecimentos/Anomalias/Veículos.
//
// Fase encadeia-roteirizador-plano-viagem — quando vem do botão "Criar
// Plano de Viagem" (na Roteirização ou no Rotograma), origem/destino não
// existem como campo aqui (planos_viagem não guarda isso), mas
// veículo/combustível/pedágios/vínculo com o Rotograma sim — chega como
// JSON na query string, igual ao ?prefill= já usado em /rotograma/novo.
function parsePrefill(bruto: string | undefined): PrefillPlanoViagem | undefined {
  if (!bruto) return undefined;
  try {
    const dados = JSON.parse(bruto) as PrefillPlanoViagem;
    return dados && typeof dados === "object" ? dados : undefined;
  } catch {
    return undefined;
  }
}

export default async function NovoPlanoViagemPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; prefill?: string }>;
}) {
  const { empresa: empresaParam, prefill: prefillBruto } = await searchParams;
  const prefill = parsePrefill(prefillBruto);
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

  // Fase Reuso-Operacional-Grupo — veículo e motorista de uma empresa irmã
  // do mesmo Grupo Econômico ativo também entram como opção, marcados com
  // o nome da empresa dona do cadastro.
  const irmas = await empresasIrmasAcao(supabase, empresaSelecionada);
  const nomePorEmpresaId = new Map(irmas.map((e) => [e.id, e.nome]));
  const idsIrmas = irmas.map((e) => e.id);

  const [
    { data: veiculosData },
    { data: motoristasData },
    { data: rotogramasData },
    { data: rotasSalvasData },
    { data: centrosCustoData },
    { data: parametroPrePedidoData },
    resultadosVeiculosGrupo,
    { data: motoristasGrupoData },
  ] = await Promise.all([
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada }),
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", empresaSelecionada).order("nome_completo"),
    supabase.from("rotogramas").select("id, numero, origem, destino").eq("empresa_id", empresaSelecionada).order("numero", { ascending: false }),
    supabase.from("rotas_salvas").select("id, nome").eq("empresa_id", empresaSelecionada).order("criado_em", { ascending: false }),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaSelecionada).order("nome"),
    supabase.from("parametros_pre_pedido").select("habilitado").eq("empresa_id", empresaSelecionada).maybeSingle(),
    Promise.all(irmas.map((e) => supabase.rpc("veiculos_da_empresa", { p_empresa_id: e.id }))),
    idsIrmas.length > 0
      ? supabase.from("motoristas").select("id, nome_completo, empresa_id").in("empresa_id", idsIrmas).order("nome_completo")
      : Promise.resolve({ data: [] as { id: string; nome_completo: string; empresa_id: string }[] }),
  ]);

  const prePedidoHabilitado = parametroPrePedidoData?.habilitado === true;

  const veiculosGrupo = resultadosVeiculosGrupo.flatMap((r, i) =>
    (r.data ?? [])
      .filter((v) => v.ativo !== false)
      .map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, autonomia: v.autonomia, empresaNome: irmas[i].nome }))
  );

  const veiculos = [
    ...(veiculosData ?? [])
      .filter((v) => v.ativo !== false)
      .map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, autonomia: v.autonomia })),
    ...veiculosGrupo,
  ];

  const motoristas = [
    ...(motoristasData ?? []),
    ...(motoristasGrupoData ?? []).map((m) => ({ id: m.id, nome_completo: m.nome_completo, empresaNome: nomePorEmpresaId.get(m.empresa_id) })),
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Plano de Viagem</h1>
      <PlanoViagemForm
        empresaId={empresaSelecionada}
        veiculos={veiculos}
        motoristas={motoristas}
        rotogramas={rotogramasData ?? []}
        rotasSalvas={rotasSalvasData ?? []}
        centrosCusto={centrosCustoData ?? []}
        prefill={prefill}
        prePedidoHabilitado={prePedidoHabilitado}
      />
      {empresas.length > 1 && (
        <p className="mt-4 text-xs text-slate-400">
          Criando para: <strong>{empresas.find((e) => e.id === empresaSelecionada)?.nome}</strong>
        </p>
      )}
    </div>
  );
}
