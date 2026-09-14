import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { sugerirContas, type ContaEmAberto } from "@/lib/conciliacaoBancaria";

// Extraído de conciliarAutomaticoAcao (src/app/(dashboard)/conciliacao-bancaria/actions.ts)
// na auditoria de automação (13/09/2026, pedido do Daniel) — o matching de
// alta confiança (valor + data + fornecedor, ver sugerirContas em
// conciliacaoBancaria.ts) rodava só quando alguém clicava "Conciliar
// automático" na tela. Isolado aqui, sem depender de cookies de sessão, pra
// poder ser chamado tanto pela Server Action (client com sessão do usuário,
// clique manual) quanto pelo cron diário (client admin, roda pra todas as
// empresas sozinho). NÃO duplica a lógica de matching nem de baixa — as duas
// chamadas passam pelo mesmo código.
export type ResultadoConciliacaoAutomatica = { empresaId: string; conciliados: number; candidatosAvaliados: number };

export async function conciliarAutomaticoParaEmpresa(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  autorLabel: string
): Promise<ResultadoConciliacaoAutomatica> {
  const [{ data: pendentesData }, { data: pagarData }, { data: receberData }] = await Promise.all([
    supabase
      .from("extrato_bancario_lancamentos")
      .select("id, data, descricao, valor, tipo")
      .eq("empresa_id", empresaId)
      .eq("status", "pendente"),
    supabase
      .from("contas_pagar")
      .select("id, credor_nome, descricao, valor_original, valor_pago, vencimento")
      .eq("empresa_id", empresaId)
      .in("status", ["aberto", "baixado_parcial"]),
    supabase
      .from("contas_receber")
      .select("id, devedor_nome, descricao, valor_original, valor_pago, vencimento")
      .eq("empresa_id", empresaId)
      .in("status", ["aberto", "baixado_parcial"]),
  ]);

  const contasPagar: ContaEmAberto[] = (pagarData ?? []).map((c) => ({
    id: c.id,
    nome: c.credor_nome ?? "Credor não identificado",
    descricao: c.descricao,
    saldoEmAberto: c.valor_original - c.valor_pago,
    vencimento: c.vencimento,
  }));
  const contasReceber: ContaEmAberto[] = (receberData ?? []).map((c) => ({
    id: c.id,
    nome: c.devedor_nome ?? "Devedor não identificado",
    descricao: c.descricao,
    saldoEmAberto: c.valor_original - c.valor_pago,
    vencimento: c.vencimento,
  }));

  let conciliados = 0;
  const candidatos = pendentesData ?? [];
  for (const l of candidatos) {
    const contaTipo: "contas_pagar" | "contas_receber" = l.tipo === "debito" ? "contas_pagar" : "contas_receber";
    const candidatas = l.tipo === "debito" ? contasPagar : contasReceber;
    const sugestoes = sugerirContas({ data: l.data, valor: Math.abs(l.valor), descricao: l.descricao }, candidatas);
    const altaConfianca = sugestoes.filter((s) => s.confianca === "alta");
    if (altaConfianca.length !== 1) continue;

    const conta = altaConfianca[0];
    const valorBaixa = Math.min(Math.abs(l.valor), conta.saldoEmAberto);
    if (valorBaixa <= 0) continue;

    const { error: erroBaixa } =
      contaTipo === "contas_pagar"
        ? await supabase.rpc("baixar_conta_pagar", {
            p_conta_id: conta.id,
            p_valor: valorBaixa,
            p_forma: "conciliacao_bancaria",
            p_observacao: "Conciliado automaticamente (alta confiança: valor + data + fornecedor).",
          })
        : await supabase.rpc("baixar_conta_receber", {
            p_conta_id: conta.id,
            p_valor: valorBaixa,
            p_forma: "conciliacao_bancaria",
            p_gateway_ref: null,
            p_observacao: "Conciliado automaticamente (alta confiança: valor + data + fornecedor).",
          });
    if (erroBaixa) continue;

    const { error: erroLancamento } = await supabase
      .from("extrato_bancario_lancamentos")
      .update({
        status: "conciliado",
        conciliado_com_tipo: contaTipo,
        conciliado_com_id: conta.id,
        conciliado_em: new Date().toISOString(),
        conciliado_por: autorLabel,
      })
      .eq("id", l.id);
    if (!erroLancamento) conciliados++;
  }

  return { empresaId, conciliados, candidatosAvaliados: candidatos.length };
}
