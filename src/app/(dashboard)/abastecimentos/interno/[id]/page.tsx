import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

// Fase Abastecimento-Interno (21/08/2026, pedido do Daniel) — detalhe de um
// abastecimento feito na garagem própria do cliente (matriz/filial), origem
// "manual_web" (lançado por um gestor em /abastecimentos/novo) ou
// "pwa_motorista" (confirmado pelo motorista no app). Diferente de
// /abastecimentos/externo/[id]: não existe "contraparte" pra negociar ajuste
// (o posto interno é do próprio cliente) — por isso é só leitura, sem
// PainelAjusteAbastecimento.
export default async function EditarAbastecimentoInternoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: abastecimento } = await supabase
    .from("abastecimentos_internos")
    .select("*, postos_internos(nome)")
    .eq("id", Number(id))
    .maybeSingle();
  if (!abastecimento) notFound();

  const { data: nomeCliente } = await supabase.rpc("nome_empresa_publico", {
    p_empresa_id: abastecimento.empresa_id,
  });

  return (
    <div>
      <BotaoVoltar href="/abastecimentos" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimento Interno</h1>
        <p className="mt-1 text-xs text-slate-400">
          ID {abastecimento.id} · {abastecimento.origem === "pwa_motorista" ? "Confirmado pelo motorista (app)" : "Lançamento manual"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Abastecimento feito na garagem/tanque interno do cliente, sem posto revendedor externo
          envolvido — por isso não há fluxo de ajuste com contraparte aqui.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Valores</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <ValorAtual label="Data e hora" valor={formatarDataHoraBr(abastecimento.data_abastecimento)} />
          <ValorAtual label="Placa" valor={abastecimento.placa ?? "—"} />
          <ValorAtual label="Motorista" valor={abastecimento.motorista_nome ?? "—"} />
          <ValorAtual
            label="Hodômetro"
            valor={abastecimento.hodometro != null ? `${Number(abastecimento.hodometro).toLocaleString("pt-BR")} km` : "—"}
          />
          <ValorAtual label="Combustível" valor={abastecimento.combustivel} />
          <ValorAtual label="Quantidade" valor={`${Number(abastecimento.quantidade).toLocaleString("pt-BR")} L`} />
          <ValorAtual
            label="Preço unitário"
            valor={Number(abastecimento.valor_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          />
          <ValorAtual
            label="Valor total"
            valor={Number(abastecimento.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          />
          <ValorAtual label="Cliente" valor={nomeCliente ?? "—"} />
          <ValorAtual label="Posto interno" valor={abastecimento.postos_internos?.nome ?? "Posto Interno"} />
          {abastecimento.arla_quantidade != null && (
            <>
              <ValorAtual label="Arla32 — quantidade" valor={`${Number(abastecimento.arla_quantidade).toLocaleString("pt-BR")} L`} />
              <ValorAtual
                label="Arla32 — valor total"
                valor={Number(abastecimento.arla_valor_total ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ValorAtual({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-700">{valor}</p>
    </div>
  );
}
