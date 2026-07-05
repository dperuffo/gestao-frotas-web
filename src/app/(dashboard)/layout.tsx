import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoSair } from "./_components/BotaoSair";
import { contarChamadosNaoVistosAcao } from "./chamados/actions";
import { contarAvaliacoesPendentesAcao } from "./avaliacoes/actions";
import { contarAcessosClientesNaoVistosAcao } from "./clientes/actions";
import { contarAnomaliasNaoRevisadasAcao } from "./anomalias/actions";
import { contarNegociacoesPendentesAcao } from "./negociacoes/actions";
import { contarAjustesAbastecimentosPendentesAcao } from "./abastecimentos/actions";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { TourProvider } from "@/components/ajuda/TourProvider";
import { CentralAjuda } from "@/components/ajuda/CentralAjuda";

// Fase 27.15 — o ícone da "Assistente FNI" é a logo (imagem), bem mais larga
// que um emoji, então o texto de cada item desalinhava em relação aos
// demais (que usavam emoji direto dentro da string do label). Separado
// `icone`/`label` pra todo mundo nesta lista renderizar o ícone dentro da
// mesma coluna de largura fixa (ver render abaixo) — a logo entra no lugar
// do emoji só pro item "/assistente" (icone: null sinaliza isso).
const menuVisaoGeral = [
  { href: "/dashboard", icone: "📊", label: "Dashboard" },
  { href: "/assistente", icone: null, label: "Assistente FNI" },
  { href: "/assinatura", icone: "💳", label: "Minha Assinatura" },
  { href: "/avaliar", icone: "⭐", label: "Avaliar Plataforma" },
  { href: "/financeiro", icone: "💰", label: "Painel Financeiro" },
  { href: "/lgpd", icone: "🔒", label: "Privacidade (LGPD)" },
];

const menuCadastros = [
  { href: "/clientes", label: "🏢 Clientes" },
  { href: "/grupo-economico", label: "🔗 Grupo Econômico" },
  { href: "/usuarios", label: "👥 Usuários" },
  { href: "/motoristas", label: "🪪 Motoristas" },
  { href: "/veiculos", label: "🚗 Veículos" },
  { href: "/centros-custo", label: "🧾 Centros de Custo" },
  { href: "/postos", label: "⛽ Postos Revendedores" },
];

const menuOperacao = [
  { href: "/abastecimentos", label: "🛢️ Abastecimentos" },
  { href: "/anomalias", label: "🚨 Anomalias" },
  { href: "/roteirizacao", label: "🗺️ Roteirização" },
  { href: "/rotograma", label: "🛡️ Rotograma" },
  { href: "/planos-viagem", label: "🧳 Planos de Viagem" },
  { href: "/negociacoes", label: "🤝 Negociações com Postos" },
  { href: "/precos-postos", label: "💲 Preços dos Postos Parceiros" },
  { href: "/manutencao-preditiva", label: "🔧 Manutenção Preditiva" },
  { href: "/relatorios", label: "📈 Relatórios" },
  { href: "/integracoes", label: "🔌 Integrações" },
];

// Fase 27.50 — menu do posto revendedor (perfil "posto", tenant segmento
// "Revenda"). É uma trilha própria, bem mais enxuta que o menu de Frota:
// hoje o posto tem Dashboard, Negociações (aceitar/recusar/contrapropor o
// que o cliente enviou, ou enviar proposta via API), Integrações (gerar a
// própria chave de API) e Usuários (gerenciar o próprio time). Mais telas
// devem entrar aqui conforme a plataforma evoluir pro lado Revenda.
// Fase 27.56 — "Dashboard" entra aqui: todo mundo cai em /dashboard depois
// do login, e antes disso o posto não tinha nenhum item de menu apontando
// pra lá (a página é branch por segmento — ver dashboard/page.tsx).
const menuPosto = [
  { href: "/dashboard", label: "🏠 Dashboard" },
  { href: "/negociacoes", label: "🤝 Negociações" },
  { href: "/abastecimentos", label: "🛢️ Abastecimentos" },
  { href: "/precos-postos", label: "💲 Meus Preços" },
  { href: "/financeiro-posto", label: "💰 Financeiro" },
  { href: "/integracoes", label: "🔌 Integrações" },
  { href: "/usuarios", label: "👥 Usuários" },
];

