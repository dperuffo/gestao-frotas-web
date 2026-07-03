import Image from "next/image";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { rotuloNota, type Avaliacao } from "@/lib/avaliacoes";
import { FormularioAvaliacao } from "./_components/FormularioAvaliacao";

// Avaliação da plataforma pelo cliente — estrelas + observações, com a Logo
// FNI em destaque (mesmo espírito das telas de autenticação: reforçar que é
// um canal direto com a FNI). Fica dentro do dashboard (tema claro), então a
// logo funciona direto sobre o .card branco, sem precisar do tratamento de
// fundo escuro usado em /login, /mfa-setup e /cadastro.
export default async function AvaliarPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { user, empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: minhasAvaliacoes } = await supabase
    .from("avaliacoes")
    .select("id, empresa_id, user_email, estrelas, comentario, resposta_admin, respondido_por, respondido_em, criado_em")
    .eq("user_email", user?.email ?? "")
    .order("criado_em", { ascending: false });

  const historico = (minhasAvaliacoes ?? []) as Avaliacao[];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image
          src="/logo-fni.png"
          alt="Fleet Network Intelligence"
          width={1132}
          height={441}
          className="h-auto w-48"
        />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Avalie a plataforma</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sua opinião ajuda a FNI a melhorar a experiência de todos os clientes.
        </p>
      </div>

      <div className="card mb-8 p-6">
        {empresas.length > 1 && (
          <form className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Sobre qual cliente é esta avaliação? (opcional)
              </label>
              <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input">
                <option value="">Avaliação geral (sem vincular a um cliente)</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Selecionar
            </button>
          </form>
        )}
        <FormularioAvaliacao empresaId={empresaSelecionada} />
      </div>

      {historico.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Suas avaliações anteriores</h2>
          <div className="space-y-3">
            {historico.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        className={n <= a.estrelas ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                      />
                    ))}
                    <span className="ml-1 text-xs font-medium text-slate-500">{rotuloNota(a.estrelas)}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {a.criado_em ? new Date(a.criado_em).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
                {a.comentario && <p className="mt-2 text-sm text-slate-600">{a.comentario}</p>}
                {a.resposta_admin && (
                  <div className="mt-3 rounded-lg bg-frota-50 px-3 py-2">
                    <p className="text-xs font-semibold text-frota-700">Resposta da equipe FNI</p>
                    <p className="mt-1 text-sm text-slate-700">{a.resposta_admin}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
