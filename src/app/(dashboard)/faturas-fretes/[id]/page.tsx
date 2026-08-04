import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gerarQrCodePixDataUrl } from "@/lib/pix";
import { GerarCobrancaButton, MarcarFaturaFretePagaButton, CancelarFaturaFreteButton } from "../_components/AcoesFaturaFrete";
import BotaoBaixarPdfFaturaFreteLazy from "../_components/BotaoBaixarPdfFaturaFreteLazy";
import type { ItemFaturaFretePdf } from "../_components/FaturaFretePdf";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LABEL_STATUS: Record<string, string> = { aberta: "Aberta", paga: "Paga", cancelada: "Cancelada" };

export default async function FaturaFreteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: fatura } = await supabase.from("faturas_fretes").select("*").eq("id", id).maybeSingle();
  if (!fatura) notFound();

  const empresaId = empresaParam ?? fatura.empresa_id;

  const [{ data: itensRaw }, { data: conta }, { data: empresa }] = await Promise.all([
    supabase.from("faturas_fretes_itens").select("frete_cte_id, valor_prestacao").eq("fatura_frete_id", id),
    supabase
      .from("contas_receber")
      .select("id, status, valor_pago, gateway_ref, gateway_linha_digitavel, gateway_pix_copia_cola")
      .eq("origem", "fatura_frete")
      .eq("referencia_id", id)
      .maybeSingle(),
    supabase.from("empresas").select("nome, cnpj, logradouro, numero, bairro, municipio, uf, pix_chave").eq("id", fatura.empresa_id).maybeSingle(),
  ]);

  const cteIds = (itensRaw ?? []).map((i) => i.frete_cte_id);
  const { data: ctes } =
    cteIds.length > 0
      ? await supabase.from("fretes_cte").select("id, numero_cte, serie, data_emissao, chave_acesso").in("id", cteIds)
      : { data: [] as { id: string; numero_cte: string | null; serie: string | null; data_emissao: string | null; chave_acesso: string | null }[] };
  const cteById = new Map((ctes ?? []).map((c) => [c.id, c]));

  const itensPdf: ItemFaturaFretePdf[] = (itensRaw ?? []).map((i) => {
    const cte = cteById.get(i.frete_cte_id);
    return {
      numeroCte: cte?.numero_cte ?? null,
      serie: cte?.serie ?? null,
      dataEmissao: cte?.data_emissao ? new Date(cte.data_emissao).toLocaleDateString("pt-BR") : null,
      chaveAcesso: cte?.chave_acesso ?? null,
      valor: i.valor_prestacao,
    };
  });

  let qrCodePixDataUrl: string | null = null;
  if (conta?.gateway_pix_copia_cola) {
    qrCodePixDataUrl = await gerarQrCodePixDataUrl(conta.gateway_pix_copia_cola);
  }

  const enderecoEmpresa = empresa
    ? [empresa.logradouro, empresa.numero, empresa.bairro, empresa.municipio, empresa.uf].filter(Boolean).join(", ")
    : "";

  return (
    <div>
      <BotaoVoltar href={`/faturas-fretes?empresa=${empresaId}`} label="Voltar para Faturas de Frete" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            🧾 Fatura nº {String(fatura.numero_fatura).padStart(6, "0")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {fatura.tomador_nome ?? fatura.tomador_cnpj} · {new Date(`${fatura.periodo_inicio}T00:00:00`).toLocaleDateString("pt-BR")} –{" "}
            {new Date(`${fatura.periodo_fim}T00:00:00`).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span className={fatura.status === "aberta" ? "badge-ativo" : "badge-inativo"}>{LABEL_STATUS[fatura.status] ?? fatura.status}</span>
      </div>

      <div className="card mb-6 grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase text-slate-400">Vencimento</p>
          <p className="font-semibold text-slate-900">{new Date(`${fatura.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">CT-es</p>
          <p className="font-semibold text-slate-900">{fatura.quantidade_ctes}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Valor total</p>
          <p className="font-semibold text-slate-900">{formatoMoeda.format(fatura.valor_total)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Recebido</p>
          <p className="font-semibold text-slate-900">{formatoMoeda.format(conta?.valor_pago ?? 0)}</p>
        </div>
      </div>

      {fatura.status === "aberta" && (
        <div className="card mb-6 space-y-4 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Cobrança</h2>
          {!conta?.gateway_ref ? (
            <GerarCobrancaButton faturaId={fatura.id} empresaId={empresaId} />
          ) : (
            <div className="space-y-3">
              {conta.gateway_linha_digitavel && (
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Linha digitável (simulada)</p>
                  <p className="font-mono text-sm text-slate-800">{conta.gateway_linha_digitavel}</p>
                </div>
              )}
              {conta.gateway_pix_copia_cola && (
                <div className="flex flex-wrap items-center gap-4">
                  {qrCodePixDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL de QR gerado no servidor
                    <img src={qrCodePixDataUrl} alt="QR Code PIX" className="h-32 w-32 rounded border border-slate-200" />
                  )}
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">PIX Copia e Cola</p>
                    <p className="max-w-md break-all font-mono text-xs text-slate-600">{conta.gateway_pix_copia_cola}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-slate-300 pt-4">
            <MarcarFaturaFretePagaButton faturaId={fatura.id} empresaId={empresaId} />
            <CancelarFaturaFreteButton faturaId={fatura.id} empresaId={empresaId} />
          </div>
        </div>
      )}

      <div className="card mb-6 overflow-x-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">CT-es incluídos</h2>
          <BotaoBaixarPdfFaturaFreteLazy
            nomeArquivo={`fatura-frete-${fatura.numero_fatura}.pdf`}
            numeroFatura={fatura.numero_fatura}
            cedente={{ nome: empresa?.nome ?? "—", cnpj: empresa?.cnpj ?? "—", endereco: enderecoEmpresa }}
            sacado={{ nome: fatura.tomador_nome ?? "—", cnpj: fatura.tomador_cnpj, endereco: "" }}
            periodoInicio={new Date(`${fatura.periodo_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
            periodoFim={new Date(`${fatura.periodo_fim}T00:00:00`).toLocaleDateString("pt-BR")}
            vencimento={new Date(`${fatura.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}
            status={LABEL_STATUS[fatura.status] ?? fatura.status}
            valorTotal={fatura.valor_total}
            itens={itensPdf}
            linhaDigitavelSimulada={conta?.gateway_linha_digitavel}
            qrCodePixDataUrl={qrCodePixDataUrl}
          />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº / Série</th>
              <th className="px-4 py-3">Emissão</th>
              <th className="px-4 py-3">Chave de acesso</th>
              <th className="px-4 py-3">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itensPdf.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-slate-600">
                  {item.numeroCte ?? "—"} / {item.serie ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.dataEmissao ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.chaveAcesso ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatoMoeda.format(item.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
