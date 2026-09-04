import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { STATUS_NEGOCIACAO, STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";
import { formatarDataBr, formatarDataHoraBr } from "@/lib/utils";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app. Esta tela serve tanto o lado cliente
// quanto o lado posto (ver comentário acima) — o redesign cobre os dois de
// uma vez só.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Handshake, Clock, CheckCircle2, Calendar } from "lucide-react";
import { GraficoNegociacoes } from "./_components/GraficoNegociacoes";

type SearchParams = { empresa?: string; status?: string; q?: string };

// Fase 27.54 — "Vigentes" não é um status de verdade (é sempre "aceita" no
// banco); é um filtro derivado que também exige a vigência estar em curso
// HOJE (uma negociação aceita pode ter vigência já encerrada ou ainda não
// iniciada). Tratado como um valor sentinela separado de STATUS_NEGOCIACAO
// pra reaproveitar o mesmo padrão de abas/pills já usado pros status reais.
const FILTRO_VIGENTE = "vigente" as const;

// Fase 27.50 — Negociação com Postos Revendedores. Uma única tela serve os
// dois lados (cliente de frota e posto revendedor): o que muda é o "papel"
// de quem está olhando, derivado do segmento da empresa selecionada
// (Frota = cliente, Revenda = posto) — não do perfil do usuário, pra
// funcionar também pro admin trocando de empresa no seletor.
export default async function NegociacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, status, q } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  const souPosto = segmentoSelecionado === "Revenda";

  let negociacoes: {
    id: string;
    posto_cnpj: string;
    status: string;
    rodada_atual: number;
    criado_em: string;
    atualizado_em: string;
    atualizado_por: string | null;
    cliente_nome: string | null;
    posto_nome: string | null;
    vigencia_inicio: string | null;
    vigencia_fim: string | null;
  }[] = [];
  let erro: string | undefined;
  let totalVigentes = 0;
  // Fase 27.62 — "atualizado_por" guarda só o e-mail; o nome exibido é
  // resolvido à parte via usuarios_app, mesmo padrão de dashboard/layout.tsx
  // (nomeExibido = perfilUsuario?.nome || email — sem FK entre as tabelas,
  // o e-mail é a chave de junção universal).
  let nomePorEmail: Record<string, string> = {};

  const hojeIso = new Date().toISOString().slice(0, 10);

  if (empresaSelecionada) {
    // Fase 27.51 — achado real: o nome da CONTRAPARTE (cliente, do ponto de
    // vista do posto, ou vice-versa) vinha de um join do PostgREST pra
    // empresas, que respeita a RLS daquela tabela — e um usuário só enxerga
    // empresas das quais é membro. Isso deixava o nome sempre em branco pro
    // lado de fora da negociação. Corrigido lendo direto as colunas
    // denormalizadas cliente_nome/posto_nome (ver src/lib/negociacoesPostos.ts).
    // Fase Auditoria-Paginacao (17/08/2026, risco médio) — cap fixo de 500
    // alimentava os indicadores do topo (total, pendentes do meu lado,
    // aceitas). Busca em lotes de 1.000 até esgotar.
    const LOTE_NEGOCIACOES = 1000;
    let offsetBusca = 0;
    for (;;) {
      let query = supabase
        .from("negociacoes_postos")
        .select(
          "id, posto_cnpj, status, rodada_atual, criado_em, atualizado_em, atualizado_por, cliente_nome, posto_nome, vigencia_inicio, vigencia_fim"
        )
        .order("atualizado_em", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_NEGOCIACOES - 1);

      query = souPosto ? query.eq("empresa_posto_id", empresaSelecionada) : query.eq("empresa_cliente_id", empresaSelecionada);

      if (status === FILTRO_VIGENTE) {
        query = query.eq("status", "aceita").lte("vigencia_inicio", hojeIso).gte("vigencia_fim", hojeIso);
      } else if (status && (STATUS_NEGOCIACAO as readonly string[]).includes(status)) {
        query = query.eq("status", status as StatusNegociacao);
      }

      const resultado = await query;
      if (resultado.error) {
        erro = resultado.error.message;
        break;
      }
      const lote = (resultado.data ?? []) as typeof negociacoes;
      if (lote.length === 0) break;
      negociacoes.push(...lote);
      if (lote.length < LOTE_NEGOCIACOES) break;
      offsetBusca += LOTE_NEGOCIACOES;
    }

    const emailsAtualizadoPor = Array.from(
      new Set(negociacoes.map((n) => n.atualizado_por).filter((e): e is string => !!e))
    );
    if (emailsAtualizadoPor.length > 0) {
      const { data: usuarios } = await supabase
        .from("usuarios_app")
        .select("nome, email")
        .in("email", emailsAtualizadoPor);
      nomePorEmail = Object.fromEntries((usuarios ?? []).map((u) => [u.email, u.nome || u.email]));
    }

    // Contagem de vigentes à parte (indicador do topo) — independente da
    // aba/filtro selecionado no momento, pra sempre mostrar o número certo.
    let queryVigentes = supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("status", "aceita")
      .lte("vigencia_inicio", hojeIso)
      .gte("vigencia_fim", hojeIso);
    queryVigentes = souPosto
      ? queryVigentes.eq("empresa_posto_id", empresaSelecionada)
      : queryVigentes.eq("empresa_cliente_id", empresaSelecionada);
    const { count } = await queryVigentes;
    totalVigentes = count ?? 0;
  }

  const pendentesDoMeuLado = negociacoes.filter(
    (n) => n.status === (souPosto ? "pendente_posto" : "pendente_cliente")
  ).length;

  // Fase Plano-Graficos (04/09/2026, pedido do Daniel) — distribuição por
  // status + ranking das contrapartes com mais negociações, a partir de
  // `negociacoes` já carregado acima (sem query nova, não é afetado pelo
  // filtro de busca ?q= — visão geral do total).
  const porStatus = STATUS_NEGOCIACAO.map((s) => ({
    label: STATUS_NEGOCIACAO_LABEL[s],
    total: negociacoes.filter((n) => n.status === s).length,
  }));
  const contagemPorContraparte = new Map<string, number>();
  for (const n of negociacoes) {
    const nome = (souPosto ? n.cliente_nome : (n.posto_nome ?? n.posto_cnpj)) ?? "—";
    contagemPorContraparte.set(nome, (contagemPorContraparte.get(nome) ?? 0) + 1);
  }
  const topContrapartes = Array.from(contagemPorContraparte.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas com muitos registros) — filtra em memória pelo nome da
  // contraparte (cliente ou posto, dependendo de quem está olhando) ou pelo
  // CNPJ do posto, mesmo padrão de ?q= já usado em /veiculos e /motoristas.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const negociacoesFiltradas = termoBusca
    ? negociacoes.filter((n) => {
        const nomeContraparte = (souPosto ? n.cliente_nome : n.posto_nome) ?? "";
        return nomeContraparte.toLowerCase().includes(termoBusca) || n.posto_cnpj?.toLowerCase().includes(termoBusca);
      })
    : negociacoes;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {souPosto ? "Negociação com Clientes" : "Negociação com Postos Revendedores"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {souPosto
              ? "Propostas de fornecimento de combustível trocadas com seus clientes: vigência, volume mínimo e preço por litro."
              : "Vigência, combustível, volume mínimo e preço por litro negociados com os postos parceiros."}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/negociacoes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Nova negociação
          </Link>
        )}
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {souPosto ? "Empresa" : "Cliente"}
            </label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">{souPosto ? "Selecione..." : "Selecione um cliente..."}</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            {souPosto ? "Trocar" : "Filtrar"}
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="sky" icon={Handshake} label="Negociações" valor={String(negociacoes.length)} />
            <IndicadorColorido
              cor={pendentesDoMeuLado > 0 ? "amber" : "green"}
              icon={Clock}
              label={`Aguardando ${souPosto ? "você" : "sua resposta"}`}
              valor={String(pendentesDoMeuLado)}
            />
            <IndicadorColorido
              cor="green"
              icon={CheckCircle2}
              label="Aceitas"
              valor={String(negociacoes.filter((n) => n.status === "aceita").length)}
            />
            <IndicadorColorido cor="violet" icon={Calendar} label="Vigentes agora" valor={String(totalVigentes)} />
          </div>

          <GraficoNegociacoes
            porStatus={porStatus}
            topContrapartes={topContrapartes}
            tituloRanking={souPosto ? "Clientes com mais negociações (top 8)" : "Postos com mais negociações (top 8)"}
          />

          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={`/negociacoes?empresa=${empresaSelecionada}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Todos
            </Link>
            <Link
              href={`/negociacoes?empresa=${empresaSelecionada}&status=${FILTRO_VIGENTE}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${status === FILTRO_VIGENTE ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Vigentes
            </Link>
            {STATUS_NEGOCIACAO.map((s) => (
              <Link
                key={s}
                href={`/negociacoes?empresa=${empresaSelecionada}&status=${s}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {STATUS_NEGOCIACAO_LABEL[s]}
              </Link>
            ))}
          </div>

          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar negociações: {erro}</p>}

          <form className="mb-4">
            {/* Fase busca-generica-listas — form próprio, com cliente/empresa e
                status atuais em campos ocultos pra não se perderem da URL ao
                buscar (mesmo cuidado da Fase 27.31 em /veiculos). */}
            <input type="hidden" name="empresa" value={empresaSelecionada ?? ""} />
            <input type="hidden" name="status" value={status ?? ""} />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder={souPosto ? "Buscar por cliente..." : "Buscar por posto ou CNPJ..."}
              className="input max-w-sm"
            />
          </form>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{souPosto ? "Cliente" : "Posto"}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rodada</th>
                  <th className="px-4 py-3">Vigência</th>
                  <th className="px-4 py-3">Atualizado em</th>
                  <th className="px-4 py-3">Atualizado por</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {negociacoesFiltradas.map((n) => {
                  const hojeNaVigencia =
                    n.status === "aceita" &&
                    n.vigencia_inicio !== null &&
                    n.vigencia_fim !== null &&
                    n.vigencia_inicio <= hojeIso &&
                    n.vigencia_fim >= hojeIso;
                  return (
                    <tr key={n.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3 text-slate-700">
                        {souPosto ? (n.cliente_nome ?? "—") : (n.posto_nome ?? n.posto_cnpj)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {STATUS_NEGOCIACAO_LABEL[n.status as StatusNegociacao] ?? n.status}
                        </span>
                        {hojeNaVigencia && (
                          <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Vigente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">#{n.rodada_atual}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {n.vigencia_inicio && n.vigencia_fim
                          ? `${formatarDataBr(n.vigencia_inicio)} – ${formatarDataBr(n.vigencia_fim)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatarDataHoraBr(n.atualizado_em)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {n.atualizado_por ? (
                          <>
                            <span className="text-slate-700">{nomePorEmail[n.atualizado_por] ?? n.atualizado_por}</span>
                            <br />
                            <span className="text-xs text-slate-400">{n.atualizado_por}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {negociacoesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      {termoBusca ? `Nenhuma negociação encontrada para "${q}".` : "Nenhuma negociação encontrada."}
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
