import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanoViagemForm } from "../../_components/PlanoViagemForm";

export default async function EditarPlanoViagemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plano } = await supabase.from("planos_viagem").select("*").eq("id", id).single();
  if (!plano) notFound();

  const [
    { data: pedagiosData },
    { data: veiculosData },
    { data: motoristasData },
    { data: rotogramasData },
    { data: rotasSalvasData },
    { data: centrosCustoData },
    { data: prePedidoData },
  ] = await Promise.all([
    supabase.from("planos_viagem_pedagios").select("praca_nome, valor").eq("plano_viagem_id", id).order("ordem"),
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: plano.empresa_id }),
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", plano.empresa_id).order("nome_completo"),
    supabase.from("rotogramas").select("id, numero, origem, destino").eq("empresa_id", plano.empresa_id).order("numero", { ascending: false }),
    supabase.from("rotas_salvas").select("id, nome").eq("empresa_id", plano.empresa_id).order("criado_em", { ascending: false }),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", plano.empresa_id).order("nome"),
    supabase
      .from("pre_pedidos")
      .select("id, numero, status, pre_pedidos_paradas(id, ordem, posto_cnpj, posto_nome, km_previsto, litros_previstos, atendido, atendido_em)")
      .eq("plano_viagem_id", id)
      .maybeSingle(),
  ]);

  const veiculos = (veiculosData ?? [])
    .filter((v) => v.ativo !== false)
    .map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, autonomia: v.autonomia }));

  const prePedido = prePedidoData
    ? {
        ...prePedidoData,
        paradas: [...prePedidoData.pre_pedidos_paradas].sort((a, b) => a.ordem - b.ordem),
      }
    : null;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Plano de Viagem — {plano.nome}</h1>

      {prePedido && (
        <div className="mb-6 rounded-lg border border-frota-200 bg-frota-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-frota-800">
              Pré-Pedido nº {prePedido.numero}
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-normal text-frota-600">
                {prePedido.status === "ativo" ? "Ativo" : prePedido.status === "concluido" ? "Concluído" : "Cancelado"}
              </span>
            </h2>
          </div>
          <p className="mt-1 text-xs text-frota-600">
            Gerado automaticamente a partir da rota calculada. Os postos abaixo têm autorização pré-agendada pra
            abastecer este veículo — o parâmetro de uso &quot;Pré-Pedido&quot; restringe abastecimentos fora desta
            lista.
          </p>
          <ul className="mt-3 space-y-1.5">
            {prePedido.paradas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">
                  <strong>{p.posto_nome ?? p.posto_cnpj}</strong>
                  {p.km_previsto != null && <span className="text-slate-400"> · km {p.km_previsto}</span>}
                  {p.litros_previstos != null && <span className="text-slate-400"> · {p.litros_previstos} L previstos</span>}
                </span>
                <span
                  className={
                    p.atendido
                      ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                  }
                >
                  {p.atendido ? "Abastecido" : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PlanoViagemForm
        empresaId={plano.empresa_id}
        plano={plano}
        pedagiosIniciais={pedagiosData ?? []}
        veiculos={veiculos}
        motoristas={motoristasData ?? []}
        rotogramas={rotogramasData ?? []}
        rotasSalvas={rotasSalvasData ?? []}
        centrosCusto={centrosCustoData ?? []}
      />
    </div>
  );
}
