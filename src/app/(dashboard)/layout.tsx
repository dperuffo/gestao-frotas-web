import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoSair } from "./_components/BotaoSair";
import { contarChamadosNaoVistosAcao } from "./chamados/actions";
import { contarAvaliacoesPendentesAcao } from "./avaliacoes/actions";
import { contarAcessosClientesNaoVistosAcao } from "./clientes/actions";
import { contarNegociacoesPendentesAcao } from "./negociacoes/actions";
import { contarAjustesAbastecimentosPendentesAcao } from "./abastecimentos/actions";
import { contarAcoesSugeridasPendentesAcao } from "./acoes-sugeridas/actions";
import { contarDocumentosPendentesAcao } from "./documentos-empresas/actions";
import { contarFalhasVerificacaoAntifraudeAcao } from "./antifraude/actions";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { TourProvider } from "@/components/ajuda/TourProvider";
import { PASSOS_TOUR_FROTA, PASSOS_TOUR_POSTO } from "@/lib/ajuda/tourPassos";
import { CentralAjuda } from "@/components/ajuda/CentralAjuda";
import { buscarLogoutInatividadeMinutos } from "@/lib/configuracoesSistema";
import { MonitorInatividade } from "./_components/MonitorInatividade";
import { LembretePwaBanner } from "@/components/pwa/LembretePwaBanner";

// Fase 27.15 — o ícone da "Assistente FNI" é a logo (imagem), bem mais larga
// que um emoji, então precisa de tratamento especial no render (ver
// `item.logo` abaixo) — os demais itens seguem o MESMO padrão do
// menuCadastros/menuOperacao/menuAdministracao: emoji embutido direto na
// string do label.
// Fase 27.112 — pedido do Daniel: "Alinhar ícones e textos iniciais com os
// ícones e textos do menu Cadastros. Nomear a primeira sessão de ícones e
// textos GERAL". Esta lista passou a usar o mesmo formato label com emoji
// embutido (em vez de icone/label separados) pra ficar visualmente idêntica
// às demais seções, e ganhou o cabeçalho "Geral" (ver render abaixo).
const menuVisaoGeral = [
  { href: "/dashboard", label: "📊 Dashboard" },
  { href: "/assistente", label: "Assistente FNI", logo: true },
  { href: "/assinatura", label: "💳 Minha Assinatura" },
  { href: "/avaliar", label: "⭐ Avaliar Plataforma" },
  { href: "/financeiro", label: "💰 Painel Financeiro" },
  // Fase 27.149 — upload de documentação societária/cadastral (Contrato
  // Social, docs dos sócios, comprovante de endereço), aprovada pelo admin
  // em /documentos-empresas — pré-requisito pra criar/aderir a Redes de
  // Postos/Grupos Econômicos e aceitar/criar negociações.
  { href: "/documentos", label: "📁 Documentos" },
  // Fase 27.151 — pedido do Daniel: "faz todo o sentido deixar na visão do
  // cliente [Inteligência de Rede]". A tela (que já era admin-only) passou
  // a aceitar também o perfil cliente, mostrando só a rede da PRÓPRIA
  // empresa (nunca a de outros clientes — ver comentário em
  // inteligencia-rede/page.tsx). Continua também em Administração, com
  // visão consolidada de toda a plataforma pro admin.
  { href: "/inteligencia-rede", label: "🌐 Inteligência de Rede" },
  { href: "/lgpd", label: "🔒 Privacidade (LGPD)" },
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
  // Fase 27.94/27.95 — status de NF-e por abastecimento (emitida/pendente)
  // + indicador de % de recolha, do lado do cliente.
  { href: "/notas-fiscais", label: "📄 Notas Fiscais" },
  // Fase Motor-de-Ação-Automática — pedido do Daniel após o benchmark com a
  // TicketLog: central que fecha o ciclo sugestão -> aprovação -> execução
  // real (bloquear motorista com CNH vencida, remover posto acima da média,
  // cadastrar regra de hodômetro), reaproveitando o que Anomalias/CNH/
  // Inteligência de Rede já detectavam só como alerta. Fase
  // Ações-Sugeridas-Completa: passou a cobrir os 4 tipos que o antigo painel
  // de Anomalias detectava, então Anomalias saiu do menu (testado em
  // produção pelo Daniel) — a rota /anomalias continua existindo só como
  // redirect pra cá, pra não quebrar favoritos.
  { href: "/acoes-sugeridas", label: "🤖 Ações Sugeridas" },
  // Fase 27.15x — diferente de Ações Sugeridas (detecta DEPOIS do abastecimento),
  // aqui o cliente cadastra regras que um sistema externo consulta ANTES de
  // autorizar — ver POST /api/integracoes/antifraude/verificar.
  { href: "/antifraude", label: "🕵️ Antifraude" },
  // Fase 27.130 — indicadores do programa "Estrada que Cuida" (app próprio
  // do motorista) por motorista, mesmo padrão de seleção de cliente do
  // Antifraude acima; RPC indicadores_fidelidade_motoristas já checa
  // autorização por empresa/admin internamente.
  { href: "/fidelidade-motoristas", label: "🎁 Fidelidade dos Motoristas" },
  // Fase Parcerias Locais (17/07) — o cliente cria seus próprios benefícios
  // (treinamentos, marketplace, telemedicina etc.) no catálogo de
  // fidelidade; mesma tela também vive em menuPostoOperacao (ver abaixo).
  { href: "/parcerias-locais", label: "🎟️ Parcerias Locais" },
  { href: "/roteirizacao", label: "🗺️ Roteirização" },
  { href: "/rotograma", label: "🛡️ Rotograma" },
  { href: "/planos-viagem", label: "🧳 Planos de Viagem" },
  // Fase Fretes — contratação de frete entre cliente e motorista, estilo
  // Uber (mercado aberto com negociação) ou atribuição direta a um
  // motorista próprio/parceiro. Motoristas Parceiros é o cadastro de
  // terceiros/agregados usado pelo modo direto.
  { href: "/fretes", label: "🚚 Fretes" },
  { href: "/motoristas-parceiros", label: "🤝 Motoristas Parceiros" },
  { href: "/negociacoes", label: "🤝 Negociações com Postos" },
  { href: "/precos-postos", label: "💲 Preços dos Postos Parceiros" },
  { href: "/manutencao-preditiva", label: "🔧 Manutenção Preditiva" },
  // Fase 27.120 — regras que balizam abastecimentos feitos em postos ou
  // soluções de automação/meios de pagamento integrados via API (Hub de
  // Integrações). Primeiro tipo implementado: Vínculo Motorista ↔ Veículo.
  { href: "/parametros-uso", label: "🎛️ Parâmetros de Uso" },
  { href: "/relatorios", label: "📈 Relatórios" },
  { href: "/integracoes", label: "🔌 Integrações" },
];