const menuAdministracao = [
  { href: "/permissoes", label: "🔑 Permissões por Perfil" },
  { href: "/inteligencia-rede", label: "🌐 Inteligência de Rede" },
  { href: "/assinaturas", label: "💳 Assinaturas (todos os clientes)" },
  { href: "/avaliacoes", label: "⭐ Avaliações dos Clientes" },
];

// Alvos do tour de boas-vindas (Fase 24) — só os 3 itens de menu citados no
// tour (ver src/lib/ajuda/tourPassos.ts) precisam de data-tour; os demais
// ficam sem atributo (undefined em data-tour é simplesmente omitido pelo
// React).
const TOUR_POR_HREF: Record<string, string> = {
  "/dashboard": "menu-dashboard",
  "/assistente": "menu-assistente",
  "/financeiro": "menu-financeiro",
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Regra de negócio: MFA é obrigatório para acessar qualquer tela do dashboard.
  // getAuthenticatorAssuranceLevel sozinho não força o cadastro inicial (se o
  // usuário não tem nenhum fator, nextLevel fica igual a currentLevel), então
  // também checamos se existe algum fator TOTP verificado.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const temFatorVerificado = factors?.totp?.some((f) => f.status === "verified") ?? false;
  const precisaSubirNivel = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  if (!temFatorVerificado || precisaSubirNivel) {
    redirect("/mfa-setup");
  }

  // Fase 27.29 — achado real: este layout envolve TODA página do dashboard e
  // NÃO é coberto por nenhum error.tsx (limitação documentada do Next: um
  // error boundary não pega erro lançado no layout do MESMO segmento, só em
  // páginas/componentes filhos). As contagens de badge abaixo nunca tinham
  // proteção nenhuma — qualquer falha ali (rede, RLS, timeout) derrubava o
  // dashboard inteiro com o erro genérico mascarado de produção, sem passar
  // por nenhuma das blindagens já feitas na Server Action ou na página do
  // chamado. Isso também explica por que o bug só aparecia ao RESPONDER/
  // anexar num chamado existente (que não redireciona, então o Next
  // re-renderiza a rota atual + este layout por trás dos panos como parte da
  // resposta da action) e nunca ao ABRIR um chamado novo (que termina em
  // redirect(), navegação nova, sem precisar re-renderizar a tela atual).
  // Cada contagem agora é best-effort: uma falha vira 0 (badge escondido) em
  // vez de derrubar a aplicação inteira.
  const [
    chamadosNaoVistos,
    avaliacoesPendentes,
    acessosClientesNaoVistos,
    anomaliasNaoRevisadas,
    negociacoesPendentes,
    ajustesAbastecimentosPendentes,
  ] = await Promise.all([
      contarChamadosNaoVistosAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar chamados não vistos (ignorado):", e);
        return 0;
      }),
      contarAvaliacoesPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar avaliações pendentes (ignorado):", e);
        return 0;
      }),
      contarAcessosClientesNaoVistosAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar acessos de clientes não vistos (ignorado):", e);
        return 0;
      }),
      contarAnomaliasNaoRevisadasAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar anomalias não revisadas (ignorado):", e);
        return 0;
      }),
      contarNegociacoesPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar negociações pendentes (ignorado):", e);
        return 0;
      }),
      // Fase 27.65 — bolinha de ajustes de abastecimento aguardando resposta
      // deste usuário (cliente ou posto); mesma blindagem "falha vira 0" das
      // demais contagens.
      contarAjustesAbastecimentosPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar ajustes de abastecimento pendentes (ignorado):", e);
        return 0;
      }),
    ]);

  // Nome e cargo/função do usuário logado, pra mostrar no lugar do texto
  // fixo "Ambiente seguro FNI" abaixo da logo — vínculo é por e-mail (mesmo
  // padrão usado em /usuarios), já que usuarios_app não tem FK pro auth.users.
  // Fase 27.29 — também protegido: sem perfil, cai no e-mail puro (só perde
  // o cargo/rótulo exibido, não derruba a tela).
  let perfilUsuario: { nome: string | null; perfil: string | null; tour_onboarding_visto: boolean | null } | null = null;
  try {
    const { data } = await supabase
      .from("usuarios_app")
      .select("nome, perfil, tour_onboarding_visto")
      .eq("email", user.email ?? "")
      .maybeSingle();
    perfilUsuario = data;
  } catch (e) {
    console.error("[dashboard/layout] falha ao buscar perfil do usuário (ignorado):", e);
  }
  const nomeExibido = perfilUsuario?.nome || user.email;
  const cargoExibido = perfilUsuario?.perfil
    ? PERFIL_LABEL[perfilUsuario.perfil as Perfil] ?? perfilUsuario.perfil
    : null;

  // Admin (time interno FNI) não assina um plano nem avalia a plataforma
  // como cliente — ele só gerencia as assinaturas e acompanha as avaliações
  // de todos os clientes via "Assinaturas (todos os clientes)" e
  // "Avaliações dos Clientes", em Administração. Por isso "Minha Assinatura"
  // e "Avaliar Plataforma" somem do menu pra esse perfil.
  const ehAdmin = perfilUsuario?.perfil === "admin";
  const itensVisaoGeral = ehAdmin
    ? menuVisaoGeral.filter((item) => item.href !== "/assinatura" && item.href !== "/avaliar")
    : menuVisaoGeral;

  // Fase 27.50 — perfil "posto" é uma trilha própria (Revenda), separada da
  // hierarquia de Frota (mesmo espírito da Fase 27.39 em /permissoes): vê um
  // menu bem mais enxuto, sem nenhuma das telas de gestão de frota.
  const ehPosto = perfilUsuario?.perfil === "posto";

  return (
    <TourProvider tourJaVisto={perfilUsuario?.tour_onboarding_visto ?? false}>
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-frota-950 text-slate-100">
        <div data-tour="logo" className="border-b border-white/10 px-5 py-6">
          <div className="rounded-xl border border-white/10 bg-white/95 p-3 shadow-lg shadow-frota-950/30">
            <Image
              src="/logo-fni.png"
              alt="Fleet Network Intelligence"
              width={1132}
              height={441}
              priority
              className="h-auto w-full"
            />
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-white">{nomeExibido}</p>
          {cargoExibido && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-frota-500">
              {cargoExibido}
            </p>
          )}
        </div>
        <nav className="flex-1 px-3 py-4">
          {ehPosto ? (
            <ul className="space-y-1">
              {menuPosto.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <span>{item.label}</span>
                    {item.href === "/negociacoes" && negociacoesPendentes > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                        {negociacoesPendentes}
                      </span>
                    )}
                    {item.href === "/abastecimentos" && ajustesAbastecimentosPendentes > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                        {ajustesAbastecimentosPendentes}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
          <>
          <ul className="space-y-1">
            {itensVisaoGeral.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-tour={TOUR_POR_HREF[item.href]}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span className="flex w-6 shrink-0 items-center justify-center" aria-hidden>
                    {item.icone ?? (
                      <Image src="/logo-fni.png" alt="" width={24} height={9} className="h-auto w-6 object-contain" />
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/chamados"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  <span className="flex w-6 shrink-0 items-center justify-center" aria-hidden>
                    🎫
                  </span>
                  Chamados
                </span>
                {chamadosNaoVistos > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {chamadosNaoVistos}
                  </span>
                )}
              </Link>
            </li>
          </ul>

          <p data-tour="menu-cadastros" className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Cadastros
          </p>
          <ul className="space-y-1">
            {menuCadastros.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span>{item.label}</span>
                  {item.href === "/clientes" && acessosClientesNaoVistos > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {acessosClientesNaoVistos}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <p data-tour="menu-operacao" className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Operação
          </p>
          <ul className="space-y-1">
            {menuOperacao.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span>{item.label}</span>
                  {item.href === "/anomalias" && anomaliasNaoRevisadas > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {anomaliasNaoRevisadas}
                    </span>
                  )}
                  {item.href === "/negociacoes" && negociacoesPendentes > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {negociacoesPendentes}
                    </span>
                  )}
                  {item.href === "/abastecimentos" && ajustesAbastecimentosPendentes > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {ajustesAbastecimentosPendentes}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Administração
          </p>
          <ul className="space-y-1">
            {menuAdministracao.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span>{item.label}</span>
                  {item.href === "/avaliacoes" && avaliacoesPendentes > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {avaliacoesPendentes}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          </>
          )}
        </nav>
        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          <CentralAjuda />
          <BotaoSair />
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
    </TourProvider>
  );
}
