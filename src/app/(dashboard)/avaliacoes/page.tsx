import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rotuloNota } from "@/lib/avaliacoes";
import { RespostaAvaliacao } from "./_components/RespostaAvaliacao";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { ClipboardList, Clock } from "lucide-react";
import { GraficoAvaliacoes, type ItemDistribuicaoEstrelas, type ItemNotaMediaCliente } from "./_components/GraficoAvaliacoes";

// Painel interno de Avaliações — exclusivo do time FNI (perfil admin), pra
// acompanhar o feedback dos clientes e responder. Mesmo padrão de guarda de
// acesso já usado em /inteligencia-rede e /assinaturas (perfil_usuario_atual()
// como 2ª camada de defesa, já que RLS de `avaliacoes` também restringe
// SELECT geral ao admin).
export default async function AvaliacoesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador). Fale com um administrador se você
          precisa desses dados.
        </p>
      </div>
    );
  }

  const { data: avaliacoes, error } = await supabase
    .from("avaliacoes")
    .select("id, user_email, estrelas, comentario, resposta_admin, respondido_por, respondido_em, criado_em, empresas(nome)")
    .order("criado_em", { ascending: false });

  const listaCompleta = avaliacoes ?? [];
  const total = listaCompleta.length;
  const notaMedia = total > 0 ? listaCompleta.reduce((soma, a) => soma + a.estrelas, 0) / total : 0;
  const pendentes = listaCompleta.filter((a) => !a.resposta_admin).length;

  // Fase Plano-Graficos Onda 2 (04/09/2026) — agregações do gráfico, a
  // partir do listaCompleta já carregado (sem query nova).
  const distribuicaoMap = new Map<number, number>();
  for (const a of listaCompleta) distribuicaoMap.set(a.estrelas, (distribuicaoMap.get(a.estrelas) ?? 0) + 1);
  const distribuicaoEstrelas: ItemDistribuicaoEstrelas[] = [5, 4, 3, 2, 1].map((estrelas) => ({
    estrelas,
    total: distribuicaoMap.get(estrelas) ?? 0,
  }));

  const porClienteMap = new Map<string, { soma: number; qtd: number }>();
  for (const a of listaCompleta) {
    const nome = a.empresas?.nome ?? "Sem cliente vinculado";
    const atual = porClienteMap.get(nome) ?? { soma: 0, qtd: 0 };
    atual.soma += a.estrelas;
    atual.qtd += 1;
    porClienteMap.set(nome, atual);
  }
  const rankingNotaMediaClientes: ItemNotaMediaCliente[] = [...porClienteMap.entries()]
    .filter(([, v]) => v.qtd >= 2)
    .map(([cliente, v]) => ({ cliente, media: v.soma / v.qtd }))
    .sort((a, b) => a.media - b.media)
    .slice(0, 8);

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que crescem com o tempo — avaliações se acumulam a cada
  // feedback enviado por qualquer cliente da rede) — os indicadores acima
  // continuam olhando pra lista inteira; só a lista renderizada abaixo é
  // filtrada pela busca.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const lista = termoBusca
    ? listaCompleta.filter(
        (a) =>
          a.empresas?.nome?.toLowerCase().includes(termoBusca) ||
          a.user_email?.toLowerCase().includes(termoBusca) ||
          a.comentario?.toLowerCase().includes(termoBusca)
      )
    : listaCompleta;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Avaliações dos clientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Feedback enviado pelos clientes sobre a plataforma, com espaço pra responder direto.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar avaliações: {error.message}</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <IndicadorColorido cor="amber" icon={Star} label="Nota média" valor={notaMedia.toFixed(1)} ajudaChave="avaliacoes.nota" />
        <IndicadorColorido cor="sky" icon={ClipboardList} label="Total de avaliações" valor={String(total)} />
        <IndicadorColorido
          cor={pendentes > 0 ? "amber" : "green"}
          icon={Clock}
          label="Pendentes de resposta"
          valor={String(pendentes)}
        />
      </div>

      {listaCompleta.length > 0 && (
        <GraficoAvaliacoes distribuicao={distribuicaoEstrelas} rankingClientes={rankingNotaMediaClientes} />
      )}

      {listaCompleta.length > 0 && (
        <form className="mb-4">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por cliente, e-mail ou comentário..."
            className="input max-w-sm"
          />
        </form>
      )}

      <div className="space-y-3">
        {lista.map((a) => (
          <div key={a.id} className="card p-4 transition-colors hover:border-frota-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {a.empresas?.nome ?? "Sem cliente vinculado"}
                </p>
                <p className="text-xs text-slate-400">{a.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={16}
                      className={n <= a.estrelas ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-slate-500">{rotuloNota(a.estrelas)}</span>
                {!a.resposta_admin && <span className="badge-atencao">Pendente</span>}
              </div>
            </div>

            {a.comentario && <p className="mt-2 text-sm text-slate-600">{a.comentario}</p>}
            <p className="mt-1 text-xs text-slate-400">
              {a.criado_em ? new Date(a.criado_em).toLocaleString("pt-BR") : ""}
            </p>

            <RespostaAvaliacao avaliacaoId={a.id} respostaAtual={a.resposta_admin} />
          </div>
        ))}
        {lista.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-400">
            {termoBusca ? `Nenhuma avaliação encontrada para "${q}".` : "Nenhuma avaliação recebida ainda."}
          </p>
        )}
      </div>
    </div>
  );
}