// Fase 27.50 — menu do posto revendedor (perfil "posto", tenant segmento
// "Revenda"). Trilha própria, separada da hierarquia de Frota.
// Fase 27.127/27.130 — pedido do Daniel: mecanismo de avaliação, chamados e
// Assistente FNI também na visão do posto, junto com Privacidade (LGPD) e
// Minha Assinatura (o posto agora assina um plano próprio — Fase 27.125),
// "tudo dentro de uma aba Gestão" — e, na sequência, "No menu da visao Posto
// ter uma sessão Gestão e uma sessão Operação". Mesmo espírito das seções
// "Gestão"/"Operação" que já existem pro lado Frota (menuVisaoGeral/
// menuOperacao, ver acima): Gestão = itens "de conta" (visão geral,
// assinatura, time, dados da empresa, suporte); Operação = o dia a dia de
// negociar/abastecer/precificar com os clientes. Nenhum item de Gestão exige
// mudança de RLS/backend — resolverEmpresaAtual, avaliar/actions.ts e
// chamados/actions.ts já são agnósticos de segmento (usam empresas_do_usuario
// pelo e-mail, e todo posto tem sua própria linha em usuarios_empresas
// apontando pra própria empresa, desde sempre — ver Fase 27.50/27.125).
// Fase 27.56 — "Dashboard" entra em Gestão (mesmo lugar que ocupa no
// menuVisaoGeral da Frota): todo mundo cai em /dashboard depois do login.
const menuPostoGestao = [
  { href: "/dashboard", label: "🏠 Dashboard" },
  // Fase 27.137 — pedido do Daniel: cadastro do estabelecimento (CNPJ,
  // razão social, endereço, contatos, lat/long) logo na adesão do posto,
  // comparado com a base ANP pra evitar registro duplicado/sobreposto —
  // perto do topo do menu de propósito, é o primeiro passo esperado de
  // quem acabou de aderir.
  { href: "/meu-posto", label: "📍 Meu Posto" },
  // Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão
  // do posto para criação e gestão". Volta pro menu do posto (tinha ido
  // só pra Administração na Fase 27.129, quando a escrita ainda era
  // 100% admin-only) — RLS/código agora permitem que um posto crie e
  // gerencie sua própria Rede (ver gruposEconomicos.ts). Continua também
  // em Administração, pra visão global do admin sobre todas as redes.
  { href: "/rede-postos", label: "🔗 Rede de Postos" },
  { href: "/assistente", label: "Assistente FNI", logo: true },
  { href: "/assinatura", label: "💳 Minha Assinatura" },
  { href: "/avaliar", label: "⭐ Avaliar Plataforma" },
  { href: "/financeiro-posto", label: "💰 Financeiro" },
  { href: "/lgpd", label: "🔒 Privacidade (LGPD)" },
  // Fase 27.92 — self-service: cadastro da chave PIX usada como cedente no
  // boleto/documento de cobrança enviado aos clientes.
  { href: "/minha-empresa", label: "🏦 Meus Dados / PIX" },
  // Fase 27.149 — mesmo item de /documentos do lado Frota (menuVisaoGeral,
  // ver acima), agora também disponível pro posto.
  { href: "/documentos", label: "📁 Documentos" },
  { href: "/usuarios", label: "👥 Usuários" },
];

