import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Aloca (ou realoca, ou desaloca — quando centroCustoId é null) um veículo a
// um centro de custo, mantendo o HISTÓRICO em centros_custo_veiculos: fecha
// a alocação ativa atual (data_fim = hoje) e abre uma nova, em vez de
// sobrescrever. Também sincroniza cadastro_veiculos.centro_custo_id/nome,
// que funciona como um cache da alocação "atual" usado pelo restante do
// app (formulário do veículo, filtros, etc.) sem precisar de join.
export async function alocarVeiculoCentroCusto(
  supabase: Supabase,
  params: {
    placa: string;
    centroCustoId: string | null;
    empresaId: string | null;
    criadoPor?: string;
  }
): Promise<{ erro?: string }> {
  const { placa, centroCustoId, empresaId, criadoPor } = params;
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: atual } = await supabase
    .from("centros_custo_veiculos")
    .select("id, centro_custo_id")
    .eq("placa", placa)
    .eq("ativo", true)
    .is("data_fim", null)
    .maybeSingle();

  // Já está no centro de custo pedido — nada a fazer (evita "churn" no
  // histórico ao salvar o formulário sem trocar o centro de custo).
  if ((atual?.centro_custo_id ?? null) === centroCustoId) {
    return {};
  }

  if (atual) {
    const { error } = await supabase
      .from("centros_custo_veiculos")
      .update({ data_fim: hoje, ativo: false })
      .eq("id", atual.id);
    if (error) return { erro: `Não foi possível encerrar a alocação anterior: ${error.message}` };
  }

  let nomeCentroCusto: string | null = null;
  if (centroCustoId) {
    const { data: cc } = await supabase.from("centros_custo").select("nome").eq("id", centroCustoId).maybeSingle();
    nomeCentroCusto = cc?.nome ?? null;

    const { error } = await supabase.from("centros_custo_veiculos").insert({
      centro_custo_id: centroCustoId,
      empresa_id: empresaId,
      placa,
      data_inicio: hoje,
      ativo: true,
      criado_por: criadoPor ?? "",
    });
    if (error) return { erro: `Não foi possível registrar a nova alocação: ${error.message}` };
  }

  const { error: erroVeiculo } = await supabase
    .from("cadastro_veiculos")
    .update({ centro_custo_id: centroCustoId, centro_custo_nome: nomeCentroCusto })
    .eq("placa", placa);
  if (erroVeiculo) return { erro: `Não foi possível atualizar o veículo: ${erroVeiculo.message}` };

  return {};
}
