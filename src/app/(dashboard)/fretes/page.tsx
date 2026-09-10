import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { verificarAcessoFretes, mensagemAcessoFretesBloqueado, type AcessoFretesResultado } from "@/lib/limitePlano";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { CancelarFreteButton } from "./_components/CancelarFreteButton";
import { ReabrirFreteButton } from "./_components/ReabrirFreteButton";
import { GraficoFretes } from "./_components/GraficoFretes";

// Fretes (Fase Fretes) — contratação de frete entre cliente e motorista.
// Modo direto (motorista já definido, próprio ou parceiro) fica
// "aguardando_confirmacao" até o motorista aceitar/recusar; modo mercado
// aberto fica "disponivel" pra rede toda propor valor (ver /fretes/[id]
// pra acompanhar as propostas recebidas).

type FreteRow = {
  id: string;
  titulo: string;
  status: string;
  // Fase Fretes-Público-Alvo (23/07/26) — alvo da solicitação no mercado
  // aberto: fora_base (rede/parceiros) ou base (motoristas próprios).
  publico_alvo: string;
  origem_label: string;
  destino_label: string;
  valor_oferecido: number;
  km_estimado: number | null;
  motorista_id: string | null;
  nome_motorista: string | null;
  telefone_motorista: string | null;
  criado_em: string;
  // Fase Fretes-Cancelamento-Pagamento (11/08/2026) — quanto já foi pago ao
  // motorista neste frete (relevante sobretudo pra aba Cancelados: mostra o
  // valor não recuperado direto no card, sem precisar abrir o detalhe).
  valor_pago_nao_recuperado: number;
  qtd_parcelas_pagas: number;
};

const LABEL_STATUS: Record<string, string> = {
  disponivel: "Disponível (mercado aberto)",
  aguardando_confirmacao: "Aguardando confirmação do motorista",
  aceito: "Aceito",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  recusado: "Recusado pelo motorista",
};

const COR_STATUS: Record<string, string> = {
  disponivel: "badge-ativo",
  aguardando_confirmacao: "text-xs font-medium text-status-atencao",
  aceito: "badge-ativo",
  em_andamento: "badge-ativo",
  concluido: "text-xs font-medium text-slate-500",
  cancelado: "badge-inativo",
  recusado: "badge-inativo",
};

// Fase Pente-Fino-Performance (10/09/2026, pedido do Daniel: "melhorar a
// performance da aplicacao como um todo") — achado real (auditoria): esta
// página buscava TODO o histórico de fretes da empresa (em lotes de 1000)
// em todo carregamento, só pra montar 4 abas de cards sem paginação
// nenhuma. Daniel escolheu resolver limitando cada aba aos 50 fretes mais
// recentes (RPC fretes_empresa_pagina, nova — ver migration
// pente_fino_performance_fretes_paginacao), com contagem/gráfico vindo de
// agregação SQL em vez de somar em memória depois de baixar tudo.
const LIMITE_POR_ABA = 50;
const GRUPOS_STATUS = ["negociacao", "andamento", "concluidos", "cancelados"] as const;
type GrupoStatus = (typeof GRUPOS_STATUS)[number];
const LABEL_GRUPO: Record<GrupoStatus, string> = {
  negociacao: "Em negociação",
  andamento: "Aceitos/Em andamento",
  concluidos: "Concluídos",
  cancelados: "Cancelados/Recusados",
};

