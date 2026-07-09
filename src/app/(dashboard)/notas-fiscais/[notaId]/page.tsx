import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import BotaoBaixarPdfNotaLazy from "../_components/BotaoBaixarPdfNotaLazy";

// Fase 27.94 — detalhe de uma NF-e já validada/vinculada, acessível às 3
// visões (RLS de notas_fiscais_abastecimento já filtra por posto/cliente
// dono ou admin — mesmo padrão de /faturas-postos/[id]).
export default async function NotaFiscalPage({ params }: { params: Promise<{ notaId: string }> }) {
  const { notaId } = await params;
  const supabase = await createClient();

  const { data: nota } = await supabase
    .from("notas_fiscais_abastecimento")
    .select(
      "id, numero_nf, serie_nf, chave_acesso, data_emissao, cnpj_emitente, nome_emitente, cnpj_destinatario, nome_destinatario, produto_nome_xml, produto_codigo_anp, produto_descricao_anp, quantidade, valor_unitario, valor_total, abastecimento_id"
    )
    .eq("id", notaId)
    .maybeSingle();

  if (!nota) notFound();

  const { data: abastecimento } = await supabase
    .from("profrotas_abastecimentos")
    .select("data_abastecimento, veiculo_placa, motorista_nome")
    .eq("id", nota.abastecimento_id)
    .maybeSingle();

  return (
    <div>
      <Link href="/notas-fiscais" className="text-sm text-frota-600 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">NF-e Nº {String(nota.numero_nf).padStart(6, "0")}</h1>
        <p className="mt-1 text-sm text-slate-500">Série {nota.serie_nf} · Emitida em {formatarDataBr(nota.data_emissao)}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Emitente (posto)</p>
          <p className="mt-1 font-medium text-slate-900">{nota.nome_emitente}</p>
          <p className="text-xs text-slate-500">CNPJ: {nota.cnpj_emitente}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Destinatário (cliente)</p>
          <p className="mt-1 font-medium text-slate-900">{nota.nome_destinatario}</p>
          <p className="text-xs text-slate-500">CNPJ: {nota.cnpj_destinatario}</p>
        </div>
      </div>

      <div className="card mb-6 overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Item de combustível</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Código ANP</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 text-slate-700">{nota.produto_nome_xml}</td>
              <td className="px-4 py-3 text-slate-600">
                {nota.produto_codigo_anp} — {nota.produto_descricao_anp}
              </td>
              <td className="px-4 py-3 text-slate-600">{nota.quantidade.toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3 text-slate-600">{formatarMoeda(nota.valor_unitario)}</td>
              <td className="px-4 py-3 font-medium text-slate-700">{formatarMoeda(nota.valor_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mb-4 text-xs text-slate-400">Chave de acesso: {nota.chave_acesso}</p>

      <BotaoBaixarPdfNotaLazy
        nomeArquivo={`nfe-${nota.numero_nf}.pdf`}
        numeroNf={nota.numero_nf}
        serieNf={nota.serie_nf}
        chaveAcesso={nota.chave_acesso}
        dataEmissao={formatarDataBr(nota.data_emissao)}
        emitente={{ nome: nota.nome_emitente, cnpj: nota.cnpj_emitente }}
        destinatario={{ nome: nota.nome_destinatario, cnpj: nota.cnpj_destinatario }}
        produtoNome={nota.produto_nome_xml}
        produtoCodigoAnp={nota.produto_codigo_anp}
        produtoDescricaoAnp={nota.produto_descricao_anp}
        quantidade={nota.quantidade}
        valorUnitario={nota.valor_unitario}
        valorTotal={nota.valor_total}
        abastecimentoData={abastecimento ? formatarDataBr(abastecimento.data_abastecimento) : "—"}
        veiculoPlaca={abastecimento?.veiculo_placa ?? null}
        motoristaNome={abastecimento?.motorista_nome ?? null}
      />
    </div>
  );
}
