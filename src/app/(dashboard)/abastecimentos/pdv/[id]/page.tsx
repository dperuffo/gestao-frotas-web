import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import { ROTULOS_FORMA_PAGAMENTO_PDV } from "@/lib/formasPagamentoPdv";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

// Fase 4 PDV (02/10/2026) — página de detalhe pro lado PDV da lista de
// /abastecimentos. Faltava: a lista estava linkando TODO provedor que não
// fosse "profrotas" nem "interno" pra /abastecimentos/externo/[id] (ver
// comentário em ../../page.tsx), que lê da tabela abastecimentos_externos
// — como o id do PDV (bigint de uma sequência própria) pode coincidir por
// acaso com o id de uma linha de abastecimentos_externos, isso mostrava os
// dados de OUTRO abastecimento completamente diferente (acusado pelo
// Daniel: "informações do mesmo abastecimento não batem"). Esta página lê
// da tabela certa (abastecimentos_pdv).
//
// Sem painel de "pedido de ajuste" ainda — ajustes_abastecimentos não tem
// coluna abastecimento_pdv_id hoje (só abastecimento_id/abastecimento_externo_id),
// então esse fluxo não existe pro lado PDV. Mostra só os dados, em modo
// leitura, com itens extra e forma de pagamento (que o lado externo nem
// tem, por não vir de uma venda feita no próprio PDV).
export default async function DetalheAbastecimentoPdvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: abastecimento } = await supabase
    .from("abastecimentos_pdv")
    .select(
      "id, codigo_abastecimento, status, empresa_id, revenda_empresa_id, placa, motorista_nome, motorista_cpf, bomba, bico, combustivel, litros, preco_litro, valor_total_combustivel, forma_pagamento, valor_total_itens_extra, valor_total_transacao, hodometro, motivo_negacao, data_abastecimento, confirmado_em, ajuste_status, ajuste_motivo, ajuste_lado_solicitante, ajuste_decidido_por, ajuste_decidido_em, pdv_terminais(identificacao)"
    )
    .eq("id", Number(id))
    .maybeSingle();
  if (!abastecimento) notFound();

  const [{ data: nomeCliente }, { data: nomePosto }, { data: itens }] = await Promise.all([
    abastecimento.empresa_id
      ? supabase.rpc("nome_empresa_publico", { p_empresa_id: abastecimento.empresa_id })
      : Promise.resolve({ data: null }),
    abastecimento.revenda_empresa_id
      ? supabase.rpc("nome_empresa_publico", { p_empresa_id: abastecimento.revenda_empresa_id })
      : Promise.resolve({ data: null }),
    supabase
      .from("abastecimentos_pdv_itens")
      .select("id, quantidade, valor_unitario, valor_total, produtos_servicos_pdv(nome)")
      .eq("abastecimento_pdv_id", abastecimento.id),
  ]);

  return (
    <div>
      <BotaoVoltar href="/abastecimentos" />
      <CabecalhoPagina
        titulo="Abastecimento"
        descricao={`ID ${abastecimento.codigo_abastecimento} · PDV`}
      />

      <ValoresCard abastecimento={abastecimento} nomeCliente={nomeCliente ?? null} nomePosto={nomePosto ?? null} />

      <div className="card mt-6 p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Itens extra</h2>
        {!itens || itens.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum item extra nesse abastecimento.</p>
        ) : (
          <div className="space-y-2">
            {itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  {item.quantidade}x {item.produtos_servicos_pdv?.nome ?? "Item"}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {item.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {abastecimento.status === "negado" && abastecimento.motivo_negacao && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-status-inativo dark:bg-red-950/40">
          Negado: {abastecimento.motivo_negacao}
        </p>
      )}

      {abastecimento.ajuste_status ? (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            abastecimento.ajuste_status === "recusado"
              ? "bg-red-50 text-status-inativo dark:bg-red-950/40"
              : abastecimento.ajuste_status === "pendente"
                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
          }`}
        >
          <p className="font-semibold">
            {abastecimento.ajuste_status === "pendente"
              ? "Em ajuste — pedido aguardando decisão"
              : abastecimento.ajuste_status === "aprovado"
                ? "Ajuste aprovado"
                : abastecimento.ajuste_status === "recusado"
                  ? "Ajuste recusado"
                  : "Pedido de ajuste cancelado"}
          </p>
          {abastecimento.ajuste_status !== "pendente" && (
            <p className="mt-1">
              {abastecimento.ajuste_decidido_por ? `Por ${abastecimento.ajuste_decidido_por}` : ""}
              {abastecimento.ajuste_decidido_em ? ` em ${formatarDataHoraBr(abastecimento.ajuste_decidido_em)}` : ""}
              {abastecimento.ajuste_motivo ? ` — Motivo: ${abastecimento.ajuste_motivo}` : ""}
            </p>
          )}
          <p className="mt-1 text-xs">
            Pedido feito pelo {abastecimento.ajuste_lado_solicitante === "posto" ? "posto" : "cliente"}. Histórico completo em{" "}
            <a href="/ajustes-pdv" className="underline">
              Pedidos de Ajuste (PDV)
            </a>
            .
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          Nenhum pedido de ajuste neste abastecimento. Para corrigir algo, peça o ajuste em Pedidos de Ajuste (PDV).
        </p>
      )}
    </div>
  );
}

type AbastecimentoPdv = {
  status: string;
  data_abastecimento: string | null;
  confirmado_em: string | null;
  placa: string | null;
  motorista_nome: string | null;
  motorista_cpf: string | null;
  hodometro: number | null;
  bomba: string | null;
  bico: string | null;
  combustivel: string | null;
  litros: number | null;
  preco_litro: number | null;
  valor_total_combustivel: number | null;
  forma_pagamento: string | null;
  valor_total_itens_extra: number;
  valor_total_transacao: number | null;
  ajuste_status?: string | null;
  pdv_terminais: { identificacao: string } | null;
};

function ValoresCard({
  abastecimento,
  nomeCliente,
  nomePosto,
}: {
  abastecimento: AbastecimentoPdv;
  nomeCliente: string | null;
  nomePosto: string | null;
}) {
  return (
    <div className="mb-6 card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Valores atuais</h2>
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <ValorAtual
          label="Status"
          valor={
            abastecimento.status === "confirmado"
              ? "Confirmado"
              : abastecimento.status === "negado"
                ? "Negado"
                : abastecimento.status
          }
        />
        <ValorAtual label="Data e hora" valor={formatarDataHoraBr(abastecimento.data_abastecimento)} />
        <ValorAtual label="Confirmado em" valor={formatarDataHoraBr(abastecimento.confirmado_em)} />
        <ValorAtual label="Placa" valor={abastecimento.placa ?? "—"} />
        <ValorAtual label="Motorista" valor={abastecimento.motorista_nome ?? "—"} />
        <ValorAtual label="CPF motorista" valor={abastecimento.motorista_cpf ?? "—"} />
        <ValorAtual
          label="Hodômetro"
          valor={abastecimento.hodometro != null ? `${abastecimento.hodometro.toLocaleString("pt-BR")} km` : "—"}
        />
        <ValorAtual label="Bomba / Bico" valor={`${abastecimento.bomba ?? "—"} / ${abastecimento.bico ?? "—"}`} />
        <ValorAtual label="Combustível" valor={abastecimento.combustivel ?? "—"} />
        <ValorAtual
          label="Litros"
          valor={abastecimento.litros != null ? `${abastecimento.litros.toLocaleString("pt-BR")} L` : "—"}
        />
        <ValorAtual
          label="Preço por litro"
          valor={
            abastecimento.preco_litro != null
              ? abastecimento.preco_litro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
        <ValorAtual
          label="Valor do combustível"
          valor={
            abastecimento.valor_total_combustivel != null
              ? abastecimento.valor_total_combustivel.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
        <ValorAtual
          label="Itens extra"
          valor={abastecimento.valor_total_itens_extra.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
        <ValorAtual
          label="Valor total"
          valor={
            abastecimento.valor_total_transacao != null
              ? abastecimento.valor_total_transacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
        <ValorAtual
          label="Forma de pagamento"
          valor={
            abastecimento.forma_pagamento
              ? ((ROTULOS_FORMA_PAGAMENTO_PDV as Record<string, string>)[abastecimento.forma_pagamento] ??
                abastecimento.forma_pagamento)
              : "—"
          }
        />
        <ValorAtual label="Terminal (caixa)" valor={abastecimento.pdv_terminais?.identificacao ?? "—"} />
        <ValorAtual label="Cliente" valor={nomeCliente ?? "—"} />
        <ValorAtual label="Posto" valor={nomePosto ?? "—"} />
      </div>
    </div>
  );
}

function ValorAtual({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-700 dark:text-slate-300">{valor}</p>
    </div>
  );
}
