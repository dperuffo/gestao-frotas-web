import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoSair } from "./_components/BotaoSair";
import { contarChamadosNaoVistosAcao } from "./chamados/actions";
import { contarAvaliacoesPendentesAcao } from "./avaliacoes/actions";
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
  { href: "/roteirizacao", label: "🗺️ Roteirização" },
  { href: "/rotograma", label: "🛡️ Rotograma" },
  { href: "/manutencao-preditiva", label: "🔧 Manutenção Preditiva" },
  { href: "/relatorios", label: "📈 Relatórios" },
  { href: "/integracoes", label: "🔌 Integrações" },
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

  // Notificação visual de chamados com atualização não vista — badge
  // vermelho no item de menu (ver lib/chamados.ts para a regra de "visto").
  const chamadosNaoVistos = await contarChamadosNaoVistosAcao();
  const avaliacoesPendentes = await contarAvaliacoesPendentesAcao();

  // Nome e cargo/função do usuário logado, pra mostrar no lugar do texto
  // fixo "Ambiente seguro FNI" abaixo da logo — vínculo é por e-mail (mesmo
  // padrão usado em /usuarios), já que usuarios_app não tem FK pro auth.users.
  const { data: perfilUsuario } = await supabase
    .from("usuarios_app")
    .select("nome, perfil, tour_onboarding_visto")
    .eq("email", user.email ?? "")
    .maybeSingle();
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
                  className="block rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  {item.label}
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
                  className="block rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  {item.label}
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
