import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataHoraBr } from "@/lib/utils";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Paginacao, calcularPaginacao } from "@/components/Paginacao";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";
import { Truck, Coffee, BedDouble, AlertTriangle, Timer } from "lucide-react";
import { GraficoHorasDirigidas, type PontoJornada } from "./_components/GraficoHorasDirigidas";

const POR_PAGINA_REGISTRO = 20;

type SearchParams = { empresa?: string; inicio?: string; fim?: string; motorista?: string; page?: string };

type StatusAtual = {
  motorista_id: string;
  nome_completo: string;
  estado: "dirigindo" | "pausa" | "descanso" | "nunca_iniciado";
  ultimo_evento: string | null;
  desde: string | null;
  duracao_minutos: number | null;
  excedeu_limite: boolean;
};

type IndicadorDiario = {
  motorista_id: string;
  nome_completo: string;
  dia: string;
  horas_dirigidas: number;
  horas_pausa: number;
  horas_descanso: number;
  num_pausas: number;
  alertas_conducao_continua: number;
  alertas_descanso_insuficiente: number;
};

// Fase Painel-Jornada-Motorista (17/08/2026, pedido do Daniel: "senti falta
// de um relatório que traga os tempos registrados... como se fosse um
// tracking por motorista") — 1 linha por segmento (trecho contínuo
// dirigindo/pausa/descanso entre dois eventos consecutivos).
type RegistroDetalhado = {
  motorista_id: string;
  nome_completo: string;
  tipo_segmento: "dirigindo" | "pausa" | "descanso";
  inicio: string;
  fim: string;
  duracao_minutos: number;
  em_andamento: boolean;
};

function paraISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatarDuracao(minutos: number | null) {
  if (minutos === null) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const LABEL_ESTADO: Record<StatusAtual["estado"], string> = {
  dirigindo: "Dirigindo",
  pausa: "Em pausa",
  descanso: "Descansando",
  nunca_iniciado: "Nunca iniciou",
};

const COR_BADGE_ESTADO: Record<StatusAtual["estado"], string> = {
  dirigindo: "bg-green-100 text-green-800",
  pausa: "bg-amber-100 text-amber-800",
  descanso: "bg-sky-100 text-sky-800",
  nunca_iniciado: "bg-slate-100 text-slate-500",
};

const LABEL_SEGMENTO: Record<RegistroDetalhado["tipo_segmento"], string> = {
  dirigindo: "Dirigindo",
  pausa: "Pausa",
  descanso: "Descanso",
};

const COR_BADGE_SEGMENTO: Record<RegistroDetalhado["tipo_segmento"], string> = {
  dirigindo: "bg-green-100 text-green-800",
  pausa: "bg-amber-100 text-amber-800",
  descanso: "bg-sky-100 text-sky-800",
};

// Fase Painel-Jornada-Motorista (17/08/2026, pedido do Daniel: "crie um
// painel na visao do gestor, web e PWA, para controle da jornada do
// motorista, trazendo indicadores e graficos com os dados registrados nas
// jornadas dos motoristas dos clientes") — painel do gestor sobre os
// eventos que o motorista já registra no PWA (motoristas_jornada_eventos,
// agora com 4 tipos de evento — ver migração jornada_motorista_adiciona_
// eventos_pausa). Duas fontes:
// 1) jornada_motorista_status_atual — snapshot "ao vivo" (quem tá dirigindo/
//    em pausa/descansando agora, com alerta de quem já passou de 5h30 de
//    condução contínua sem parar — Lei do Motorista, 13.103/2015).
// 2) jornada_motorista_indicadores_diarios — histórico agregado por dia,
//    alimenta o gráfico e o ranking por motorista.
// Ambas RPCs são SECURITY INVOKER (dependem só do RLS já existente em
// motoristas_jornada_eventos/motoristas) — mesmo padrão seguro do resto do
// app, sem precisar bypassar RLS.
export default async function JornadaMotoristasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, inicio, fim, motorista: motoristaParam, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const agora = new Date();
  const inicioDefault = new Date(agora);
  inicioDefault.setDate(inicioDefault.getDate() - 30);
  const dataInicio = inicio || paraISO(inicioDefault);
  const dataFim = fim || paraISO(agora);

  const [
    { data: statusRaw, error: erroStatus },
    { data: diariosRaw, error: erroDiarios },
    { data: registroRaw, error: erroRegistro },
  ] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("jornada_motorista_status_atual", { p_empresa_id: empresaSelecionada }),
        supabase.rpc("jornada_motorista_indicadores_diarios", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
        }),
        supabase.rpc("jornada_motorista_registro_detalhado", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
        }),
      ])
    : [{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }];

  const statusAtual = (statusRaw ?? []) as StatusAtual[];
  const indicadoresDiarios = (diariosRaw ?? []) as IndicadorDiario[];
  const registroDetalhado = (registroRaw ?? []) as RegistroDetalhado[];
  const error = erroStatus ?? erroDiarios ?? erroRegistro;

  // Fase Painel-Jornada-Motorista (17/08/2026) — "tracking" por motorista:
  // lista de motoristas pro seletor (ordenada por nome, únicos), e os
  // segmentos do motorista escolhido, mais recentes primeiro (a RPC já
  // devolve nessa ordem).
  const motoristasParaSelecao = Array.from(new Map(statusAtual.map((s) => [s.motorista_id, s.nome_completo])).entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const registroDoMotorista = motoristaParam ? registroDetalhado.filter((r) => r.motorista_id === motoristaParam) : [];
  const nomeMotoristaSelecionado = motoristaParam
    ? (motoristasParaSelecao.find((m) => m.id === motoristaParam)?.nome ?? registroDoMotorista[0]?.nome_completo)
    : undefined;
  // Fase Tracking-Motorista-Paginacao-Export (18/08/2026, pedido do Daniel:
  // "colocar paginacao em tela e opcoes de exportar para PDF e excel") —
  // paginação client-agnóstica (mesmo componente Paginacao/calcularPaginacao
  // já usado em /veiculos etc.), e exportação (BotaoExportarTabela) sempre
  // com TODOS os segmentos do período, não só a página em tela.
  const { paginaAtual: paginaRegistro, totalPaginas: totalPaginasRegistro } = calcularPaginacao(
    registroDoMotorista.length,
    POR_PAGINA_REGISTRO,
    pageParam
  );
  const registroPaginado = registroDoMotorista.slice(
    (paginaRegistro - 1) * POR_PAGINA_REGISTRO,
    paginaRegistro * POR_PAGINA_REGISTRO
  );

  // Cards "ao vivo".
  const dirigindoAgora = statusAtual.filter((s) => s.estado === "dirigindo").length;
  const emPausaAgora = statusAtual.filter((s) => s.estado === "pausa").length;
  const descansandoAgora = statusAtual.filter((s) => s.estado === "descanso").length;
  const excedendoLimiteAgora = statusAtual.filter((s) => s.excedeu_limite);

  // Resumo do período (soma de todos os dias/motoristas).
  const resumoPeriodo = indicadoresDiarios.reduce(
    (acc, d) => ({
      horasDirigidas: acc.horasDirigidas + Number(d.horas_dirigidas ?? 0),
      alertasConducao: acc.alertasConducao + d.alertas_conducao_continua,
      alertasDescanso: acc.alertasDescanso + d.alertas_descanso_insuficiente,
      pausas: acc.pausas + d.num_pausas,
    }),
    { horasDirigidas: 0, alertasConducao: 0, alertasDescanso: 0, pausas: 0 }
  );

  // Gráfico: soma por dia, ordenado cronologicamente.
  const porDiaMap = new Map<string, { horasDirigidas: number; horasPausa: number; horasDescanso: number }>();
  for (const d of indicadoresDiarios) {
    const atual = porDiaMap.get(d.dia) ?? { horasDirigidas: 0, horasPausa: 0, horasDescanso: 0 };
    atual.horasDirigidas += Number(d.horas_dirigidas ?? 0);
    atual.horasPausa += Number(d.horas_pausa ?? 0);
    atual.horasDescanso += Number(d.horas_descanso ?? 0);
    porDiaMap.set(d.dia, atual);
  }
  const dadosGrafico: PontoJornada[] = Array.from(porDiaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => ({
      dia: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${dia}T12:00:00`)),
      horasDirigidas: Number(v.horasDirigidas.toFixed(1)),
      horasPausa: Number(v.horasPausa.toFixed(1)),
      horasDescanso: Number(v.horasDescanso.toFixed(1)),
    }));

  // Ranking por motorista no período — quem tem mais alertas de aderência
  // primeiro, depois mais horas dirigidas.
  const porMotoristaMap = new Map<
    string,
    {
      nome: string;
      horasDirigidas: number;
      horasPausa: number;
      horasDescanso: number;
      pausas: number;
      alertasConducao: number;
      alertasDescanso: number;
    }
  >();
  for (const d of indicadoresDiarios) {
    const atual = porMotoristaMap.get(d.motorista_id) ?? {
      nome: d.nome_completo,
      horasDirigidas: 0,
      horasPausa: 0,
      horasDescanso: 0,
      pausas: 0,
      alertasConducao: 0,
      alertasDescanso: 0,
    };
    atual.horasDirigidas += Number(d.horas_dirigidas ?? 0);
    atual.horasPausa += Number(d.horas_pausa ?? 0);
    atual.horasDescanso += Number(d.horas_descanso ?? 0);
    atual.pausas += d.num_pausas;
    atual.alertasConducao += d.alertas_conducao_continua;
    atual.alertasDescanso += d.alertas_descanso_insuficiente;
    porMotoristaMap.set(d.motorista_id, atual);
  }
  const rankingMotoristas = Array.from(porMotoristaMap.entries())
    .map(([motoristaId, v]) => ({ motoristaId, ...v }))
    .sort((a, b) => b.alertasConducao + b.alertasDescanso - (a.alertasConducao + a.alertasDescanso) || b.horasDirigidas - a.horasDirigidas);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Jornada dos Motoristas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Indicadores a partir dos horários de trabalho, pausa e descanso que os próprios motoristas registram no
          app — inclui alertas de aderência à Lei do Motorista (13.103/2015): condução contínua acima de 5h30 sem
          pausa, e descanso entre jornadas abaixo de 11h.
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
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className="input text-sm" />
        </div>
        {motoristasParaSelecao.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Registro detalhado de</label>
            <select name="motorista" defaultValue={motoristaParam ?? ""} className="input text-sm">
              <option value="">Selecione um motorista...</option>
              {motoristasParaSelecao.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver a jornada dos motoristas dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && (
        <>
          <div className="mb-3 mt-2">
            <h2 className="text-sm font-semibold text-slate-900">Agora</h2>
            <p className="text-xs text-slate-500">Estado atual de cada motorista, a partir do último evento registrado.</p>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="green" icon={Truck} label="Dirigindo agora" valor={String(dirigindoAgora)} />
            <IndicadorColorido cor="amber" icon={Coffee} label="Em pausa agora" valor={String(emPausaAgora)} />
            <IndicadorColorido cor="sky" icon={BedDouble} label="Descansando agora" valor={String(descansandoAgora)} />
            <IndicadorColorido
              cor={excedendoLimiteAgora.length > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Acima de 5h30 dirigindo"
              valor={String(excedendoLimiteAgora.length)}
            />
          </div>

          {excedendoLimiteAgora.length > 0 && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-medium">Atenção:</span>{" "}
              {excedendoLimiteAgora.map((s) => s.nome_completo).join(", ")} já {excedendoLimiteAgora.length === 1 ? "está" : "estão"} dirigindo
              há mais de 5h30 sem pausa.
            </div>
          )}

          <div className="mb-3 mt-6">
            <h2 className="text-sm font-semibold text-slate-900">Período selecionado</h2>
            <p className="text-xs text-slate-500">
              Soma de todas as jornadas registradas entre {new Date(`${dataInicio}T12:00:00`).toLocaleDateString("pt-BR")} e{" "}
              {new Date(`${dataFim}T12:00:00`).toLocaleDateString("pt-BR")}.
            </p>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="green" icon={Timer} label="Horas dirigidas" valor={`${resumoPeriodo.horasDirigidas.toFixed(0)}h`} />
            <IndicadorColorido cor="amber" icon={Coffee} label="Pausas realizadas" valor={String(resumoPeriodo.pausas)} />
            <IndicadorColorido
              cor={resumoPeriodo.alertasConducao > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Alertas de condução contínua"
              valor={String(resumoPeriodo.alertasConducao)}
              sub="Mais de 5h30 dirigindo sem pausa"
            />
            <IndicadorColorido
              cor={resumoPeriodo.alertasDescanso > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Alertas de descanso insuficiente"
              valor={String(resumoPeriodo.alertasDescanso)}
              sub="Menos de 11h entre jornadas"
            />
          </div>

          <div className="card mb-6 overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Horas por dia (dirigindo / pausa / descanso)</h3>
            </div>
            <GraficoHorasDirigidas dados={dadosGrafico} />
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Por motorista</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Estado agora</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3">Horas dirigidas (período)</th>
                  <th className="px-4 py-3">Pausas</th>
                  <th className="px-4 py-3">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingMotoristas.map((m) => {
                  const status = statusAtual.find((s) => s.motorista_id === m.motoristaId);
                  const totalAlertas = m.alertasConducao + m.alertasDescanso;
                  return (
                    <tr key={m.motoristaId} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{m.nome}</td>
                      <td className="px-4 py-3">
                        {status && (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COR_BADGE_ESTADO[status.estado]}`}>
                            {LABEL_ESTADO[status.estado]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{status ? formatarDuracao(status.duracao_minutos) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{m.horasDirigidas.toFixed(1)}h</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{m.pausas}</td>
                      <td className="px-4 py-3">
                        {totalAlertas > 0 ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">{totalAlertas}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rankingMotoristas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma jornada registrada no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card mt-6 overflow-x-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Registro detalhado (tracking){nomeMotoristaSelecionado ? ` — ${nomeMotoristaSelecionado}` : ""}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Cada linha é um trecho contínuo de condução, pausa ou descanso, com data/hora de início e fim, a
                  partir dos eventos registrados pelo motorista no app.
                </p>
              </div>
              {motoristaParam && registroDoMotorista.length > 0 && (
                <BotaoExportarTabela
                  nomeArquivo={`tracking-jornada-${(nomeMotoristaSelecionado ?? "motorista").toLowerCase().replace(/\s+/g, "-")}`}
                  titulo={`Registro detalhado de jornada — ${nomeMotoristaSelecionado ?? ""}`}
                  subtitulo={`Período: ${new Date(`${dataInicio}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${dataFim}T12:00:00`).toLocaleDateString("pt-BR")}`}
                  colunas={[
                    { header: "Tipo", chave: "tipo" },
                    { header: "Início", chave: "inicio" },
                    { header: "Fim", chave: "fim" },
                    { header: "Duração", chave: "duracao" },
                  ]}
                  linhas={registroDoMotorista.map((r) => ({
                    tipo: LABEL_SEGMENTO[r.tipo_segmento],
                    inicio: formatarDataHoraBr(r.inicio),
                    fim: r.em_andamento ? "Em andamento" : formatarDataHoraBr(r.fim),
                    duracao: formatarDuracao(r.duracao_minutos),
                  }))}
                />
              )}
            </div>
            {!motoristaParam ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Selecione um motorista no filtro acima para ver o registro detalhado.
              </p>
            ) : (
              <>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Início</th>
                      <th className="px-4 py-3">Fim</th>
                      <th className="px-4 py-3">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registroPaginado.map((r, i) => (
                      <tr key={`${r.motorista_id}-${r.inicio}-${i}`} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COR_BADGE_SEGMENTO[r.tipo_segmento]}`}>
                            {LABEL_SEGMENTO[r.tipo_segmento]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatarDataHoraBr(r.inicio)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.em_andamento ? (
                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Em andamento</span>
                          ) : (
                            formatarDataHoraBr(r.fim)
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">{formatarDuracao(r.duracao_minutos)}</td>
                      </tr>
                    ))}
                    {registroDoMotorista.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          Nenhum registro encontrado para esse motorista no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="px-4 pb-4">
                  <Paginacao
                    paginaAtual={paginaRegistro}
                    totalPaginas={totalPaginasRegistro}
                    totalRegistros={registroDoMotorista.length}
                    porPagina={POR_PAGINA_REGISTRO}
                    basePath="/jornada-motoristas"
                    paramsAtuais={{ empresa: empresaSelecionada ?? undefined, inicio: dataInicio, fim: dataFim, motorista: motoristaParam }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
