import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_FATURA_LABEL, statusFaturaExibicao } from "@/lib/financeiroPostos";
import BotaoBaixarPdfFaturaLazy from "./_components/BotaoBaixarPdfFaturaLazy";
import type { ItemExtratoFaturaPdf } from "./_components/FaturaPdf";

// Fase 27.76 — pedido do Daniel: cada fatura precisa trazer um extrato dos
// abastecimentos incluídos no período, com botão pra gerar PDF (dados da
// fatura + abastecimentos). Rota nova e compartilhada (não só dentro de
// /financeiro-posto) porque a MESMA fatura é vista por dois lados — o posto
// que emitiu (empresa_posto_id) e o cliente que deve pagar
// (empresa_cliente_id) — e a RLS de faturas_postos (faturas_postos_leitura)
// já libera SELECT pras duas partes, sem precisar de rota duplicada.
export default async function DetalheFaturaPostoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fatura } = await supabase
    .from("faturas_postos")
    .select(
      "id, negociacao_id, empresa_posto_id, empresa_cliente_id, periodo_inicio, periodo_fim, vencimento, valor_total, volume_total, quantidade_abastecimentos, status, pago_em, cliente_nome"
    )
    .eq("id", id)
    .maybeSingle();

  if (!fatura) notFound();

  // posto_nome só existe denormalizado em negociacoes_postos (faturas_postos
  // só denormaliza cliente_nome) — evita join cross-tenant direto em
  // `empresas` (mesmo problema de RLS da Fase 27.68).
  const { data: negociacao } = await supabase
    .from("negociacoes_postos")
    .select("posto_nome")
    .eq("id", fatura.negociacao_id)
    .maybeSingle();

  const postoNome = negociacao?.posto_nome ?? "Posto";
  const clienteNome = fatura.cliente_nome ?? "Cliente";

  // Fase 27.79 — achado real (reportado pelo Daniel, extrato sempre vazio):
  // negociacoes_postos.posto_cnpj é gravado SEM formatação (normalizarCNPJ,
  // só dígitos), mas profrotas_abastecimentos.pv_cnpj vem formatado (com
  // pontuação, do robô de teste/integração) — uma comparação direta (=) sem
  // normalizar sempre falhava. Corrigido delegando pra RPC
  // abastecimentos_da_fatura, que normaliza os dois lados em SQL (mesma
  // lógica já usada pela RLS da tabela — não é SECURITY DEFINER, só reaproveita
  // a mesma comparação num único lugar).
  const { data: abastecimentosData } = await supabase.rpc("abastecimentos_da_fatura", { p_fatura_id: fatura.id });
  const abastecimentos = abastecimentosData ?? [];

  const hojeIso = new Date().toISOString().slice(0, 10);
  const statusExib = statusFaturaExibicao(fatura.status, fatura.vencimento, hojeIso);

  const itensPdf: ItemExtratoFaturaPdf[] = abastecimentos.map((a) => ({
    data: a.data_abastecimento ? formatarDataBr(a.data_abastecimento) : "—",
    motorista: a.motorista_nome ?? "—",
    placa: a.veiculo_placa ?? "—",
    combustivel: a.item_nome ?? "—",
    litros: a.item_quantidade ?? 0,
    precoUnitario: a.item_valor_unitario ?? 0,
    valorTotal: a.item_valor_total ?? 0,
  }));

  return (
    <div>
      <Link href="/financeiro-posto" className="text-sm text-frota-600 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Fatura — {postoNome}</h1>
          <p className="mt-1 text-sm text-slate-500">Cliente: {clienteNome}</p>
        </div>
        <BotaoBaixarPdfFaturaLazy
          nomeArquivo={`fatura-${postoNome.replace(/\s+/g, "-").toLowerCase()}-${fatura.periodo_inicio}.pdf`}
          postoNome={postoNome}
          clienteNome={clienteNome}
          periodoInicio={formatarDataBr(fatura.periodo_inicio)}
          periodoFim={formatarDataBr(fatura.periodo_fim)}
          vencimento={formatarDataBr(fatura.vencimento)}
          status={STATUS_FATURA_LABEL[statusExib]}
          valorTotal={fatura.valor_total}
          volumeTotal={fatura.volume_total}
          quantidadeAbastecimentos={fatura.quantidade_abastecimentos}
          itens={itensPdf}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Indicador label="Período" valor={`${formatarDataBr(fatura.periodo_inicio)} – ${formatarDataBr(fatura.periodo_fim)}`} />
        <Indicador label="Vencimento" valor={formatarDataBr(fatura.vencimento)} />
        <Indicador label="Status" valor={STATUS_FATURA_LABEL[statusExib]} />
        <Indicador label="Volume total" valor={`${fatura.volume_total.toLocaleString("pt-BR")} L`} />
        <Indicador label="Valor total" valor={formatarMoeda(fatura.valor_total)} />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Extrato de abastecimentos ({fatura.quantidade_abastecimentos})
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {abastecimentos.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">
                  {a.data_abastecimento ? formatarDataBr(a.data_abastecimento) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{a.motorista_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{a.veiculo_placa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{a.item_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {a.item_quantidade != null ? a.item_quantidade.toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {a.item_valor_unitario != null ? formatarMoeda(a.item_valor_unitario) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {a.item_valor_total != null ? formatarMoeda(a.item_valor_total) : "—"}
                </td>
              </tr>
            ))}
            {abastecimentos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento encontrado neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
