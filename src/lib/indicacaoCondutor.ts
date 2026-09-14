import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { empresaOuIrmaDoGrupo } from "@/lib/empresasGrupo";

// Auditoria de automação (13/09/2026, pedido do Daniel) — extraído de
// indicarCondutorAcao / MultaDetalhePage (src/app/(dashboard)/multas/[id]/
// page.tsx e .../actions.ts) pra poder ser chamado tanto pela tela (client
// com sessão do usuário, clique manual) quanto pelo cron diário (client
// admin, varre multas pendentes sozinho) — mesmo padrão já usado em
// conciliacaoAutomatica.ts. NÃO duplica a regra de negócio nas duas pontas.

// Resolve o(s) candidato(s) a condutor infrator pelo vínculo Motorista<->
// Veículo (parametros_vinculo_motorista_veiculo) ativo na data da infração.
// Retorna a lista de motorista_id — o chamador decide o que fazer com
// 0 (sem vínculo), 1 (candidato único, pode confirmar) ou 2+ (ambíguo,
// precisa decisão humana) candidatos. Antes isso vinha de um
// `.maybeSingle()` direto no page.tsx, que "resolvia" a ambiguidade calando
// o erro do Supabase (2+ linhas vira null) — aqui fica explícito.
export async function candidatosCondutorPorVinculoAcao(
  supabase: SupabaseClient<Database>,
  placa: string,
  dataInfracao: string
): Promise<string[]> {
  const { data } = await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .select("motorista_id")
    .eq("placa", placa)
    .eq("status", "Ativo")
    .lte("data_inicio", dataInfracao)
    .or(`data_fim.is.null,data_fim.gte.${dataInfracao}`);

  return (data ?? []).map((v) => v.motorista_id);
}

export type OrigemIndicacao = { autorLabel: string | null; automatico: boolean };

// Núcleo da confirmação de condutor — a mesma checagem de grupo econômico e
// o mesmo update em `multas` usados pelo clique manual (indicarCondutorAcao)
// e pelo cron de auto-indicação (candidato único, sem ambiguidade).
export async function indicarCondutorLogica(
  supabase: SupabaseClient<Database>,
  multaId: string,
  motoristaId: string,
  origem: OrigemIndicacao
): Promise<void> {
  const [{ data: multa }, { data: motorista }] = await Promise.all([
    supabase.from("multas").select("empresa_id").eq("id", multaId).maybeSingle(),
    supabase.from("motoristas").select("empresa_id").eq("id", motoristaId).maybeSingle(),
  ]);
  if (!multa) throw new Error("Multa não encontrada.");
  if (!motorista) throw new Error("Motorista não encontrado.");
  const pertenceAoGrupo = await empresaOuIrmaDoGrupo(supabase, multa.empresa_id, motorista.empresa_id);
  if (!pertenceAoGrupo) {
    throw new Error("Esse motorista não pertence à empresa da multa nem a uma empresa do mesmo grupo econômico.");
  }

  const { error } = await supabase
    .from("multas")
    .update({
      motorista_id: motoristaId,
      status: "indicada",
      indicado_em: new Date().toISOString(),
      indicado_por: origem.autorLabel,
      indicado_automaticamente: origem.automatico,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", multaId);

  if (error) throw new Error(error.message);
}
