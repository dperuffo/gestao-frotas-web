import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_CICLO_FATURA_LABEL, statusCicloFaturaExibicao } from "@/lib/financeiroPostos";
import { gerarPayloadPix, gerarQrCodePixDataUrl } from "@/lib/pix";
import BotaoBaixarPdfFaturaLazy from "./_components/BotaoBaixarPdfFaturaLazy";
import type { ItemExtratoFaturaPdf, ParteBoletoPdf } from "./_components/FaturaPdf";
import { BotaoVoltar } from "../../_components/BotaoVoltar";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app. Tela acessível
// às 3 visões (cliente, posto, admin) — redesenhar aqui cobre as 3 de vez.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Calendar, Clock, Activity, Droplet, Wallet } from "lucide-react";

function formatarEndereco(p: {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}): string {
  const partes = [
    [p.logradouro, p.numero].filter(Boolean).join(", "),
    p.complemento,
    p.bairro,
    p.municipio && p.uf ? `${p.municipio}/${p.uf}` : p.municipio,
    p.cep ? `CEP ${p.cep}` : null,
  ].filter(Boolean);
  return partes.join(" — ");
}

// Fase 27.76 — pedido do Daniel: cada fatura precisa trazer um extrato dos
// abastecimentos incluídos no período, com botão pra gerar PDF (dados da
// fatura + abastecimentos). Rota nova e compartilhada (não só dentro de
// /financeiro-posto) porque a MESMA fatura é vista por dois lados — o posto
// que emitiu (empresa_posto_id) e o cliente que deve pagar
// (empresa_cliente_id) — e a RLS de faturas_postos (faturas_postos_leitura)
// já libera SELECT pras duas partes, sem precisar de rota duplicada.
//
// Fase 27.92 — pedido do Daniel: documento no estilo boleto (baseado num PDF
// de referência), disponível ao final de cada ciclo fechado pra
// download/pagamento/quitação, com dados de cedente (posto) e sacado
// (cliente), número da fatura, e detalhamento dos abastecimentos — em
// TODAS as visões (cliente, posto, admin), que já acessam esta mesma rota.
export default async function DetalheFaturaPostoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fatura } = await supabase
    .from("faturas_postos")
    .select(
      "id, negociacao_id, empresa_posto_id, empresa_cliente_id, periodo_inicio, periodo_fim, vencimento, valor_total, volume_total, quantidade_abastecimentos, status, pago_em, cliente_nome, numero_fatura, data_geracao_boleto"
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

  // Fase 27.92 — dados completos de cedente/sacado (CNPJ + endereço), via
  // RPC SECURITY DEFINER com guarda manual (nem cliente nem posto são
  // "membros" da empresa da contraparte — mesmo problema de RLS cruzada já
  // resolvido em abastecimentos_da_fatura).
  const { data: dadosBoletoData } = await supabase.rpc("dados_boleto_fatura", { p_fatura_id: fatura.id });
  const dadosBoleto = dadosBoletoData?.[0] ?? null;

  const cedente: ParteBoletoPdf = {
    nome: dadosBoleto?.posto_nome ?? postoNome,
    cnpj: dadosBoleto?.posto_cnpj ?? "",
    endereco: dadosBoleto
      ? formatarEndereco({
          logradouro: dadosBoleto.posto_logradouro,
          numero: dadosBoleto.posto_numero,
          complemento: dadosBoleto.posto_complemento,
          bairro: dadosBoleto.posto_bairro,
          municipio: dadosBoleto.posto_municipio,
          uf: dadosBoleto.posto_uf,
          cep: dadosBoleto.posto_cep,
        })
      : "",
  };
  const sacado: ParteBoletoPdf = {
    nome: dadosBoleto?.cliente_nome ?? clienteNome,
    cnpj: dadosBoleto?.cliente_cnpj ?? "",
    endereco: dadosBoleto
      ? formatarEndereco({
          logradouro: dadosBoleto.cliente_logradouro,
          numero: dadosBoleto.cliente_numero,
          complemento: dadosBoleto.cliente_complemento,
          bairro: dadosBoleto.cliente_bairro,
          municipio: dadosBoleto.cliente_municipio,
          uf: dadosBoleto.cliente_uf,
          cep: dadosBoleto.cliente_cep,
        })
      : "",
  };

  // QR Code PIX (Fase 27.92) — só se o posto já cadastrou uma chave (ver
  // /minha-empresa). Gerado no servidor (o pacote `qrcode` roda em Node),
  // já como data URL, pra não precisar de estado assíncrono no botão de PDF
  // (client component).
  let qrCodePixDataUrl: string | null = null;
  if (dadosBoleto?.posto_pix_chave) {
    const payloadPix = gerarPayloadPix({
      chave: dadosBoleto.posto_pix_chave,
      nomeBeneficiario: cedente.nome,
      cidadeBeneficiario: dadosBoleto.posto_municipio ?? "BRASIL",
      valor: fatura.valor_total,
      txid: `FATURA${fatura.numero_fatura}`,
    });
    qrCodePixDataUrl = await gerarQrCodePixDataUrl(payloadPix);
  }

  const hojeIso = new Date().toISOString().slice(0, 10);
  const statusExib = statusCicloFaturaExibicao(fatura.status, fatura.vencimento, hojeIso);
  // Fase CICLOS-6 — enquanto a fatura está "fechada" (janela terminou, mas
  // o boleto ainda não foi gerado — esperando NFe das compras do período),
  // ainda não existe valor/boleto de verdade pra mostrar: PIX, PDF e o
  // detalhamento de valores ficam pra quando virar "a_vencer".
  const boletoJaGerado = fatura.status !== "fechada";

  const itensPdf: ItemExtratoFaturaPdf[] = abastecimentos.map((a) => ({
    data: a.data_abastecimento ? formatarDataBr(a.data_abastecimento) : "—",
    motorista: a.motorista_nome ?? "—",
    placa: a.veiculo_placa ?? "—",
    combustivel: a.item_nome ?? "—",
    litros: a.item_quantidade ?? 0,
    precoUnitario: a.item_valor_unitario ?? 0,
    valorTotal: a.item_valor_total ?? 0,
  }));

  const numeroFaturaFormatado = String(fatura.numero_fatura).padStart(6, "0");

  return (
    <div>
      <BotaoVoltar href="/financeiro-posto" />

      <div className="mt-3 mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Boleto — {postoNome}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Nº da fatura: <strong className="text-slate-700">{numeroFaturaFormatado}</strong> · Cliente: {clienteNome}
          </p>
        </div>
        {boletoJaGerado ? (
          <BotaoBaixarPdfFaturaLazy
            nomeArquivo={`boleto-${numeroFaturaFormatado}-${postoNome.replace(/\s+/g, "-").toLowerCase()}.pdf`}
            numeroFatura={fatura.numero_fatura}
            cedente={cedente}
            sacado={sacado}
            periodoInicio={formatarDataBr(fatura.periodo_inicio)}
            periodoFim={formatarDataBr(fatura.periodo_fim)}
            vencimento={formatarDataBr(fatura.vencimento)}
            status={STATUS_CICLO_FATURA_LABEL[statusExib]}
            valorTotal={fatura.valor_total}
            volumeTotal={fatura.volume_total}
            quantidadeAbastecimentos={fatura.quantidade_abastecimentos}
            itens={itensPdf}
            qrCodePixDataUrl={qrCodePixDataUrl}
          />
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
            Boleto ainda não gerado — previsto para {formatarDataBr(fatura.data_geracao_boleto)}
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cedente (posto)</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{cedente.nome}</p>
          <p className="text-xs text-slate-500">CNPJ: {cedente.cnpj || "—"}</p>
          <p className="text-xs text-slate-500">{cedente.endereco || "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sacado (cliente)</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{sacado.nome}</p>
          <p className="text-xs text-slate-500">CNPJ: {sacado.cnpj || "—"}</p>
          <p className="text-xs text-slate-500">{sacado.endereco || "—"}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <IndicadorColorido
          cor="sky"
          icon={Calendar}
          label="Período"
          valor={`${formatarDataBr(fatura.periodo_inicio)} – ${formatarDataBr(fatura.periodo_fim)}`}
        />
        <IndicadorColorido cor="violet" icon={Clock} label="Vencimento" valor={boletoJaGerado ? formatarDataBr(fatura.vencimento) : "—"} />
        <IndicadorColorido cor="green" icon={Activity} label="Status" valor={STATUS_CICLO_FATURA_LABEL[statusExib]} />
        <IndicadorColorido cor="sky" icon={Droplet} label="Volume total" valor={boletoJaGerado ? `${fatura.volume_total.toLocaleString("pt-BR")} L` : "—"} />
        <IndicadorColorido cor="violet" icon={Wallet} label="Valor total" valor={boletoJaGerado ? formatarMoeda(fatura.valor_total) : "—"} />
      </div>

      {!boletoJaGerado ? (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O ciclo de abastecimento já fechou, mas o boleto ainda não foi gerado — o sistema aguarda até{" "}
          {formatarDataBr(fatura.data_geracao_boleto)} pra dar tempo das notas fiscais dos abastecimentos chegarem.
          Volte depois dessa data pra ver o valor e o boleto completos.
        </div>
      ) : qrCodePixDataUrl ? (
        <div className="mb-6 card flex flex-wrap items-center gap-4 bg-green-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado no servidor, não é asset otimizável */}
          <img src={qrCodePixDataUrl} alt="QR Code PIX" className="h-24 w-24" />
          <div>
            <p className="text-sm font-semibold text-green-800">Pague com PIX</p>
            <p className="text-xs text-green-700">
              Aponte a câmera do app do seu banco pro QR Code, ou copie a chave: {dadosBoleto?.posto_pix_chave}
            </p>
            <p className="text-xs text-green-700">Valor: {formatarMoeda(fatura.valor_total)}</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O posto ainda não cadastrou uma chave PIX — pagamento a combinar diretamente com {cedente.nome}.
        </div>
      )}

      {boletoJaGerado && (
      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Detalhamento do abastecimento ({fatura.quantidade_abastecimentos})
          </h2>
          <p className="mt-1 text-xs text-slate-500">Abastecimentos que justificam o valor total cobrado.</p>
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
              <tr key={a.id} className="transition-colors hover:bg-frota-50/60">
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
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
