import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rotuloNota } from "@/lib/avaliacoes";
import { RespostaAvaliacao } from "./_components/RespostaAvaliacao";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// Painel interno de Avaliações — exclusivo do time FNI (perfil admin), pra
// acompanhar o feedback dos clientes e responder. Mesmo padrão de guarda de
// acesso já usado em /inteligencia-rede e /assinaturas (perfil_usuario_atual()
// como 2ª camada de defesa, já que RLS de `avaliacoes` também restringe
// SELECT geral ao admin).
export default async function AvaliacoesAdminPage() {
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

  const lista = avaliacoes ?? [];
  const total = lista.length;
  const notaMedia = total > 0 ? lista.reduce((soma, a) => soma + a.estrelas, 0) / total : 0;
  const pendentes = lista.filter((a) => !a.resposta_admin).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Avaliações dos clientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Feedback enviado pelos clientes sobre a plataforma, com espaço pra responder direto.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar avaliações: {error.message}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Nota média <AjudaIcon chave="avaliacoes.nota" />
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
            {notaMedia.toFixed(1)}
            <Star size={18} className="fill-amber-400 text-amber-400" />
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total de avaliações</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pendentes de resposta</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pendentes}</p>
        </div>
      </div>

      <div className="space-y-3">
        {lista.map((a) => (
          <div key={a.id} className="card p-4">
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
          <p className="card p-8 text-center text-sm text-slate-400">Nenhuma avaliação recebida ainda.</p>
        )}
      </div>
    </div>
  );
}