// Fase 27.130 — o dia a dia operacional do posto: negociar com clientes
// (aceitar/recusar/contrapropor o que o cliente enviou, ou enviar proposta
// via API), registrar abastecimentos, acompanhar o cliente/preço/nota fiscal
// de cada relação comercial, e gerar a própria chave de API.
const menuPostoOperacao = [
  { href: "/negociacoes", label: "🤝 Negociações" },
  { href: "/abastecimentos", label: "🛢️ Abastecimentos" },
  // Fase Parcerias Locais (17/07) — o posto cria seus próprios benefícios
  // (vale-refeição, banho, estacionamento, lavagem/troca de óleo, produtos
  // da conveniência etc.) no catálogo de fidelidade "Estrada que Cuida",
  // publicados pra rede toda de motoristas resgatar. Mesma tela do lado
  // cliente (ver menuOperacao acima) — RLS escopa por criador_empresa_id.
  { href: "/parcerias-locais", label: "🎟️ Parcerias Locais" },
  // Fase 27.72 — cadastro dos clientes que já negociaram com o posto
  // (qualquer status), com ciclo de abastecimento/pagamento por cliente.
  { href: "/clientes-posto", label: "🏢 Clientes" },
  { href: "/precos-postos", label: "💲 Meus Preços" },
  // Fase 27.94/27.95 — upload de NF-e (XML) por abastecimento + indicador
  // de % de recolha, do lado do posto.
  { href: "/notas-fiscais", label: "📄 Notas Fiscais" },
  { href: "/integracoes", label: "🔌 Integrações" },
];

