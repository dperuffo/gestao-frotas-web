import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Rastreio de Carga | Gestão de Frotas",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Aguardando confirmação",
  aguardando_confirmacao: "Aguardando confirmação",
  aceito: "Aceito — a caminho da coleta",
  em_andamento: "Em trânsito",
  concluido: "Entregue",
  cancelado: "Cancelado",
  recusado: "Cancelado",
};

function formatarData(valor: string | null) {
  if (!valor) return null;
  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
}

// Fase Rastreio-Publico (27/08/2026, pedido do Daniel: "novas features de
// produto" — item do roadmap "Rastreamento público de carga"). Rota fora
// do grupo (dashboard) de propósito — sem cookie de sessão, sem menu, sem
// dado de outras telas. Liberada em src/lib/supabase/middleware.ts. Consome
// só a RPC pública rastreio_publico_frete(), que já filtra token
// válido/não expirado e só devolve campo seguro pra mostrar sem login (ver
// comentário grande na migration rastreio_publico_frete).
export default async function RastreioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("rastreio_publico_frete", { p_token: token });
  const frete = data?.[0];

  return (
    <div className="min-h-screen bg-frota-950 text-white">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: link direto no Server Component é o padrão suportado, o lint ainda assume Pages Router */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <nav className="flex items-center justify-between border-b border-white/10 px-[6%] py-5">
        <div className="text-lg font-bold">
          FNI <span className="text-frota-500">Gestão de Frotas</span>
        </div>
      </nav>

      <div className="mx-auto max-w-lg px-[6%] py-16">
        {!frete ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-xl font-semibold">Link de rastreio inválido ou expirado</h1>
            <p className="mt-2 text-sm text-slate-400">
              Peça pro transportador gerar um novo link de acompanhamento pra essa carga.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wide text-frota-500">Acompanhamento de carga</p>
            <h1 className="mt-1 text-2xl font-bold">{frete.titulo}</h1>

            <div className="mt-4 inline-flex rounded-full bg-frota-500/20 px-3 py-1 text-sm font-medium text-frota-300">
              {STATUS_LABEL[frete.status] ?? frete.status}
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-500">Origem</span>
                <span>{[frete.origem_cidade, frete.origem_uf].filter(Boolean).join("/") || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-500">Destino</span>
                <span>{[frete.destino_cidade, frete.destino_uf].filter(Boolean).join("/") || "—"}</span>
              </div>
              {frete.motorista_primeiro_nome && (
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-500">Motorista</span>
                  <span>{frete.motorista_primeiro_nome}</span>
                </div>
              )}
              {frete.data_saida_prevista && (
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-500">Saída prevista</span>
                  <span>{formatarData(frete.data_saida_prevista)}</span>
                </div>
              )}
              {frete.prazo_entrega && (
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-500">Prazo de entrega</span>
                  <span>{formatarData(frete.prazo_entrega)}</span>
                </div>
              )}
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Última atualização: {new Date(frete.atualizado_em).toLocaleString("pt-BR")}
            </p>
          </div>
        )}
      </div>

      <footer className="mt-16 border-t border-white/5 px-[6%] py-8 text-center text-sm text-slate-500">
        <p>© 2026 Fleet Network Intelligence Ltda. — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
