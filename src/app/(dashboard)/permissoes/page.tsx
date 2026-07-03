import { createClient } from "@/lib/supabase/server";
import { PERFIS, PERFIL_LABEL } from "@/lib/constants";
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
      </div>

      <div className="card overflow-x-auto">
        {error && (
          <p className="p-4 text-sm text-red-600">Erro ao carregar permissões: {error.message}</p>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Funcionalidade</th>
              {PERFIS.map((perfil) => (
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
                  {PERFIS.map((perfil) => (
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
                <td colSpan={PERFIS.length + 1} className="px-4 py-8 text-center text-slate-400">
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
