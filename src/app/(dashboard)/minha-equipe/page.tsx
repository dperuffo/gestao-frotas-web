import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaPropria } from "@/lib/empresaAtual";
import { verificarLimiteUsuarios } from "@/lib/limitePlano";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { ConvidarColegaForm } from "./_components/ConvidarColegaForm";
import { ToggleAtivoColega } from "./_components/ToggleAtivoColega";

type SearchParams = { empresa?: string };

type MembroEquipe = {
  user_email: string;
  ativo: boolean;
  nome: string | null;
  perfil: string;
};

// Fase Convite-Self-Service (26/07/2026, pedido do Daniel: "criar um
// convite self-service, cliente convida dentro do próprio plano de
// usuários, respeitando max_usuarios"). Tela do PRÓPRIO cliente/posto
// (gestor_frota ou posto) — diferente de /usuarios, que é exclusiva do
// time interno FNI e enxerga todas as empresas do sistema.
export default async function MinhaEquipePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: perfilAtual } = await supabase.rpc("perfil_usuario_atual");
  if (perfilAtual !== "gestor_frota" && perfilAtual !== "posto") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é para o gestor da frota ou o responsável pelo posto convidar colegas para a própria
          equipe.
        </p>
      </div>
    );
  }

  const { empresas, empresaSelecionada } = await resolverEmpresaPropria(supabase, empresaParam);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Minha Equipe</h1>
        <p className="mt-1 text-sm text-slate-500">
          Convide colegas para acessar o sistema junto com você. O que cada um pode ver e fazer é definido
          em{" "}
          <Link href="/permissoes" className="text-frota-600 hover:underline">
            Permissões
          </Link>
          .
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada?.id ?? ""} className="input text-sm">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada diretamente ao seu usuário."}
        </p>
      ) : (
        <ConteudoEquipe supabase={supabase} empresaId={empresaSelecionada.id} />
      )}
    </div>
  );
}

async function ConteudoEquipe({
  supabase,
  empresaId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  empresaId: string;
}) {
  const [limite, { data: membrosData }] = await Promise.all([
    verificarLimiteUsuarios(supabase, empresaId),
    // RPC dedicada (não um select direto) — RLS de usuarios_app não libera
    // ver nome/perfil de colegas pra quem não é admin/analista; ver
    // comentário na migração equipe_da_empresa_rpc.
    supabase.rpc("equipe_da_empresa", { p_empresa_id: empresaId }),
  ]);

  const membros: MembroEquipe[] = (membrosData ?? []).map((m) => ({
    user_email: m.email,
    ativo: m.ativo ?? true,
    nome: m.nome,
    perfil: m.perfil,
  }));

  const vagasEsgotadas = !limite.ok;

  return (
    <>
      <div className="mb-6 card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Vagas de usuário do plano</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {limite.quantidade} {limite.limite < 0 ? "" : `/ ${limite.limite}`}
        </p>
        {vagasEsgotadas && (
          <p className="mt-1 text-xs text-red-600">
            Vagas esgotadas —{" "}
            <Link href="/assinatura" className="underline">
              faça upgrade em Minha Assinatura
            </Link>{" "}
            para convidar mais colegas.
          </p>
        )}
      </div>

      <div className="mb-6 card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Convidar colega</h2>
        <p className="mb-4 text-xs text-slate-500">
          O convite vai por e-mail. O colega entra com perfil &quot;Colaborador&quot;.
        </p>
        <ConvidarColegaForm empresaId={empresaId} vagasEsgotadas={vagasEsgotadas} />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Equipe</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {membros.map((m) => (
              <tr key={m.user_email} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{m.nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{m.user_email}</td>
                <td className="px-4 py-3 text-slate-500">{PERFIL_LABEL[m.perfil as Perfil] ?? m.perfil}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}
                  >
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {m.perfil === "colaborador" && (
                    <ToggleAtivoColega empresaId={empresaId} email={m.user_email} ativo={m.ativo} />
                  )}
                </td>
              </tr>
            ))}
            {membros.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum colega convidado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
