import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { PERFIS, PERFIL_LABEL, EMPRESA_ID_GLOBAL, type Perfil } from "@/lib/constants";
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

type SearchParams = { empresa?: string };

// Fase 27 — só perfis do próprio nível (ou abaixo) ficam visíveis; a linha do
// Administrador nunca aparece pra quem não é admin (RLS de permissoes_perfil
// já barra isso no banco também, essa é a segunda camada, na tela).
//
// Fase 27.1 — além do nível, a permissão agora é por cliente (empresa):
// as linhas com empresa_id = EMPRESA_ID_GLOBAL são o padrão do sistema
// (só o admin edita); um gestor_frota/analista pode customizar a permissão
// só pra própria empresa, o que cria uma linha própria que passa a valer no
// lugar do padrão — sem afetar as demais empresas. O admin continua vendo e
// editando exclusivamente o padrão global nesta tela (não há seletor de
// cliente pra ele aqui).
export default async function PermissoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfilUsuario } = await supabase
    .from("usuarios_app")
    .select("perfil")
    .eq("email", user?.email ?? "")
    .maybeSingle();

  const meuPerfil = perfilUsuario?.perfil as Perfil | undefined;
  const meuIndice = meuPerfil ? PERFIS.indexOf(meuPerfil) : -1;
  const perfisVisiveis = meuIndice >= 0 ? PERFIS.slice(meuIndice) : PERFIS.slice(1);
  const souAdmin = meuPerfil === "admin";

  // Admin gerencia o padrão global; os demais perfis customizam a própria
  // empresa (com seletor de cliente só quando o usuário está vinculado a
  // mais de uma, ex.: grupo econômico).
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = souAdmin
    ? { empresas: [], empresaSelecionada: null as string | null, nomeEmpresaSelecionada: undefined }
    : await resolverEmpresaAtual(supabase, empresaParam);

  const empresaEdicao = souAdmin ? EMPRESA_ID_GLOBAL : empresaSelecionada;

  // Busca o padrão global sempre, e a customização da empresa selecionada
  // (se houver) — o valor da empresa, quando existe, prevalece sobre o
  // padrão na hora de montar a matriz exibida.
  const [{ data: linhasGlobais, error }, { data: linhasEmpresa }] = await Promise.all([
    supabase
      .from("permissoes_perfil")
      .select("funcionalidade, perfil, permitido")
      .eq("empresa_id", EMPRESA_ID_GLOBAL)
      .order("funcionalidade"),
    !souAdmin && empresaSelecionada
      ? supabase
          .from("permissoes_perfil")
          .select("funcionalidade, perfil, permitido")
          .eq("empresa_id", empresaSelecionada)
      : Promise.resolve({ data: null as { funcionalidade: string; perfil: string; permitido: boolean | null }[] | null }),
  ]);

  // Mapa funcionalidade -> perfil -> { permitido, customizado } pra desenhar
  // a matriz. Primeiro entra o padrão global, depois a customização da
  // empresa sobrescreve por cima (quando existir).
  const matriz = new Map<string, Map<string, { permitido: boolean; customizado: boolean }>>();
  for (const linha of linhasGlobais ?? []) {
    const porPerfil = matriz.get(linha.funcionalidade) ?? new Map();
    porPerfil.set(linha.perfil, { permitido: linha.permitido ?? false, customizado: false });
    matriz.set(linha.funcionalidade, porPerfil);
  }
  for (const linha of linhasEmpresa ?? []) {
    const porPerfil = matriz.get(linha.funcionalidade) ?? new Map();
    porPerfil.set(linha.perfil, { permitido: linha.permitido ?? false, customizado: true });
    matriz.set(linha.funcionalidade, porPerfil);
  }
  const funcionalidades = Array.from(matriz.keys()).sort();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Permissões por Perfil</h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla o que cada perfil de usuário pode ver e fazer no sistema. Clique no
            interruptor para permitir ou negar o acesso de um perfil a uma funcionalidade.
          </p>
          {!souAdmin && (
            <p className="mt-2 text-sm text-frota-700">
              Você está vendo apenas os perfis do seu nível de gestão ou abaixo, para{" "}
              {nomeEmpresaSelecionada ? <strong>{nomeEmpresaSelecionada}</strong> : "sua empresa"}.
              Permissões do Administrador e de outros clientes não ficam visíveis nem editáveis
              por aqui.
            </p>
          )}
        </div>
        {!souAdmin && empresas.length > 1 && (
          <form className="flex items-end gap-2">
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
              Aplicar
            </button>
          </form>
        )}
      </div>

      <div className="card overflow-x-auto">
        {error && (
          <p className="p-4 text-sm text-red-600">Erro ao carregar permissões: {error.message}</p>
        )}
        {!souAdmin && !empresaEdicao && (
          <p className="p-4 text-sm text-slate-500">
            {empresas.length > 1
              ? "Selecione um cliente acima para ver e ajustar as permissões dele."
              : "Nenhuma empresa vinculada ao seu usuário — fale com o administrador."}
          </p>
        )}
        {(souAdmin || empresaEdicao) && (
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
                    {perfisVisiveis.map((perfil) => {
                      const valor = porPerfil.get(perfil);
                      return (
                        <td key={perfil} className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <TogglePermissao
                              funcionalidade={funcionalidade}
                              perfil={perfil}
                              permitido={valor?.permitido ?? false}
                              empresaId={empresaEdicao!}
                            />
                            {!souAdmin && valor?.customizado && (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-frota-600">
                                Personalizado
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
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
        )}
      </div>
    </div>
  );
}
