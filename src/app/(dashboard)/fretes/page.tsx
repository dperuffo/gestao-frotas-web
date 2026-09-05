import Link from "next/link";
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

export default async function FretesPage({ searchParams }: { searchParams: Promise<{ empresa?: string; q?: string }> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: essa RPC devolve 1
  // linha por frete (histórico completo, sem limite natural), sem
  // `.range()` — sujeita ao corte padrão de 1.000 linhas do PostgREST (mesmo
  // bug já corrigido em /veiculos, Fase 27.38). Busca em lotes de 1.000 até
  // esgotar.
  const LOTE_FRETES = 1000;
  let fretes: FreteRow[] = [];
  let acesso: AcessoFretesResultado = { ok: true };
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      const { data } = await supabase
        .rpc("meus_fretes_empresa", { p_empresa_id: empresaSelecionada })
        .range(offsetBusca, offsetBusca + LOTE_FRETES - 1);
      const lote = (data ?? []) as unknown as FreteRow[];
      if (lote.length === 0) break;
      fretes.push(...lote);
      if (lote.length < LOTE_FRETES) break;
      offsetBusca += LOTE_FRETES;
    }

    acesso = await verificarAcessoFretes(supabase, empresaSelecionada);
  }
  const acessoLiberado = acesso.ok;

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas com muitos registros) — filtra por título, origem/destino ou
  // motorista antes de dividir nas 3 abas, mesmo padrão de ?q= já usado em
  // /veiculos, /motoristas etc.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const fretesFiltrados = termoBusca
    ? fretes.filter((f) =>
        [f.titulo, f.origem_label, f.destino_label, f.nome_motorista]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(termoBusca))
      )
    : fretes;

  const negociacao = fretesFiltrados.filter((f) => f.status === "disponivel" || f.status === "aguardando_confirmacao");
  const andamento = fretesFiltrados.filter((f) => f.status === "aceito" || f.status === "em_andamento");
  const concluidos = fretesFiltrados.filter((f) => f.status === "concluido");
  // Fase Fretes-Cancelamento-Pagamento (11/08/2026, pedido do Daniel: "crie
  // uma aba de fretes cancelados para acomodar estes registros") — antes
  // ficavam misturados dentro de "Concluídos"; separados numa aba própria
  // pra dar visibilidade a quando houve pagamento não recuperado.
  const cancelados = fretesFiltrados.filter((f) => f.status === "cancelado" || f.status === "recusado");

  // Fase Plano-Graficos (05/09/2026, pedido do Daniel) — distribuição por
  // status + ranking de motoristas com mais valor em fretes concluídos, a
  // partir de `fretes` (todo o histórico, não afetado pelo filtro de busca
  // ?q= — visão geral do total), sem query nova.
  const porStatus = [
    { label: "Em negociação", total: fretes.filter((f) => f.status === "disponivel" || f.status === "aguardando_confirmacao").length },
    { label: "Aceitos/Em andamento", total: fretes.filter((f) => f.status === "aceito" || f.status === "em_andamento").length },
    { label: "Concluídos", total: fretes.filter((f) => f.status === "concluido").length },
    { label: "Cancelados/Recusados", total: fretes.filter((f) => f.status === "cancelado" || f.status === "recusado").length },
  ];
  const valorPorMotoristaMap = new Map<string, number>();
  for (const f of fretes) {
    if (f.status !== "concluido" || !f.nome_motorista) continue;
    valorPorMotoristaMap.set(f.nome_motorista, (valorPorMotoristaMap.get(f.nome_motorista) ?? 0) + f.valor_oferecido);
  }
  const topMotoristas = Array.from(valorPorMotoristaMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🚚 Fretes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Publique fretes pra rede de motoristas negociar (estilo Uber) ou atribua direto a um motorista próprio ou
            parceiro.
            {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && acessoLiberado && (
          <Link href={`/fretes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Publicar frete
          </Link>
        )}
      </div>

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

      {empresaSelecionada && fretes.length > 0 && (
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
      ) : fretes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhum frete publicado ainda. Clique em &quot;+ Publicar frete&quot; pra começar.
        </div>
      ) : fretesFiltrados.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhum frete encontrado para &quot;{q}&quot;.</div>
      ) : (
        <>
          <GraficoFretes porStatus={porStatus} topMotoristas={topMotoristas} />
          <AbasPainel
          abas={[
            {
              id: "negociacao",
              label: `Em Negociação${negociacao.length > 0 ? ` (${negociacao.length})` : ""}`,
              conteudo: renderGrid(
                negociacao,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete em negociação no momento.",
              ),
            },
            {
              id: "andamento",
              label: `Aceitos/Em Andamento${andamento.length > 0 ? ` (${andamento.length})` : ""}`,
              conteudo: renderGrid(
                andamento,
                empresaSelecionada,
                formatoMoeda,
                "Nenhum frete aceito ou em andamento agora.",
              ),
            },
            {
              id: "concluidos",
              label: `Concluídos${concluidos.length > 0 ? ` (${concluidos.length})` : ""}`,
              conteudo: renderGrid(concluidos, empresaSelecionada, formatoMoeda, "Nenhum frete concluído ainda."),
            },
            {
              id: "cancelados",
              label: `Cancelados${cancelados.length > 0 ? ` (${cancelados.length})` : ""}`,
              conteudo: renderGrid(cancelados, empresaSelecionada, formatoMoeda, "Nenhum frete cancelado ou recusado."),
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
) {
  if (lista.length === 0) {
    return <div className="card p-8 text-center text-sm text-slate-400">{mensagemVazio}</div>;
  }

  return (
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
  );
}
