import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FAIXAS_AGING, diasEmAtraso } from "@/lib/financeiroPostos";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Fase P0.6 (plano FNI_Plano_Implementacao_P0.md) — painel /financeiro
// ampliado: aging de recebíveis (contas_receber, que hoje cobre faturas de
// frete + o que já existia de faturas de posto retro-alimentado — ver
// migração fase_p0_6_robo_faturas_postos_gera_conta_receber) e inadimplência
// por devedor. Mesmo padrão visual/matemático de FAIXAS_AGING/diasEmAtraso
// já usado em /financeiro-posto — só trocando a fonte de dados.
export async function SecaoContasReceberFretes({ empresaId }: { empresaId: string }) {
  const supabase = await createClient();
  const hojeIso = new Date().toISOString().slice(0, 10);
  const inicioMesIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: contas } = await supabase
    .from("contas_receber")
    .select("id, origem, devedor_nome, devedor_cnpj, valor_original, valor_pago, vencimento, status")
    .eq("empresa_id", empresaId)
    .in("status", ["aberto", "baixado_parcial"])
    .order("vencimento", { ascending: true })
    .limit(500);

  const abertas = contas ?? [];

  const { data: contasDaEmpresa } = await supabase.from("contas_receber").select("id").eq("empresa_id", empresaId);
  const idsContas = (contasDaEmpresa ?? []).map((c) => c.id);
  let recebidoNoMes = 0;
  if (idsContas.length > 0) {
    const { data: baixas } = await supabase
      .from("contas_receber_baixas")
      .select("valor, criado_em")
      .in("conta_receber_id", idsContas)
      .gte("criado_em", inicioMesIso);
    recebidoNoMes = (baixas ?? []).reduce((s, b) => s + b.valor, 0);
  }

  const totalEmAberto = abertas.reduce((s, c) => s + (c.valor_original - c.valor_pago), 0);
  const vencidas = abertas.filter((c) => c.vencimento < hojeIso);
  const totalVencido = vencidas.reduce((s, c) => s + (c.valor_original - c.valor_pago), 0);

  const aging = FAIXAS_AGING.map((faixa) => {
    const linhas = vencidas.filter((c) => {
      const dias = diasEmAtraso(c.vencimento, hojeIso);
      return dias >= faixa.min && dias <= faixa.max;
    });
    return { ...faixa, valor: linhas.reduce((s, c) => s + (c.valor_original - c.valor_pago), 0), quantidade: linhas.length };
  });

  const porDevedor = new Map<string, { nome: string; quantidade: number; valor: number }>();
  for (const c of vencidas) {
    const chave = c.devedor_cnpj ?? c.devedor_nome ?? "sem-identificacao";
    const atual = porDevedor.get(chave);
    if (atual) {
      atual.quantidade += 1;
      atual.valor += c.valor_original - c.valor_pago;
    } else {
      porDevedor.set(chave, { nome: c.devedor_nome ?? c.devedor_cnpj ?? "Devedor não identificado", quantidade: 1, valor: c.valor_original - c.valor_pago });
    }
  }
  const inadimplenciaPorDevedor = Array.from(porDevedor.values()).sort((a, b) => b.valor - a.valor);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">📄 Faturamento de Fretes — Contas a Receber</h2>
        <Link href={`/faturas-fretes?empresa=${empresaId}`} className="text-xs font-medium text-frota-600 hover:underline">
          Ver faturas de frete →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">A receber (em aberto)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatoMoeda.format(totalEmAberto)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Vencido (inadimplência)</p>
          <p className="mt-1 text-xl font-semibold text-red-600">{formatoMoeda.format(totalVencido)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recebido no mês</p>
          <p className="mt-1 text-xl font-semibold text-status-ativo">{formatoMoeda.format(recebidoNoMes)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Aging de vencidas</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1">Faixa</th>
                <th className="py-1 text-right">Qtd.</th>
                <th className="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aging.map((f) => (
                <tr key={f.chave}>
                  <td className="py-1.5 text-slate-600">{f.label}</td>
                  <td className="py-1.5 text-right text-slate-600">{f.quantidade}</td>
                  <td className="py-1.5 text-right font-medium text-slate-900">{formatoMoeda.format(f.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Inadimplência por devedor</h3>
          {inadimplenciaPorDevedor.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma conta vencida no momento.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1">Devedor</th>
                  <th className="py-1 text-right">Qtd.</th>
                  <th className="py-1 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inadimplenciaPorDevedor.map((d) => (
                  <tr key={d.nome}>
                    <td className="py-1.5 text-slate-600">{d.nome}</td>
                    <td className="py-1.5 text-right text-slate-600">{d.quantidade}</td>
                    <td className="py-1.5 text-right font-medium text-red-600">{formatoMoeda.format(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
