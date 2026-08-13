import { createClient } from "@/lib/supabase/server";
import { FAIXAS_AGING, diasEmAtraso } from "@/lib/financeiroPostos";
import { FormularioContaPagarAvulsa } from "./FormularioContaPagarAvulsa";
import { BotaoBaixarContaPagar, BotaoCancelarContaPagar } from "./BotaoBaixarContaPagar";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Wallet, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Fase Financeiro-ERP (26/07/2026, pedido do Daniel) — substitui o modelo
// antigo de ciclos/faturas_postos calculados pela FNI pra tudo que vem de
// um meio de pagamento de verdade (Ticket Log, Edenred, Veloe, RedeFrota,
// Valecard...): o provedor já fecha e envia a própria fatura pronta (ver
// POST /api/integracoes/faturas-meio-pagamento), a FNI só registra como
// contas a pagar. Mesmo desenho visual/matemático de SecaoContasReceberFretes
// (aging + agrupamento), espelhado pro lado "a pagar" — aqui agrupado por
// CREDOR (o meio de pagamento ou fornecedor) em vez de devedor, e com ações
// de baixa/cancelamento (contas_receber não precisa disso: é baixada pelo
// webhook do gateway de cobrança, contas_pagar não tem gateway próprio).
export async function SecaoContasPagar({ empresaId }: { empresaId: string }) {
  const supabase = await createClient();
  const hojeIso = new Date().toISOString().slice(0, 10);
  const inicioMesIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: contas } = await supabase
    .from("contas_pagar")
    .select("id, origem, credor_nome, credor_cnpj, descricao, valor_original, valor_pago, vencimento, status")
    .eq("empresa_id", empresaId)
    .in("status", ["aberto", "baixado_parcial"])
    .order("vencimento", { ascending: true })
    .limit(500);

  const abertas = contas ?? [];

  // Fase Fretes-Cancelamento-Pagamento (11/08/2026, pedido do Daniel:
  // "identificar no financeiro como uma perda, no contas a pagar") — status
  // 'perda' é lançado por cancelar_frete quando um frete com parcela já paga
  // ao motorista é cancelado. Diferente de 'cancelado' (que já existe nesta
  // tabela com o sentido OPOSTO — dívida cancelada ANTES de ser paga): aqui
  // o dinheiro já saiu e não tem mais volta, por isso seção própria, fora do
  // fluxo normal de "a pagar em aberto".
  const { data: perdasRaw } = await supabase
    .from("contas_pagar")
    .select("id, credor_nome, descricao, valor_original, vencimento")
    .eq("empresa_id", empresaId)
    .eq("status", "perda")
    .order("vencimento", { ascending: false })
    .limit(200);
  const perdas = perdasRaw ?? [];
  const totalPerdas = perdas.reduce((s, p) => s + p.valor_original, 0);

  const { data: contasDaEmpresa } = await supabase.from("contas_pagar").select("id").eq("empresa_id", empresaId);
  const idsContas = (contasDaEmpresa ?? []).map((c) => c.id);
  let pagoNoMes = 0;
  if (idsContas.length > 0) {
    const { data: baixas } = await supabase
      .from("contas_pagar_baixas")
      .select("valor, criado_em")
      .in("conta_pagar_id", idsContas)
      .gte("criado_em", inicioMesIso);
    pagoNoMes = (baixas ?? []).reduce((s, b) => s + b.valor, 0);
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

  const porCredor = new Map<string, { nome: string; quantidade: number; valor: number }>();
  for (const c of vencidas) {
    const chave = c.credor_cnpj ?? c.credor_nome ?? "sem-identificacao";
    const atual = porCredor.get(chave);
    if (atual) {
      atual.quantidade += 1;
      atual.valor += c.valor_original - c.valor_pago;
    } else {
      porCredor.set(chave, { nome: c.credor_nome ?? c.credor_cnpj ?? "Credor não identificado", quantidade: 1, valor: c.valor_original - c.valor_pago });
    }
  }
  const inadimplenciaPorCredor = Array.from(porCredor.values()).sort((a, b) => b.valor - a.valor);

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">💳 Contas a Pagar — Meios de Pagamento</h2>
        <p className="mt-1 text-xs text-slate-500">
          Faturas enviadas pelos meios de pagamento (Ticket Log, Edenred, Veloe, RedeFrota, Valecard...) com
          os abastecimentos atrelados, mais lançamentos avulsos. Veja{" "}
          <a href="/integracoes" className="text-frota-600 hover:underline">
            Integrações
          </a>{" "}
          para conectar um novo meio de pagamento.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <IndicadorColorido cor="amber" icon={Wallet} label="A pagar (em aberto)" valor={formatoMoeda.format(totalEmAberto)} />
        <IndicadorColorido
          cor={totalVencido > 0 ? "red" : "green"}
          icon={AlertTriangle}
          label="Vencido"
          valor={formatoMoeda.format(totalVencido)}
        />
        <IndicadorColorido cor="green" icon={CheckCircle2} label="Pago no mês" valor={formatoMoeda.format(pagoNoMes)} />
        <IndicadorColorido cor="red" icon={XCircle} label="Perdas (fretes cancelados)" valor={formatoMoeda.format(totalPerdas)} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Vencidas por credor</h3>
          {inadimplenciaPorCredor.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma conta vencida no momento.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1">Credor</th>
                  <th className="py-1 text-right">Qtd.</th>
                  <th className="py-1 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inadimplenciaPorCredor.map((d) => (
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

      <div className="card mb-4 overflow-x-auto p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Contas a pagar em aberto</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="py-1.5 pr-3">Credor</th>
              <th className="py-1.5 pr-3">Descrição</th>
              <th className="py-1.5 pr-3">Vencimento</th>
              <th className="py-1.5 pr-3 text-right">Saldo</th>
              <th className="py-1.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {abertas.map((c) => {
              const saldo = c.valor_original - c.valor_pago;
              const vencida = c.vencimento < hojeIso;
              return (
                <tr key={c.id} className="transition-colors hover:bg-frota-50/60">
                  <td className="py-2 pr-3 text-slate-700">{c.credor_nome ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{c.descricao ?? "—"}</td>
                  <td className={`py-2 pr-3 ${vencida ? "font-medium text-red-600" : "text-slate-500"}`}>
                    {formatarDataBr(c.vencimento)}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-900">{formatoMoeda.format(saldo)}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <BotaoBaixarContaPagar id={c.id} saldoEmAberto={saldo} />
                      <BotaoCancelarContaPagar id={c.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {abertas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Nenhuma conta a pagar em aberto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {perdas.length > 0 && (
        <div className="card mb-4 overflow-x-auto p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">
            ⚠️ Perdas — valores pagos a motoristas em fretes cancelados
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Fretes que já tiveram alguma parcela paga ao motorista e foram cancelados depois — o valor não é
            estornado automaticamente, fica registrado aqui como perda confirmada.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1.5 pr-3">Motorista</th>
                <th className="py-1.5 pr-3">Descrição</th>
                <th className="py-1.5 pr-3">Data</th>
                <th className="py-1.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perdas.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3 text-slate-700">{p.credor_nome ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.descricao ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{formatarDataBr(p.vencimento)}</td>
                  <td className="py-2 text-right font-medium text-red-600">{formatoMoeda.format(p.valor_original)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Lançar conta a pagar avulsa</h3>
        <FormularioContaPagarAvulsa empresaId={empresaId} />
      </div>
    </div>
  );
}
