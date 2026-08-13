import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { PERFIS, PERFIL_LABEL, EMPRESA_ID_GLOBAL, type Perfil } from "@/lib/constants";
import { ReplicarParaGrupoButton } from "@/components/replicacao/ReplicarParaGrupoButton";
import { TogglePermissao } from "./_components/TogglePermissao";

// Deixa "aba_dashboard" -> "Aba: Dashboard" e "func_exportar" -> "Função: Exportar",
// só para ficar mais legível na tela. Não muda nada no banco.
//
// Achado real (13/08/2026) — Daniel reportou que "sumiram todas as abas do
// Programa de Fidelidade" na visão do posto; a causa era este toggle
// desligado (perfil posto, empresa_id global), mas o rótulo humanizado
// ("Aba: Parcerias Locais") não deixava óbvio que essa é a ÚNICA porta de
// entrada pro programa "Estrada que Cuida" do lado posto (catálogo de
// benefícios + vouchers pendentes/queimados + missões, tudo numa página só
// — ver /parcerias-locais). Rótulos especiais abaixo cobrem esse e outros
// nomes técnicos que não deixam claro o que a aba realmente contém.
const RÓTULOS_ESPECIAIS: Record<string, string> = {
  aba_parcerias_locais: "Aba: Parcerias Locais (Programa de Fidelidade)",
  aba_fidelidade_motoristas: "Aba: Fidelidade dos Motoristas (Programa de Fidelidade)",
};

function formatarFuncionalidade(nome: string) {
  if (RÓTULOS_ESPECIAIS[nome]) return RÓTULOS_ESPECIAIS[nome];
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
  const souAdmin = meuPerfil === "admin";

  // Fase 27.39 — achado real (reportado pelo Daniel): "posto" não é um degrau
  // abaixo de "analista" na mesma hierarquia — é uma trilha separada (perfil
  // do segmento Revenda), então a conta antiga "PERFIS.slice(meuIndice)"
  // deixava um gestor_frota ou analista (lado Frota) enxergar e editar a
  // coluna "Posto" na matriz, quando só o próprio Posto (ou o admin) deveria
  // gerenciar essa permissão. A RLS tinha o mesmo furo (nivel_perfil no
  // banco, ver migração da Fase 27.39) e foi corrigida junto. Aqui: quem é
  // "posto" só vê a própria coluna; quem é do lado Frota (gestor_frota/
  // analista) nunca vê "posto".
  // Fase Convite-Self-Service (26/07/2026) — "colaborador" é o perfil dos
  // convidados via /minha-equipe (self-service, sem nenhum poder próprio —
  // tudo definido aqui). Entra como o degrau mais baixo das duas
  // hierarquias (Frota e Posto), visível tanto pro gestor_frota/analista
  // quanto pro posto — nunca pro colaborador em si (ele não convida nem
  // configura permissão de ninguém).
  const HIERARQUIA_FROTA: Perfil[] = ["gestor_frota", "analista", "colaborador"];
  const perfisVisiveis: Perfil[] = souAdmin
    ? [...PERFIS]
    : meuPerfil === "posto"
      ? ["posto", "colaborador"]
      : HIERARQUIA_FROTA.slice(Math.max(0, HIERARQUIA_FROTA.indexOf(meuPerfil ?? "analista")));

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
      <div className="mb-6">
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

      {!souAdmin && empresaEdicao && (
        <>
          {/* Achado real (13/08/2026, auditoria da tela) — a personalização
              por empresa feita aqui embaixo NÃO bloqueia a URL de verdade
              pra ninguém (isso só o padrão global do Administrador faz); ela
              só decide o que fica liberado automaticamente quando alguém da
              sua empresa pede acesso a um colega. Antes esse comportamento
              só estava documentado em comentário no código — deixando
              parecer, na própria tela, que desligar um interruptor aqui
              bloqueia o colega de acessar a tela, quando na prática não
              bloqueia. */}
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Estes interruptores personalizam só o que fica liberado por padrão quando alguém da sua empresa pede
            acesso a um colega — eles não bloqueiam, por si só, o acesso de ninguém à tela. O bloqueio de verdade
            (impedir o acesso direto pela URL) é definido só pelo Administrador, no padrão global do sistema.
          </div>
          <div className="mb-4 flex justify-end">
            <ReplicarParaGrupoButton
              chaveTabela="permissoes_perfil"
              empresaId={empresaEdicao}
              rotuloRegistro="as permissões personalizadas desta empresa"
            />
          </div>
        </>
      )}

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
                  <tr key={funcionalidade} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 text-slate-700">{formatarFuncionalidade(funcionalidade)}</td>
                    {perfisVisiveis.map((perfil) => {
                      const valor = porPerfil.get(perfil);
                      return (
                        <td key={perfil} className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {/* Achado real (13/08/2026, auditoria da tela) — quando não
                                existe linha cadastrada pra este par funcionalidade×perfil
                                (ex.: "colaborador" nunca tem linha própria, ver comentário
                                em permissoes.ts), o enforcement real (temAcesso, em
                                permissoes.ts) trata isso como LIBERADO. Antes este toggle
                                caía em `?? false` e mostrava desligado — parecia bloqueado
                                sem estar, escondendo do admin/gestor que aquele perfil já
                                tinha acesso liberado por padrão. Corrigido pra refletir o
                                mesmo "sem linha = liberado" usado no bloqueio de verdade. */}
                            <TogglePermissao
                              funcionalidade={funcionalidade}
                              perfil={perfil}
                              permitido={valor?.permitido ?? true}
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
