import { createClient } from "@/lib/supabase/server";
import { PERFIS, PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { TogglePermissao } from "./_components/TogglePermissao";

// Deixa "aba_dashboard" -> "Aba: Dashboard" e "func_exportar" -> "Função: Exportar",
// só para ficar mais legível na tela. Não muda nada no banco.
function formatarFuncionalidade(nome: string) {
  if (nome.startsWith("aba_")) {
    return `Aba: ${humanizar(nome.slice(4))}`;
  }
  if (nome.startsWith("func_")) {
    return `Função: ${humanizar(nome.slice(5))}`;
  }
  return humanizar(nome);
}

function humanizar(texto: string) {
  return texto
    .split("_")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

export default async function PermissoesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase 27 — trava de segurança: descobre o perfil de quem está olhando a
  // tela pra decidir quais colunas mostrar. PERFIS já vem ordenado do mais
  // pro menos privilegiado (admin, gestor_frota, analista, posto), então
  // "meu nível ou abaixo" é simplesmente o array a partir do meu índice.
  // A trava de verdade é a RLS de permissoes_perfil (nivel_perfil()), que já
  // bloqueia a leitura/escrita da linha "admin" para quem não é admin — o
  // filtro aqui é só pra não desenhar uma coluna "Administrador" vazia (tudo
  // desligado) pra quem não tem esse dado liberado, o que seria enganoso.
  const { data: perfilUsuario } = await supabase
    .from("usuarios_app")
    .select("perfil")
    .eq("email", user?.email ?? "")
    .maybeSingle();

  const meuPerfil = perfilUsuario?.perfil as Perfil | undefined;
  const meuIndice = meuPerfil ? PERFIS.indexOf(meuPerfil) : 0;
  const perfisVisiveis = meuIndice >= 0 ? PERFIS.slice(meuIndice) : PERFIS;
  const souAdmin = meuPerfil === "admin";

  const { data: linhas, error } = await supabase
    .from("permissoes_perfil")
    .select("funcionalidade, perfil, permitido")
    .order("funcionalidade");

  // Monta um mapa funcionalidade -> perfil -> permitido, para desenhar a matriz.
  const matriz = new Map<string, Map<string, boolean>>();
  for (const linha of linhas ?? []) {
    const porPerfil = matriz.get(linha.funcionalidade) ?? new Map<string, boolean>();
    porPerfil.set(linha.perfil, linha.permitido ?? false);
    matriz.set(linha.funcionalidade, porPerfil);
  }
  const funcionalidades = Array.from(matriz.keys()).sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Permissões por Perfil</h1>
        <p className="mt-1 text-sm text-slate-500">
          Controla o que cada perfil de usuário pode ver e fazer no sistema. Clique no
          interruptor para permitir ou negar o acesso de um perfil a uma funcionalidade.
        </p>
        {!souAdmin && (
          <p className="mt-2 text-sm text-frota-700">
            Você está vendo apenas os perfis do seu nível de gestão ou abaixo. Permissões do
            Administrador não ficam visíveis nem editáveis por outros perfis.
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        {error && (
          <p className="p-4 text-sm text-red-600">Erro ao carregar permissões: {error.message}</p>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Funcionalidade</th>
              {perfisVisiveis.map((perfil) => (
                <th key={perfil} className="px-4 py-3 text-center">
                  {PERFIL_LABEL[perfil]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {funcionalidades.map((funcionalidade) => {
              const porPerfil = matriz.get(funcionalidade)!;
              return (
                <tr key={funcionalidade} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{formatarFuncionalidade(funcionalidade)}</td>
                  {perfisVisiveis.map((perfil) => (
                    <td key={perfil} className="px-4 py-3 text-center">
                      <TogglePermissao
                        funcionalidade={funcionalidade}
                        perfil={perfil}
                        permitido={porPerfil.get(perfil) ?? false}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {funcionalidades.length === 0 && (
              <tr>
                <td colSpan={perfisVisiveis.length + 1} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma permissão cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
