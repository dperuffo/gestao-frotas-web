import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { STATUS_AGENDAMENTO_LABEL, STATUS_AGENDAMENTO_COR, TIPO_AGENDAMENTO_LABEL } from "@/lib/agendamentosPatio";
import { AcoesAgendamentoLinha } from "./_components/AcoesAgendamentoLinha";

// Fase agendamento-patio (04/08/2026, item 8 do benchmark FNI vs KMM, Grupo
// 2) — YMS leve: agenda do dia com todas as janelas de carga/descarga
// marcadas, pra enxergar de uma vez o que está previsto pra cada doca (e
// evitar cliente ligando "cadê meu caminhão" sem ninguém saber que horário
// foi combinado). A criação/edição de cada agendamento continua dentro de
// /fretes/[id] (onde o contexto do frete já existe); aqui é só a visão
// consolidada + confirmar/cancelar rápido.
type LinhaAgendamento = {
  id: string;
  tipo: string;
  doca: string | null;
  janela_inicio: string;
  janela_fim: string;
  status: string;
  observacoes: string | null;
  frete_id: string;
  fretes: { titulo: string; origem_label: string; destino_label: string } | null;
};

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function hojeIso(): string {
  const agora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export default async function AgendamentosPatioPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; data?: string }>;
}) {
  const { empresa: empresaParam, data: dataParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const dataSelecionada = dataParam || hojeIso();
  const inicioDia = `${dataSelecionada}T00:00:00`;
  const fimDia = `${dataSelecionada}T23:59:59.999`;

  let agendamentos: LinhaAgendamento[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase
      .from("agendamentos_patio")
      .select("id, tipo, doca, janela_inicio, janela_fim, status, observacoes, frete_id, fretes(titulo, origem_label, destino_label)")
      .eq("empresa_id", empresaSelecionada)
      .gte("janela_inicio", inicioDia)
      .lte("janela_inicio", fimDia)
      .order("janela_inicio");
    agendamentos = (data ?? []) as unknown as LinhaAgendamento[];
  }

  const agora = new Date();
  const atrasados = agendamentos.filter((a) => ["agendado", "confirmado"].includes(a.status) && new Date(a.janela_fim) < agora);
  const confirmados = agendamentos.filter((a) => a.status === "confirmado");
  const emAndamento = agendamentos.filter((a) => a.status === "em_andamento");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Agendamento de Pátio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Janelas de carga (coleta) e descarga (entrega) marcadas pros fretes do dia. Status &quot;em andamento&quot; e
          &quot;concluído&quot; são preenchidos sozinhos quando o motorista bate o checkpoint no app dele.
          {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
        </p>
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Dia</label>
          <input type="date" name="data" defaultValue={dataSelecionada} className="input text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Selecione um cliente pra ver a agenda de pátio dele.</p>
      )}

      {empresaSelecionada && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Agendamentos no dia</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{agendamentos.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Confirmados</p>
              <p className="mt-1 text-2xl font-semibold text-blue-700">{confirmados.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Em andamento</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{emAndamento.length}</p>
            </div>
            <div className={`card p-4 ${atrasados.length > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Atrasados</p>
              <p className={`mt-1 text-2xl font-semibold ${atrasados.length > 0 ? "text-red-700" : "text-slate-900"}`}>
                {atrasados.length}
              </p>
            </div>
          </div>

          {agendamentos.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nenhum agendamento pra este dia. Agende uma janela de carga/descarga dentro da tela de um{" "}
              <Link href={`/fretes?empresa=${empresaSelecionada}`} className="underline">
                frete
              </Link>
              .
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Horário</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Frete</th>
                    <th className="px-4 py-3">Doca</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {agendamentos.map((a) => {
                    const atrasado = ["agendado", "confirmado"].includes(a.status) && new Date(a.janela_fim) < agora;
                    return (
                      <tr key={a.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-700">
                          {formatarHora(a.janela_inicio)}–{formatarHora(a.janela_fim)}
                          {atrasado && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Atrasado</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{TIPO_AGENDAMENTO_LABEL[a.tipo] ?? a.tipo}</td>
                        <td className="px-4 py-3">
                          <Link href={`/fretes/${a.frete_id}?empresa=${empresaSelecionada}`} className="text-frota-700 hover:underline">
                            {a.fretes?.titulo ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.doca ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_AGENDAMENTO_COR[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {STATUS_AGENDAMENTO_LABEL[a.status] ?? a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <AcoesAgendamentoLinha id={a.id} freteId={a.frete_id} status={a.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
