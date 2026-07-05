import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase 27.56 — Dashboard do posto revendedor (segmento "Revenda").
//
// Achado real: todo mundo cai em /dashboard depois do login (ver
// src/app/login/actions.ts), mas essa página sempre foi 100% voltada pra
// Frota (veículos, motoristas, previsão de consumo, ranking de gasto) — um
// usuário posto nunca tinha nada relevante ali, e o item nem aparece no
// menuPosto. Esta é a versão pro lado Revenda: indicadores e negociações a
// partir de negociacoes_postos, que o posto já enxerga integralmente via
// RLS (sem precisar de nenhuma tabela ou política nova).
export async function DashboardPosto({
  empresaPostoId,
  nomeEmpresaSelecionada,
}: {
  empresaPostoId: string;
  nomeEmpresaSelecionada?: string;
}) {
  const supabase = await createClient();
  const hojeIso = new Date().toISOString().slice(0, 10);

  const [{ count: pendentes }, { count: vigentes }, { data: negociacoes }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_posto_id", empresaPostoId)
      .eq("status", "pendente_posto"),
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_posto_id", empresaPostoId)
      .eq("status", "aceita")
      .lte("vigencia_inicio", hojeIso)
      .gte("vigencia_fim", hojeIso),
    supabase
      .from("negociacoes_postos")
      .select(
        "id, status, cliente_nome, combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario, atualizado_em"
      )
      .eq("empresa_posto_id", empresaPostoId)
      .order("atualizado_em", { ascending: false })
      .limit(200),
  ]);

  const listaNegociacoes = negociacoes ?? [];
  const clientesAtivos = new Set(
    listaNegociacoes.filter((n) => n.status === "aceita").map((n) => n.cliente_nome ?? "")
  ).size;
  const volumeContratado = listaNegociacoes
    .filter(
      (n) =>
        n.status === "aceita" &&
        n.vigencia_inicio !== null &&
        n.vigencia_fim !== null &&
        n.vigencia_inicio <= hojeIso &&
        n.vigencia_fim >= hojeIso
    )
    .reduce((soma, n) => soma + (n.volume_minimo_mensal ?? 0), 0);

  const vigentesLista = listaNegociacoes
    .filter(
      (n) =>
        n.status === "aceita" &&
        n.vigencia_inicio !== null &&
        n.vigencia_fim !== null &&
        n.vigencia_inicio <= hojeIso &&
        n.vigencia_fim >= hojeIso
    )
    .slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão geral das suas negociações{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <Link href="/negociacoes" className="btn-primary">
          Ver negociações
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Aguardando sua resposta" valor={String(pendentes ?? 0)} />
        <Indicador label="Negociações vigentes" valor={String(vigentes ?? 0)} />
        <Indicador label="Clientes com negociação aceita" valor={String(clientesAtivos)} />
        <Indicador
          label="Volume mín. contratado/mês"
          valor={`${volumeContratado.toLocaleString("pt-BR")} L`}
        />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Negociações vigentes agora</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Vigência</th>
              <th className="px-4 py-3">Volume mín./mês</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vigentesLista.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{n.cliente_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{n.combustivel ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {n.vigencia_inicio && n.vigencia_fim
                    ? `${formatarDataBr(n.vigencia_inicio)} – ${formatarDataBr(n.vigencia_fim)}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.volume_minimo_mensal != null ? `${n.volume_minimo_mensal.toLocaleString("pt-BR")} L` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.preco_unitario != null
                    ? n.preco_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {vigentesLista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma negociação vigente no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {listaNegociacoes.some((n) => n.status === "pendente_posto") && (
        <div className="mt-6 card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Aguardando sua resposta</h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {listaNegociacoes
                .filter((n) => n.status === "pendente_posto")
                .slice(0, 10)
                .map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{n.cliente_nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STATUS_NEGOCIACAO_LABEL[n.status as StatusNegociacao] ?? n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                        Responder
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
