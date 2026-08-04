import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConverterCotacaoButton } from "../_components/ConverterCotacaoButton";
import { DescartarCotacaoButton } from "../_components/DescartarCotacaoButton";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const LABEL_STATUS: Record<string, string> = {
  simulada: "Simulada",
  convertida: "Convertida em frete",
  descartada: "Descartada",
};

export default async function CotacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: cotacao } = await supabase.from("cotacoes").select("*").eq("id", id).maybeSingle();
  if (!cotacao) notFound();

  const empresaId = empresaParam ?? cotacao.empresa_id;

  const itens = [
    { label: "Frete-peso", valor: cotacao.valor_frete_peso },
    { label: "Ad valorem", valor: cotacao.valor_ad_valorem },
    { label: "GRIS", valor: cotacao.valor_gris },
    { label: "TDE", valor: cotacao.valor_tde },
    { label: "TDA", valor: cotacao.valor_tda },
    { label: "Taxa de despacho", valor: cotacao.valor_despacho },
    { label: "Pedágio", valor: cotacao.valor_pedagio },
    { label: "ICMS por dentro", valor: cotacao.valor_icms },
  ];

  return (
    <div>
      <BotaoVoltar href={`/cotacoes?empresa=${empresaId}`} label="Voltar para Cotações" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            🧮 {cotacao.origem_label} → {cotacao.destino_label}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {cotacao.peso_kg.toLocaleString("pt-BR")} kg
            {cotacao.km_estimado ? ` · ${cotacao.km_estimado.toLocaleString("pt-BR")} km` : ""}
          </p>
        </div>
        <span className={cotacao.status === "simulada" ? "badge-ativo" : "badge-inativo"}>{LABEL_STATUS[cotacao.status] ?? cotacao.status}</span>
      </div>

      {cotacao.piso_antt_alerta && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ O valor total desta cotação ({formatoMoeda.format(cotacao.valor_total)}) está{" "}
          <strong>abaixo do piso mínimo ANTT</strong> ({formatoMoeda.format(cotacao.piso_antt_valor ?? 0)}) pra essa
          distância/tipo de carga/nº de eixos — Res. 5.867/2020. Ajuste a tabela antes de converter em frete, se
          possível.
        </div>
      )}

      <div className="card mb-6 overflow-x-auto p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Composição do frete</h2>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {itens.map((item) => (
              <tr key={item.label}>
                <td className="py-2 text-slate-600">{item.label}</td>
                <td className="py-2 text-right font-medium text-slate-900">{formatoMoeda.format(item.valor)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-3 text-sm font-semibold text-slate-900">Valor total</td>
              <td className="py-3 text-right text-lg font-bold text-frota-700">{formatoMoeda.format(cotacao.valor_total)}</td>
            </tr>
          </tbody>
        </table>
        {cotacao.valor_carga > 0 && (
          <p className="mt-2 text-xs text-slate-500">Valor da carga (base ad valorem/GRIS): {formatoMoeda.format(cotacao.valor_carga)}</p>
        )}
        {cotacao.observacoes && <p className="mt-2 text-xs text-slate-500">Obs.: {cotacao.observacoes}</p>}
      </div>

      {cotacao.status === "simulada" && (
        <div className="card flex flex-wrap items-center gap-4 p-6">
          <ConverterCotacaoButton id={cotacao.id} empresaId={empresaId} />
          <DescartarCotacaoButton id={cotacao.id} empresaId={empresaId} />
        </div>
      )}

      {cotacao.status === "convertida" && cotacao.frete_id && (
        <div className="card p-6 text-sm">
          Esta cotação já virou frete.{" "}
          <Link href={`/fretes/${cotacao.frete_id}?empresa=${empresaId}`} className="font-medium text-frota-600 hover:underline">
            Ver frete →
          </Link>
        </div>
      )}
    </div>
  );
}