const menuAdministracao = [
  { href: "/permissoes", label: "🔑 Permissões por Perfil" },
  // Fase 27.149 — fila de revisão da documentação societária/cadastral
  // enviada por postos e clientes em /documentos (Contrato Social, docs
  // dos sócios, comprovante de endereço).
  { href: "/documentos-empresas", label: "📁 Aprovação de Documentos" },
  // Fase 27.161 — pedido do Daniel: "remover a duplicidade, pois ja esta
  // dentro de Gestão" — o admin via "Inteligência de Rede" 2x (aqui E em
  // Gestão, ver comentário da Fase 27.151 em menuVisaoGeral). O item
  // continua existindo com visão consolidada da rede toda pro admin
  // (inteligencia-rede/page.tsx), só o link duplicado saiu daqui.
  { href: "/assinaturas", label: "💳 Assinaturas (todos os clientes)" },
  { href: "/avaliacoes", label: "⭐ Avaliações dos Clientes" },
  // Fase 27.129 — pedido do Daniel: "Rede de Postos nao faz sentido estar na
  // visao do cliente". Escrita já era admin-only em código
  // (gruposEconomicos.ts::ehAdminOuSuperusuario), então deixava o item no
  // menu do cliente sem nenhuma ação que ele pudesse de fato realizar ali —
  // movido pra Administração, junto de Grupo Econômico/Assinaturas/etc.
  { href: "/rede-postos", label: "🔗 Rede de Postos" },
  // Fase 27.137 — fila de revisão dos possíveis duplicados sinalizados pela
  // checagem de "Meu Posto" contra a base ANP (endereço/coordenadas muito
  // próximos de outro posto, CNPJ diferente) — nunca bloqueia o posto, só
  // sinaliza pra um admin decidir aqui.
  { href: "/postos-duplicados", label: "🔍 Possíveis Duplicados (Postos)" },
  // Fase 27.86 — parâmetros globais do sistema (hoje só o timeout de
  // logout por inatividade; ver /configuracoes).
  { href: "/configuracoes", label: "⚙️ Configurações do Sistema" },
  // Programa "Estrada que Cuida" (app do motorista) — catálogo de resgate
  // simulado (v1, sem parceiros reais) + fila de resgates pra cumprimento
  // manual. Ver PROPOSTA-FIDELIDADE-MOTORISTA.md.
  { href: "/fidelidade", label: "🎁 Catálogo de Fidelidade" },
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

// Fase 27.82 — mesma ideia, só que pros alvos do tour do POSTO (ver
// PASSOS_TOUR_POSTO em tourPassos.ts) — menuPosto é uma lista só, sem
// seções, então cada item relevante recebe seu próprio data-tour (não dá
// pra reaproveitar um "cabeçalho de seção" como Cadastros/Operação fazem
// pro lado Frota).
const TOUR_POR_HREF_POSTO: Record<string, string> = {
  "/dashboard": "menu-dashboard-posto",
  "/negociacoes": "menu-negociacoes-posto",
  "/clientes-posto": "menu-clientes-posto",
  "/precos-postos": "menu-precos-posto",
  "/financeiro-posto": "menu-financeiro-posto",
  "/integracoes": "menu-integracoes-posto",
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
  // Fase Perf-19-07 (achado do Daniel: "lentidão excessiva em muitos
  // pontos") — este layout envolve TODA página do dashboard. As duas
  // chamadas não dependem uma da outra, mas rodavam em sequência.
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
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
    negociacoesPendentes,
    ajustesAbastecimentosPendentes,
    documentosPendentes,
    falhasVerificacaoAntifraude,
    acoesSugeridasPendentes,
    logoutInatividadeMinutos,
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
      // Fase 27.150 — bolinha de notificação na chegada de documentos
      // societários/cadastrais (empresas com documentacao_status=pendente),
      // mesma blindagem "falha vira 0" das demais contagens.
      contarDocumentosPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar documentos pendentes (ignorado):", e);
        return 0;
      }),
      // Fase 27.15x — bolinha de falhas de verificação antifraude (fail-open
      // — ver POST /api/integracoes/antifraude/verificar) ainda não lidas,
      // mesma blindagem "falha vira 0" das demais contagens.
      contarFalhasVerificacaoAntifraudeAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar falhas de verificação antifraude (ignorado):", e);
        return 0;
      }),
      // Fase Motor-de-Ação-Automática — bolinha de ações sugeridas pendentes
      // (CNH vencida, posto acima da média, hodômetro fora do padrão),
      // mesma blindagem "falha vira 0" das demais contagens.
      contarAcoesSugeridasPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar ações sugeridas pendentes (ignorado):", e);
        return 0;
      }),
      // Fase 27.86 — timeout do logout automático por inatividade, lido
      // aqui (não só no filho /configuracoes) porque o MonitorInatividade
      // roda em TODA tela do dashboard; buscarLogoutInatividadeMinutos já
      // tem fallback interno pro padrão (30min) se a leitura falhar.
      buscarLogoutInatividadeMinutos(supabase),
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

  // Fase 27.114 — o passo "menu-administracao" só existe no DOM quando
  // ehAdmin (ver bloco {ehAdmin && (...)} abaixo, Fase 27.110); filtra ele
  // fora do tour pra quem não é admin, senão o tour aponta pra um elemento
  // que não existe na tela (mesmo cuidado da Fase 27.82).
  const passosTourFrota = ehAdmin
    ? PASSOS_TOUR_FROTA
    : PASSOS_TOUR_FROTA.filter((p) => p.alvo !== "menu-administracao");

  return (
    <TourProvider
      tourJaVisto={perfilUsuario?.tour_onboarding_visto ?? false}
      passos={ehPosto ? PASSOS_TOUR_POSTO : passosTourFrota}
    >
    <div className="flex min-h-screen">
      {/* Pedido do Daniel: "desacoplar o menu da tela de informações" — em
          telas com muito conteúdo, o <aside> (menu lateral) rolava junto com
          o <main>, saindo de vista quando o usuário descia a página. Fixado
          com sticky top-0 h-screen: o menu fica preso ao viewport (nunca sai
          de vista ao rolar o conteúdo) e ganha scroll PRÓPRIO
          (overflow-y-auto) pro caso do menu em si ser mais alto que a tela
          (perfil admin, com todas as seções abertas). */}
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-frota-950 text-slate-100">
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
            <>
            {/* Fase 27.130 — pedido do Daniel: "No menu da visao Posto ter uma
                sessão Gestão e uma sessão Operação" + "Conjunto Gestão acima
                de conjunto Operação no menu" — mesma ordem/nomes das seções
                que já existem pro lado Frota (Gestão vem antes de
                Cadastros/Operação lá também). */}
            <p className="mb-2 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gestão
            </p>
            <ul className="space-y-1">
              {menuPostoGestao.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-tour={TOUR_POR_HREF_POSTO[item.href]}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <span>
                      {item.logo && (
                        <Image
                          src="/logo-fni.png"
                          alt=""
                          width={24}
                          height={9}
                          className="mr-1.5 inline-block h-auto w-5 align-middle object-contain"
                        />
                      )}
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/chamados"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span>🎫 Chamados</span>
                  {chamadosNaoVistos > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {chamadosNaoVistos}
                    </span>
                  )}
                </Link>
              </li>
            </ul>

            <p className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Operação
            </p>
            <ul className="space-y-1">
              {menuPostoOperacao.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-tour={TOUR_POR_HREF_POSTO[item.href]}
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
            </>
          ) : (
          <>
          <p data-tour="menu-geral" className="mb-2 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Gestão
          </p>
          <ul className="space-y-1">
            {itensVisaoGeral.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-tour={TOUR_POR_HREF[item.href]}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <span>
                    {item.logo && (
                      <Image
                        src="/logo-fni.png"
                        alt=""
                        width={24}
                        height={9}
                        className="mr-1.5 inline-block h-auto w-5 align-middle object-contain"
                      />
                    )}
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/chamados"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <span>🎫 Chamados</span>
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
                  {item.href === "/antifraude" && falhasVerificacaoAntifraude > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {falhasVerificacaoAntifraude}
                    </span>
                  )}
                  {item.href === "/acoes-sugeridas" && acoesSugeridasPendentes > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {acoesSugeridasPendentes}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Fase 27.117 — pedido do Daniel: "Aba de Permissoes Precisa
              aparecer para o cliente. Trazer somente permissoes no menu
              Configuracoes para a visao do cliente". A Fase 27.110 escondeu
              Permissões (dentro de Administração) de quem não é admin, mas
              /permissoes já tem lógica própria pra gestor_frota/analista
              customizarem as permissões da PRÓPRIA empresa (não é tela
              exclusiva do time FNI como o resto de Administração) — ficou
              escondida por engano. Seção própria, só pro cliente (não posto,
              que já tem seu próprio /usuarios sem ganhar esta tela agora). */}
          {!ehAdmin && !ehPosto && (
            <>
              <p className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Configurações
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/permissoes"
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <span>🔑 Permissões</span>
                  </Link>
                </li>
              </ul>
            </>
          )}

          {/* Fase 27.110 — pedido do Daniel: "O menu Administração deve
              ficar visível somente para o admin da aplicação" — antes só
              excluía o posto (!ehPosto), então o cliente também via este
              bloco (Permissões, Inteligência de Rede, Assinaturas de todos
              os clientes, etc.), que são telas internas do time FNI. */}
          {ehAdmin && (
            <>
              <p
                data-tour="menu-administracao"
                className="mb-2 mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
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
                      {item.href === "/documentos-empresas" && documentosPendentes > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                          {documentosPendentes}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          </>
          )}
        </nav>
        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          <CentralAjuda />
          <BotaoSair />
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">
        {/* Pedido do Daniel (19/07): lembrete sobre a PWA mobile nas visões
            de cliente e posto — não pro admin (time interno FNI), que não é
            o público desse benefício. */}
        {!ehAdmin && <LembretePwaBanner />}
        {children}
      </main>
    </div>
    <MonitorInatividade minutos={logoutInatividadeMinutos} />
    </TourProvider>
  );
}