export default async function FretesPage({ searchParams }: { searchParams: Promise<{ empresa?: string; q?: string }> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas com muitos registros) — filtra por título, origem/destino ou
  // motorista, mesmo padrão de ?q= já usado em /veiculos, /motoristas etc.
  // (agora aplicado na query, não em memória).
  const termoBusca = (q ?? "").trim();

  let porGrupo: Record<GrupoStatus, FreteRow[]> = { negociacao: [], andamento: [], concluidos: [], cancelados: [] };
  let contagens: Record<GrupoStatus, number> = { negociacao: 0, andamento: 0, concluidos: 0, cancelados: 0 };
  let porStatus: { label: string; total: number }[] = [];
  let topMotoristas: { nome: string; valor: number }[] = [];
  let acesso: AcessoFretesResultado = { ok: true };

  if (empresaSelecionada) {
    const [resultadosPorGrupo, contagensGrupo, indicadores, top, acessoResultado] = await Promise.all([
      Promise.all(
        GRUPOS_STATUS.map((grupo) =>
          supabase.rpc("fretes_empresa_pagina", {
            p_empresa_id: empresaSelecionada,
            p_status_grupo: grupo,
            p_busca: termoBusca || null,
            p_limite: LIMITE_POR_ABA,
          })
        )
      ),
      supabase.rpc("fretes_empresa_contagens_grupo", { p_empresa_id: empresaSelecionada, p_busca: termoBusca || null }),
      supabase.rpc("fretes_empresa_indicadores", { p_empresa_id: empresaSelecionada }),
      supabase.rpc("fretes_empresa_top_motoristas", { p_empresa_id: empresaSelecionada, p_limite: 8 }),
      verificarAcessoFretes(supabase, empresaSelecionada),
    ]);

    GRUPOS_STATUS.forEach((grupo, i) => {
      porGrupo[grupo] = (resultadosPorGrupo[i].data ?? []) as unknown as FreteRow[];
    });
    for (const linha of (contagensGrupo.data ?? []) as { status_grupo: GrupoStatus; total: number }[]) {
      contagens[linha.status_grupo] = linha.total;
    }
    porStatus = ((indicadores.data ?? []) as { status_grupo: GrupoStatus; total: number }[]).map((l) => ({
      label: LABEL_GRUPO[l.status_grupo],
      total: l.total,
    }));
    topMotoristas = (top.data ?? []) as { nome: string; valor: number }[];
    acesso = acessoResultado;
  }
  const acessoLiberado = acesso.ok;

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const negociacao = porGrupo.negociacao;
  const andamento = porGrupo.andamento;
  const concluidos = porGrupo.concluidos;
  const cancelados = porGrupo.cancelados;
  const totalGeral = porStatus.reduce((soma, s) => soma + s.total, 0);
  const totalFiltrado = contagens.negociacao + contagens.andamento + contagens.concluidos + contagens.cancelados;

  return (
    <div>
      <CabecalhoPagina
        titulo={
          <>
            <span className="mr-1.5">🚚</span>Fretes
          </>
        }
        descricao={`Publique fretes pra rede de motoristas negociar (estilo Uber) ou atribua direto a um motorista próprio ou parceiro.${nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}`}
        acoes={
          empresaSelecionada &&
          acessoLiberado && (
            <Link href={`/fretes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
              + Publicar frete
            </Link>
          )
        }
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
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
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {empresaSelecionada && !acesso.ok && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {mensagemAcessoFretesBloqueado(acesso)}{" "}
          <Link href={`/assinatura?empresa=${empresaSelecionada}`} className="font-medium underline">
            Ver planos
          </Link>
          . Fretes já publicados continuam visíveis abaixo.
        </div>
      )}

      {empresaSelecionada && totalGeral > 0 && (
        <form className="mb-4">
          <input type="hidden" name="empresa" value={empresaSelecionada} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por título, origem, destino ou motorista..."
            className="input max-w-sm"
          />
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e publicar fretes.</p>
      ) : totalGeral === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhum frete publicado ainda. Clique em &quot;+ Publicar frete&quot; pra começar.
        </div>
      ) : totalFiltrado === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhum frete encontrado para &quot;{q}&quot;.</div>
      ) : (
        <>
          <GraficoFretes porStatus={porStatus} topMotoristas={topMotoristas} />
          {/* Fase Pente-Fino-Performance — cada aba mostra só os 50 fretes
              mais recentes daquele grupo (ver LIMITE_POR_ABA); a contagem no
              nome da aba é o total real (pode ser maior que 50). */}
          <AbasPainel
          abas={[
            {
              id: "negociacao",
              label: `Em Negociação${contagens.negociacao > 0 ? ` (${contagens.negociacao})` : ""}`,
              conteudo: renderGrid(
                negociacao,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete em negociação no momento.",
                contagens.negociacao,
              ),
            },
            {
              id: "andamento",
              label: `Aceitos/Em Andamento${contagens.andamento > 0 ? ` (${contagens.andamento})` : ""}`,
              conteudo: renderGrid(
                andamento,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete aceito ou em andamento agora.",
                contagens.andamento,
              ),
            },
            {
              id: "concluidos",
              label: `Concluídos${contagens.concluidos > 0 ? ` (${contagens.concluidos})` : ""}`,
              conteudo: renderGrid(
                concluidos,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete concluído ainda.",
                contagens.concluidos,
              ),
            },
            {
              id: "cancelados",
              label: `Cancelados${contagens.cancelados > 0 ? ` (${contagens.cancelados})` : ""}`,
              conteudo: renderGrid(
                cancelados,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete cancelado ou recusado.",
                contagens.cancelados,
              ),
            },
          ]}
          />
        </>
      )}
    </div>
  );
}

// Fase Fretes-Cliente-3-Abas (19/07) — pedido do Daniel: mesma divisão em 3
// abas já feita no PWA Motorista (ver estrada-que-cuida/fretes_screen.dart),
// agora na visão do cliente: Em Negociação (mercado aberto + aguardando
// confirmação do motorista), Aceitos/Em Andamento e Concluídos (inclui
// cancelado/recusado, pra não sumir do histórico).
function renderGrid(
  lista: FreteRow[],
  empresaSelecionada: string,
  formatoMoeda: Intl.NumberFormat,
  mensagemVazio: string,
  totalReal: number,
) {
  if (lista.length === 0) {
    return <div className="card p-8 text-center text-sm text-slate-400">{mensagemVazio}</div>;
  }

  return (
    <div>
      {/* Fase Pente-Fino-Performance (10/09/2026) — cada aba busca só os
          LIMITE_POR_ABA mais recentes; quando o total real passa disso,
          avisa que a lista não é o histórico completo (use a busca por
          texto pra achar um frete específico mais antigo). */}
      {totalReal > lista.length && (
        <p className="mb-3 text-xs text-slate-400">
          Mostrando os {lista.length} mais recentes de {totalReal}. Use a busca acima pra achar um frete específico.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((f) => (
        <div key={f.id} className="card flex flex-col gap-3 p-5 transition hover:border-frota-300">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900">{f.titulo}</h3>
            <span className={COR_STATUS[f.status] ?? "badge-inativo"}>
              {f.status === "disponivel"
                ? f.publico_alvo === "base"
                  ? "Disponível — minha base"
                  : "Disponível — fora da base"
                : LABEL_STATUS[f.status] ?? f.status}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {f.origem_label} → {f.destino_label}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">{formatoMoeda.format(f.valor_oferecido)}</span>
            {f.km_estimado && <span className="text-slate-500">{f.km_estimado.toLocaleString("pt-BR")} km</span>}
          </div>
          {f.nome_motorista && (
            <p className="text-xs text-slate-500">
              Motorista: <span className="font-medium text-slate-700">{f.nome_motorista}</span>
            </p>
          )}

          {/* Fase Fretes-Cancelamento-Pagamento (11/08/2026) — só aparece
              quando há valor pago não recuperado (frete cancelado depois de
              já ter parcela paga ao motorista); reflete a mesma perda que
              está registrada em Contas a Pagar. */}
          {f.status === "cancelado" && f.valor_pago_nao_recuperado > 0 && (
            <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700">
              ⚠️ {formatoMoeda.format(f.valor_pago_nao_recuperado)} já pago ao motorista ({f.qtd_parcelas_pagas} parcela
              {f.qtd_parcelas_pagas === 1 ? "" : "s"}) — não recuperado, registrado como perda no Financeiro.
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 border-t border-dashed border-slate-300 pt-2 text-xs">
            {f.status !== "cancelado" && f.status !== "recusado" && (
              <Link href={`/fretes/${f.id}?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
                {f.status === "disponivel"
                  ? "Ver propostas"
                  : f.status === "concluido"
                    ? "Ver fotos e avaliar"
                    : "Ver detalhes"}
              </Link>
            )}
            {(f.status === "disponivel" || f.status === "aguardando_confirmacao" || f.status === "aceito") && (
              <CancelarFreteButton id={f.id} empresaId={empresaSelecionada} />
            )}
            {f.status === "recusado" && <ReabrirFreteButton id={f.id} empresaId={empresaSelecionada} />}
            {/* Fase Fretes-Público-Alvo — caminho pra recolocar pra base:
                frete fora da base ainda disponível ou recusado no direto
                (o card de recolocação fica na página de detalhe). */}
            {((f.status === "disponivel" && f.publico_alvo === "fora_base") || f.status === "recusado") && (
              <Link
                href={`/fretes/${f.id}?empresa=${empresaSelecionada}`}
                className="font-medium text-amber-700 hover:underline"
              >
                Recolocar pra base
              </Link>
            )}
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
