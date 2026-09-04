import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { STATUS_MULTA_LABEL, STATUS_MULTA_COR, GRAVIDADE_MULTA_LABEL } from "@/lib/multas";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { ClipboardList, AlertTriangle, Wallet } from "lucide-react";
import { GraficoMultas, type ItemStatus, type ItemRankingMotorista, type ItemValorMes } from "./_components/GraficoMultas";

type SearchParams = { empresa?: string; q?: string; status?: string };

// Fase Onda-2 (benchmark TicketLog, item #4) — Gestão de Multas, primeira
// versão. Ciclo: captura manual da multa (upload) -> indicação do condutor
// (sugestão vinda do vínculo Motorista<->Veículo já existente em
// Parâmetros de Uso) -> acompanhamento até pagar/recorrer, com alerta de
// prazo pro desconto de pagamento antecipado (ver actions.ts).
export default async function MultasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, q, status } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  type MultaLinha = {
    id: string;
    placa: string;
    numero_ait: string | null;
    data_infracao: string;
    data_limite_indicacao: string | null;
    descricao: string | null;
    gravidade: string | null;
    valor_original: number | null;
    valor_desconto: number | null;
    status: string;
    motorista_id: string | null;
    motoristas: { nome_completo: string } | null;
  };

  // Fase Auditoria-Paginacao (17/08/2026, risco médio) — achado real: cap
  // fixo de 200 sem UI de página 2, usado inclusive pra calcular os
  // indicadores do topo (pendentes, vencendo, valor em aberto) — cliente
  // com mais de 200 multas tinha indicadores errados, não só lista
  // incompleta. Busca em lotes de 1.000 até esgotar, mesmo padrão de
  // /veiculos (Fase 27.38).
  const LOTE_MULTAS = 1000;
  let multasRaw: MultaLinha[] = [];
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      let query = supabase
        .from("multas")
        .select(
          "id, placa, numero_ait, data_infracao, data_limite_indicacao, descricao, gravidade, valor_original, valor_desconto, status, motorista_id, motoristas(nome_completo)"
        )
        .eq("empresa_id", empresaSelecionada)
        .order("data_infracao", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_MULTAS - 1);
      if (status) query = query.eq("status", status);
      const { data: lote } = await query;
      const linhas = (lote ?? []) as unknown as MultaLinha[];
      if (linhas.length === 0) break;
      multasRaw.push(...linhas);
      if (linhas.length < LOTE_MULTAS) break;
      offsetBusca += LOTE_MULTAS;
    }
  }

  // Fase busca-generica-listas — mesmo padrão ?q= já usado em /veiculos,
  // /cotacoes etc.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const multas = termoBusca
    ? multasRaw.filter(
        (m) =>
          m.placa?.toLowerCase().includes(termoBusca) ||
          m.numero_ait?.toLowerCase().includes(termoBusca) ||
          m.descricao?.toLowerCase().includes(termoBusca) ||
          m.motoristas?.nome_completo?.toLowerCase().includes(termoBusca)
      )
    : multasRaw;

  const hoje = new Date().toISOString().slice(0, 10);
  const pendentesIndicacao = multasRaw.filter((m) => m.status === "pendente_indicacao").length;
  const vencendoEmBreve = multasRaw.filter(
    (m) => m.status === "pendente_indicacao" && m.data_limite_indicacao && m.data_limite_indicacao >= hoje
  ).length;
  const valorEmAberto = multasRaw
    .filter((m) => m.status !== "paga" && m.status !== "cancelada")
    .reduce((s, m) => s + (m.valor_desconto ?? m.valor_original ?? 0), 0);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — agregações do gráfico, todas
  // a partir do multasRaw já carregado (sem query nova).
  const statusMap = new Map<string, number>();
  for (const m of multasRaw) statusMap.set(m.status, (statusMap.get(m.status) ?? 0) + 1);
  const porStatus: ItemStatus[] = [...statusMap.entries()].map(([status, total]) => ({ status, total }));

  const motoristaMap = new Map<string, number>();
  for (const m of multasRaw) {
    const nome = m.motoristas?.nome_completo ?? "Sem indicação";
    const valor = m.valor_desconto ?? m.valor_original ?? 0;
    motoristaMap.set(nome, (motoristaMap.get(nome) ?? 0) + valor);
  }
  const rankingMotorista: ItemRankingMotorista[] = [...motoristaMap.entries()]
    .map(([motorista, valor]) => ({ motorista, valor }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)
    .reverse();

  const valorPorMesMap = new Map<string, number>();
  for (const m of multasRaw) {
    const mesRef = m.data_infracao.slice(0, 7);
    const valor = m.valor_desconto ?? m.valor_original ?? 0;
    valorPorMesMap.set(mesRef, (valorPorMesMap.get(mesRef) ?? 0) + valor);
  }
  const valorPorMes: ItemValorMes[] = [...valorPorMesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([mesRef, valor]) => {
      const [ano, mes] = mesRef.split("-");
      return { mes: `${mes}/${ano.slice(2)}`, valor };
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gestão de Multas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Captura, indicação de condutor e histórico de multas por veículo/motorista.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/multas/nova?empresa=${empresaSelecionada}`} className="btn-primary text-sm">
            + Nova Multa
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Placa, AIT, descrição ou motorista..."
            className="input text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="input text-sm">
            <option value="">Todos</option>
            {Object.entries(STATUS_MULTA_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver as multas da frota dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={ClipboardList} label="Pendentes de indicação" valor={String(pendentesIndicacao)} />
            <IndicadorColorido
              cor={vencendoEmBreve > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Prazo vencendo (7 dias)"
              valor={String(vencendoEmBreve)}
            />
            <IndicadorColorido
              cor="amber"
              icon={Wallet}
              label="Valor em aberto"
              valor={valorEmAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            />
          </div>

          <GraficoMultas porStatus={porStatus} rankingMotorista={rankingMotorista} valorPorMes={valorPorMes} />

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">AIT</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {multas.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 text-slate-600">{new Date(`${m.data_infracao}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <Link href={`/multas/${m.id}`} className="font-medium text-frota-600 hover:underline">
                        {m.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.numero_ait ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {m.descricao ?? "—"}
                      {m.gravidade && (
                        <span className="ml-2 text-xs text-slate-400">({GRAVIDADE_MULTA_LABEL[m.gravidade] ?? m.gravidade})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.motoristas?.nome_completo ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {(m.valor_desconto ?? m.valor_original)?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {m.data_limite_indicacao ? new Date(`${m.data_limite_indicacao}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_MULTA_COR[m.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUS_MULTA_LABEL[m.status] ?? m.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {multas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma multa encontrada para esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
