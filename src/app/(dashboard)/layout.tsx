import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  CreditCard,
  Star,
  DollarSign,
  Receipt,
  Folder,
  Network,
  Lock,
  Building2,
  GitBranch,
  Users,
  IdCard,
  Car,
  Fuel,
  FileText,
  Sparkles,
  Gift,
  Route,
  Shield,
  Luggage,
  Truck,
  Calculator,
  ClipboardList,
  Handshake,
  Tag,
  Leaf,
  Wrench,
  SlidersHorizontal,
  BarChart3,
  Globe,
  Plug,
  MapPin,
  Landmark,
  KeyRound,
  FolderOpen,
  FileSearch,
  Settings,
  Scale,
  Ticket,
  ClipboardCheck,
  ListChecks,
  Bell,
  Gavel,
  Hammer,
  Coins,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  Radar,
  CalendarClock,
  Boxes,
  ArrowLeftRight,
  Briefcase,
  Bot,
  Megaphone,
} from "lucide-react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  HREF_FUNCIONALIDADE,
  carregarMapaPermissoes,
  ehBypassPermissao,
  resolverFuncionalidadeDaRota,
  temAcesso,
} from "@/lib/permissoes";
import { BotaoSair } from "./_components/BotaoSair";
import { GrupoMenuLateral, type ItemMenuLateral } from "./_components/GrupoMenuLateral";
import { contarChamadosNaoVistosAcao } from "./chamados/actions";
import { contarAvaliacoesPendentesAcao } from "./avaliacoes/actions";
import { contarAcessosClientesNaoVistosAcao } from "./clientes/actions";
import { contarNegociacoesPendentesAcao } from "./negociacoes/actions";
import { contarAjustesAbastecimentosPendentesAcao } from "./abastecimentos/actions";
import { contarAcoesSugeridasPendentesAcao } from "./acoes-sugeridas/actions";
import { contarDocumentosPendentesAcao } from "./documentos-empresas/actions";
import { contarCadastrosPendentesAcao } from "./cadastros-pendentes/actions";
import { contarMultasPendentesAcao } from "./multas/actions";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { TourProvider } from "@/components/ajuda/TourProvider";
import { PASSOS_TOUR_FROTA, PASSOS_TOUR_POSTO } from "@/lib/ajuda/tourPassos";
import { CentralAjuda } from "@/components/ajuda/CentralAjuda";
import { buscarLogoutInatividadeMinutos } from "@/lib/configuracoesSistema";
import { MonitorInatividade } from "./_components/MonitorInatividade";
import { LembretePwaBanner } from "@/components/pwa/LembretePwaBanner";
import { AvisosSino } from "./_components/AvisosSino";
import { AvisoBannerFixo } from "./_components/AvisoBannerFixo";
import { listarAvisosAcao } from "./administracao/central-avisos/actions";
import { BarraAtalhosFavoritos, type ItemAtalho } from "./_components/BarraAtalhosFavoritos";
import { RastreadorAcessoMenu } from "./_components/RastreadorAcessoMenu";

// Fase 27.15 (histórico) — a "Assistente FNI" chegou a usar a logo da marca
// como ícone no menu, tratamento especial só dela (`item.logo`). Substituído
// na Fase Ícones-Padrão-Menu (04/08/2026) por `icon: Bot`, igual a todos os
// outros itens — pedido do Daniel pra ela (e a Central de Ajuda, no rodapé
// do menu — ver CentralAjuda.tsx) seguirem o mesmo padrão de ícone
// lucide-react do resto do menu.
// Fase 27.112 — pedido do Daniel: "Alinhar ícones e textos iniciais com os
// ícones e textos do menu Cadastros. Nomear a primeira sessão de ícones e
// textos GERAL". Esta lista passou a usar o mesmo formato label com emoji
// embutido (em vez de icone/label separados) pra ficar visualmente idêntica
// às demais seções, e ganhou o cabeçalho "Geral" (ver render abaixo).
// Fase Ícones-PWA — pedido do Daniel: alinhar os ícones do menu web com os
// mesmos usados no PWA Cliente/Posto (Flutter, que usa Material Icons, nunca
// emoji). Trocamos o emoji embutido no label por um componente `icon`
// (lucide-react) equivalente ao Icons.xxx do Flutter — ver mapeamento por
// item nos comentários abaixo quando o nome não é óbvio.
// Fase reorganizacao-menu (04/08/2026, pedido do Daniel: "Fazer uma sugestao
// de reorganizacao do menu" / "Organizacao de temas iguais", depois de "Acho
// que esta bastante confuso para o usuario" sobre a antiga seção Operação —
// 33 itens numa lista só, sem nenhuma subdivisão, bem mais desbalanceada que
// Cadastros (9) e a antiga Gestão (11), porque cada fase nova só empilhava
// mais um item ali). As antigas `menuVisaoGeral`/`menuOperacao` (44 itens
// juntas) viraram 9 grupos temáticos menores — ver GrupoMenuLateral.tsx pro
// componente que renderiza cada um. `menuCadastros` não mudou (já estava
// bem organizada) e `menuAdministracao`, mais abaixo, também não — é
// admin-only e sempre visível pra quem chega lá (admin sempre tem bypass de
// permissão, ver ehBypassPermissao).
//
// "Visão Geral" agora é só o que se checa ao abrir o dia: status e o que
// precisa de atenção agora. O resto do que morava na antiga Gestão foi
// redistribuído por tema (ver os grupos abaixo).
const menuVisaoGeral: ItemMenuLateral[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, // PWA: Icons.dashboard
  // Fase Torre-de-Controle-Leve (02/08/2026, benchmark FNI vs KMM) — painel
  // único dos fretes em andamento, com último checkpoint e alerta de prazo.
  { href: "/torre-de-controle", label: "Torre de Controle", icon: Radar },
  // Fase Indicadores-da-Frota (30/07/2026) — disponibilidade, CPK, consumo,
  // utilização, sinistralidade e conformidade num só painel.
  { href: "/indicadores-frota", label: "Indicadores da Frota", icon: Gauge }, // PWA: Icons.speed
  // Fase Motor-de-Ação-Automática — central que fecha o ciclo sugestão ->
  // aprovação -> execução real (bloquear motorista com CNH vencida, remover
  // posto acima da média, cadastrar regra de hodômetro).
  { href: "/acoes-sugeridas", label: "Ações Sugeridas", icon: Sparkles }, // PWA: Icons.auto_awesome
];

const menuCadastros: ItemMenuLateral[] = [
  { href: "/clientes", label: "Clientes", icon: Building2 }, // PWA: Icons.business
  { href: "/grupo-economico", label: "Grupo Econômico", icon: GitBranch }, // PWA: Icons.account_tree
  { href: "/usuarios", label: "Usuários", icon: Users }, // PWA: Icons.people
  // Fase Convite-Self-Service (26/07/2026) — diferente de "Usuários" acima
  // (exclusivo do time interno FNI, vê todas as empresas), esta tela é do
  // próprio gestor_frota convidar colegas só pra própria empresa. Filtrado
  // fora de itensCadastrosFiltrados abaixo pra quem não é gestor_frota.
  { href: "/minha-equipe", label: "Minha Equipe", icon: Users },
  { href: "/motoristas", label: "Motoristas", icon: IdCard }, // PWA: Icons.badge
  { href: "/veiculos", label: "Veículos", icon: Car }, // PWA: Icons.directions_car
  // Fase auto-cadastro-abastecimento (27/07/2026) — veículos/motoristas
  // criados automaticamente a partir de abastecimentos importados
  // (origem_cadastro='importado'), ainda sem o resto do cadastro. Badge
  // conta os dois tipos juntos (contarCadastrosPendentesAcao).
  { href: "/cadastros-pendentes", label: "Cadastros Pendentes", icon: ClipboardCheck },
  { href: "/centros-custo", label: "Centros de Custo", icon: Receipt }, // PWA: Icons.receipt_long
  { href: "/postos", label: "Postos Revendedores", icon: Fuel }, // PWA: Icons.local_gas_station
];

// Fase reorganizacao-menu — o dia a dia de rota e combustível: da
// roteirização ao abastecimento em si, incluindo negociação de preço com
// postos e as regras de nota fiscal desse fluxo.
const menuRoteirizacaoAbastecimento: ItemMenuLateral[] = [
  { href: "/roteirizacao", label: "Roteirização", icon: Route }, // PWA: Icons.route
  { href: "/rotograma", label: "Rotograma", icon: Shield }, // PWA: Icons.shield_outlined
  { href: "/planos-viagem", label: "Planos de Viagem", icon: Luggage }, // PWA: Icons.card_travel
  { href: "/abastecimentos", label: "Abastecimentos", icon: Fuel }, // PWA: Icons.local_gas_station
  // Fase 27.120 — regras que balizam abastecimentos feitos em postos ou
  // soluções de automação/meios de pagamento integrados via API (Hub de
  // Integrações). Primeiro tipo implementado: Vínculo Motorista ↔ Veículo.
  // Fase reorganizacao-menu-2 (04/08/2026, pedido do Daniel) — movida de
  // "Sistema" pra cá: é regra de abastecimento, não configuração geral.
  { href: "/parametros-uso", label: "Parâmetros de Uso", icon: SlidersHorizontal }, // PWA: Icons.tune
  // Fase 27.94/27.95 — status de NF-e por abastecimento (emitida/pendente)
  // + indicador de % de recolha, do lado do cliente.
  { href: "/notas-fiscais", label: "Notas Fiscais", icon: FileText }, // PWA: Icons.description
  // Fase Onda-2 (benchmark TicketLog, item #6) — pedido do Daniel: comparador
  // de combustível ideal por veículo/região, reaproveitando os preços
  // regionais já usados no índice público de preços.
  { href: "/combustivel-ideal", label: "Combustível Ideal", icon: Leaf }, // PWA: Icons.eco
  { href: "/precos-postos", label: "Preços dos Postos Parceiros", icon: Tag }, // PWA: Icons.sell
  { href: "/negociacoes", label: "Negociações com Postos", icon: Handshake }, // PWA: Icons.handshake
  // Fase 27.140 — preferências de emissão de nota fiscal por CNPJ da frota,
  // consultadas por ERPs/automação de posto via API (Hub de Integrações).
  { href: "/parametros-nf", label: "Parâmetros de NF", icon: Receipt }, // PWA: Icons.receipt_long
];

// Fase reorganizacao-menu — o módulo TMS (frete como serviço pra terceiros),
// separado do dia a dia da própria frota: negociação de frete, programação
// por veículo e faturamento de quem contratou.
const menuFretes: ItemMenuLateral[] = [
  // Fase Fretes — contratação de frete entre cliente e motorista, estilo
  // Uber (mercado aberto com negociação) ou atribuição direta a um
  // motorista próprio/parceiro. Motoristas Parceiros é o cadastro de
  // terceiros/agregados usado pelo modo direto.
  { href: "/fretes", label: "Fretes", icon: Truck }, // PWA: Icons.local_shipping
  // Fase Programacao-Frota (03/08/2026, benchmark FNI vs Rodopar/Datapar,
  // Grupo 1 item 1) — visão por veículo (em vez de por frete): quem está
  // em viagem e até quando, quem está livre, quem não tem motorista.
  { href: "/programacao", label: "Programação", icon: CalendarClock },
  // Fase agendamento-patio (04/08/2026, item 8 do benchmark FNI vs KMM,
  // Grupo 2) — YMS leve: agenda das janelas de carga/descarga marcadas por
  // frete, com aviso de conflito de doca e status que segue os checkpoints
  // do motorista sozinho.
  { href: "/agendamentos-patio", label: "Agendamento de Pátio", icon: CalendarClock },
  // Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — cotações simulam o
  // frete a partir das Tabelas de Frete (frete-peso/ad valorem/GRIS/ICMS)
  // e do piso mínimo ANTT, e convertem em frete com um clique.
  { href: "/cotacoes", label: "Cotações", icon: Calculator },
  { href: "/tabelas-frete", label: "Tabelas de Frete", icon: ClipboardList },
  { href: "/crm-comercial", label: "CRM Comercial", icon: Briefcase }, // PWA: Icons.work_outline
  // Fase P0.6 — faturamento de fretes (agrupa CT-es autorizados por
  // tomador/período) + contas a receber genérico (ver seção nova em
  // /financeiro).
  { href: "/faturas-fretes", label: "Faturas de Frete", icon: Receipt },
  { href: "/motoristas-parceiros", label: "Motoristas Parceiros", icon: Handshake }, // PWA: Icons.handshake_outlined
];

// Fase reorganizacao-menu — manter os veículos rodando e saber quanto cada
// um custa: manutenção, peças, custo total de propriedade, patrimônio
// contábil e os registros que alimentam os índices de segurança.
const menuManutencaoAtivos: ItemMenuLateral[] = [
  { href: "/manutencao-preditiva", label: "Manutenção Preditiva", icon: Wrench }, // PWA: Icons.build
  // Fase Grupo 1 Rodopar item 2 (03/08/2026, benchmark FNI vs Rodopar/Datapar)
  // — catálogo de peças com saldo/custo médio calculado a partir de um
  // ledger imutável de movimentos, integrado à Manutenção (vincula saída à
  // OS). Fecha o gap "Materiais sem controle real de peças".
  { href: "/estoque-pecas", label: "Estoque de Peças", icon: Boxes }, // PWA: Icons.inventory_2
  { href: "/tco", label: "TCO / Custo por Veículo", icon: Coins }, // PWA: Icons.pending
  // Fase Grupo 2 (Rodopar, item 6, 03/08/2026) — depreciação contábil linha
  // reta + correções do ativo (reavaliação/melhoria/baixa).
  { href: "/patrimonio", label: "Patrimônio", icon: Landmark }, // PWA: Icons.account_balance
  // Fase Indicadores-da-Frota (30/07/2026) — checklist de inspeção periódica
  // (pneus, freios, luzes etc.), alimenta os KPIs de conformidade e TMRNC em
  // /indicadores-frota.
  { href: "/checklist-veiculos", label: "Checklist de Inspeção", icon: ShieldCheck }, // PWA: Icons.fact_check
  // Fase Indicadores-da-Frota (30/07/2026) — registro de sinistros/acidentes,
  // alimenta o KPI de índice de sinistralidade em /indicadores-frota.
  { href: "/sinistros", label: "Sinistros", icon: AlertTriangle }, // PWA: Icons.warning_amber
  // Fase Onda-2 (benchmark TicketLog, item #4) — pedido do Daniel: ciclo de
  // multas (captura manual, indicação de condutor reaproveitando o vínculo
  // Motorista<->Veículo, histórico e alerta de prazo pro desconto).
  { href: "/multas", label: "Multas", icon: Gavel }, // PWA: Icons.gavel
  // Fase Onda-2 (benchmark TicketLog, item #5) — pedido do Daniel: catálogo
  // de oficinas credenciadas (admin credencia) + fluxo simples de
  // solicitação de orçamento pro cliente.
  { href: "/oficinas", label: "Rede de Oficinas", icon: Hammer }, // PWA: Icons.build_circle
];

// Fase reorganizacao-menu — antes espalhado dentro de Gestão, agora junto
// do que sempre foi, na prática, a mesma preocupação: dinheiro entrando e
// saindo.
const menuFinanceiro: ItemMenuLateral[] = [
  { href: "/financeiro", label: "Painel Financeiro", icon: DollarSign }, // PWA: Icons.attach_money
  // Fase Grupo 1 Rodopar item 3 (03/08/2026, benchmark FNI vs Rodopar/
  // Datapar) — importa extrato (OFX/CSV) e sugere vínculo com contas_pagar/
  // contas_receber já lançadas, confirmando a baixa com um clique.
  { href: "/conciliacao-bancaria", label: "Conciliação Bancária", icon: ArrowLeftRight }, // PWA: Icons.compare_arrows
  // Fase P0.1 (roadmap TMS/ERP) — configuração do emitente de CT-e/MDF-e
  // (dados fiscais, certificado A1 via provedor, teste de conexão).
  { href: "/fiscal", label: "Fiscal (CT-e/MDF-e)", icon: Receipt },
];

// Fase reorganizacao-menu — visão consolidada, fora do dia a dia
// operacional.
const menuRelatorios: ItemMenuLateral[] = [
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 }, // PWA: Icons.bar_chart
  // Fase Onda-3 (benchmark TicketLog, item #10) — pedido do Daniel: estimativa
  // de CO2 emitido pela frota a partir dos litros já registrados nos
  // abastecimentos (fatores de emissão em fatores_emissao_co2).
  { href: "/pegada-carbono", label: "Pegada de Carbono", icon: Globe }, // PWA: Icons.public
  // Fase 27.151 — pedido do Daniel: "faz todo o sentido deixar na visão do
  // cliente [Inteligência de Rede]". A tela (que já era admin-only) passou
  // a aceitar também o perfil cliente, mostrando só a rede da PRÓPRIA
  // empresa (nunca a de outros clientes — ver comentário em
  // inteligencia-rede/page.tsx). Continua também em Administração, com
  // visão consolidada de toda a plataforma pro admin.
  { href: "/inteligencia-rede", label: "Inteligência de Rede", icon: Network }, // PWA: Icons.hub
];

// Fase reorganizacao-menu — programas voltados pro motorista, que hoje
// ficavam soltos no meio da antiga Operação.
const menuEngajamento: ItemMenuLateral[] = [
  // Fase 27.130 — indicadores do programa "Estrada que Cuida" (app próprio
  // do motorista) por motorista; RPC indicadores_fidelidade_motoristas já
  // checa autorização por empresa/admin internamente.
  { href: "/fidelidade-motoristas", label: "Fidelidade dos Motoristas", icon: Gift },
  // Fase Parcerias Locais (17/07) — o cliente cria seus próprios benefícios
  // (treinamentos, marketplace, telemedicina etc.) no catálogo de
  // fidelidade; mesma tela também vive em menuPostoOperacao (ver abaixo).
  { href: "/parcerias-locais", label: "Parcerias Locais", icon: Gift }, // PWA: Icons.card_giftcard
];

// Fase reorganizacao-menu — o que era o topo da antiga Gestão (Assistente,
// Assinatura, Avaliação, Treinamento) mais Chamados, que antes vinha
// hardcoded fora de qualquer array (ver GrupoMenuLateral.tsx pro porquê de
// juntar tudo aqui: mesmo tema, "cuidar da própria conta e pedir ajuda").
const menuContaAjuda: ItemMenuLateral[] = [
  { href: "/assistente", label: "Assistente FNI", icon: Bot },
  { href: "/assinatura", label: "Minha Assinatura", icon: CreditCard }, // PWA: Icons.credit_card
  { href: "/avaliar", label: "Avaliar Plataforma", icon: Star }, // PWA: Icons.star
  // Fase Central-Treinamento (20/07/2026) — pedido do Daniel: treinamento
  // interativo com lições por módulo, screenshots reais e (via Assistente
  // FNI) tira-dúvidas de uso — reduz dependência de time comercial/
  // treinamento humano num produto self-service.
  { href: "/treinamento", label: "Central de Treinamento", icon: GraduationCap },
  { href: "/chamados", label: "Chamados", icon: Ticket },
  // Fase Central-Avisos-Por-Empresa (04/08/2026) — some pro admin (filtro
  // em itensContaAjuda abaixo, mesma exceção de /assinatura e /avaliar): ele
  // já publica avisos oficiais em Administração → Central de Avisos.
  { href: "/central-avisos/gerenciar", label: "Meus Avisos", icon: Megaphone },
];

// Fase reorganizacao-menu — documentos, privacidade e as poucas telas de
// configuração/integração que o cliente (não-admin) pode tocar. Permissões
// entrou aqui (antes tinha uma seção "Configurações" só pra ela) — some
// pro admin via o filtro em itensSistema abaixo, porque ele já vê
// "Permissões por Perfil" em Administração.
const menuSistema: ItemMenuLateral[] = [
  // Fase 27.149 — upload de documentação societária/cadastral (Contrato
  // Social, docs dos sócios, comprovante de endereço), aprovada pelo admin
  // em /documentos-empresas — pré-requisito pra criar/aderir a Redes de
  // Postos/Grupos Econômicos e aceitar/criar negociações.
  { href: "/documentos", label: "Documentos", icon: Folder }, // PWA: Icons.folder
  { href: "/lgpd", label: "Privacidade (LGPD)", icon: Lock }, // PWA: Icons.lock
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/permissoes", label: "Permissões", icon: KeyRound },
];

// Fase 27.50 — menu do posto revendedor (perfil "posto", tenant segmento
// "Revenda"). Trilha própria, separada da hierarquia de Frota.
// Fase reorganizacao-menu (04/08/2026) — mesma reorganização por tema
// aplicada do lado Frota (ver comentário grande acima de menuVisaoGeral):
// as antigas "Gestão" (13 itens) e "Operação" (8) do posto viraram 6 grupos
// menores. O posto nunca teve o problema de escala da Frota (33 itens numa
// seção só), mas o pedido do Daniel foi explícito — "implemente nas visoes
// web e PWA de clientes E postos" — pra manter os dois lados consistentes.
const menuPostoVisaoGeral: ItemMenuLateral[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, // PWA: Icons.dashboard
  // Fase 27.137 — pedido do Daniel: cadastro do estabelecimento (CNPJ,
  // razão social, endereço, contatos, lat/long) logo na adesão do posto,
  // comparado com a base ANP pra evitar registro duplicado/sobreposto —
  // perto do topo do menu de propósito, é o primeiro passo esperado de
  // quem acabou de aderir.
  { href: "/meu-posto", label: "Meu Posto", icon: MapPin }, // PWA: Icons.place
  // Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão
  // do posto para criação e gestão". RLS/código permitem que um posto crie
  // e gerencie sua própria Rede (ver gruposEconomicos.ts). Continua também
  // em Administração, pra visão global do admin sobre todas as redes.
  { href: "/rede-postos", label: "Rede de Postos", icon: Network }, // PWA: Icons.hub
];

// Fase reorganizacao-menu — quem acessa o posto e quem já negociou com ele.
const menuPostoCadastros: ItemMenuLateral[] = [
  { href: "/usuarios", label: "Usuários", icon: Users },
  // Fase Convite-Self-Service (26/07/2026) — o próprio posto convida
  // colegas só pra própria empresa, sem depender do time interno FNI.
  { href: "/minha-equipe", label: "Minha Equipe", icon: Users },
  // Fase 27.72 — cadastro dos clientes que já negociaram com o posto
  // (qualquer status), com ciclo de abastecimento/pagamento por cliente.
  { href: "/clientes-posto", label: "Clientes", icon: Building2 },
];

// Fase 27.130 — o dia a dia operacional do posto: negociar com clientes
// (aceitar/recusar/contrapropor o que o cliente enviou, ou enviar proposta
// via API), registrar abastecimentos, acompanhar preço/nota fiscal de cada
// relação comercial.
const menuPostoOperacao: ItemMenuLateral[] = [
  { href: "/negociacoes", label: "Negociações", icon: Handshake },
  { href: "/abastecimentos", label: "Abastecimentos", icon: Fuel },
  // Fase Parcerias Locais (17/07) — o posto cria seus próprios benefícios
  // (vale-refeição, banho, estacionamento, lavagem/troca de óleo, produtos
  // da conveniência etc.) no catálogo de fidelidade "Estrada que Cuida",
  // publicados pra rede toda de motoristas resgatar. Mesma tela do lado
  // cliente (ver menuEngajamento acima) — RLS escopa por criador_empresa_id.
  { href: "/parcerias-locais", label: "Parcerias Locais", icon: Gift },
  // Fase Pré-Pedido — pedido do Daniel: consulta do Pré-Pedido gerado no
  // Plano de Viagem do cliente (número + pontos de abastecimento
  // pré-agendados), pra o posto confirmar antes de liberar o abastecimento.
  { href: "/pre-pedidos", label: "Pré-Pedidos", icon: ListChecks },
  { href: "/precos-postos", label: "Meus Preços", icon: Tag },
  // Fase 27.94/27.95 — upload de NF-e (XML) por abastecimento + indicador
  // de % de recolha, do lado do posto.
  { href: "/notas-fiscais", label: "Notas Fiscais", icon: FileText },
];

// Fase reorganizacao-menu — dinheiro entrando (financeiro) e os dados
// usados pra receber (PIX).
const menuPostoFinanceiro: ItemMenuLateral[] = [
  { href: "/financeiro-posto", label: "Financeiro", icon: DollarSign }, // PWA: Icons.attach_money
  // Fase 27.92 — self-service: cadastro da chave PIX usada como cedente no
  // boleto/documento de cobrança enviado aos clientes.
  { href: "/minha-empresa", label: "Meus Dados / PIX", icon: Landmark }, // PWA: Icons.account_balance
];

// Fase reorganizacao-menu — mesmo grupo "Conta e Ajuda" do lado Frota;
// Chamados entra aqui em vez de hardcoded fora de qualquer array (ver
// GrupoMenuLateral.tsx).
const menuPostoContaAjuda: ItemMenuLateral[] = [
  { href: "/assistente", label: "Assistente FNI", icon: Bot },
  { href: "/assinatura", label: "Minha Assinatura", icon: CreditCard },
  { href: "/avaliar", label: "Avaliar Plataforma", icon: Star },
  { href: "/treinamento", label: "Central de Treinamento", icon: GraduationCap },
  { href: "/chamados", label: "Chamados", icon: Ticket },
  // Fase Central-Avisos-Por-Empresa (04/08/2026) — mesmo item do lado Frota.
  { href: "/central-avisos/gerenciar", label: "Meus Avisos", icon: Megaphone },
];

// Fase reorganizacao-menu — documentos, privacidade e a chave de API.
const menuPostoSistema: ItemMenuLateral[] = [
  // Fase 27.149 — mesmo item de /documentos do lado Frota (menuSistema,
  // ver acima), disponível também pro posto.
  { href: "/documentos", label: "Documentos", icon: Folder },
  { href: "/lgpd", label: "Privacidade (LGPD)", icon: Lock },
  { href: "/integracoes", label: "Integrações", icon: Plug },
];

const menuAdministracao = [
  { href: "/permissoes", label: "Permissões por Perfil", icon: KeyRound }, // PWA: Icons.vpn_key
  // Fase 27.149 — fila de revisão da documentação societária/cadastral
  // enviada por postos e clientes em /documentos (Contrato Social, docs
  // dos sócios, comprovante de endereço).
  { href: "/documentos-empresas", label: "Aprovação de Documentos", icon: FolderOpen }, // PWA: Icons.folder_open
  // Fase 27.161 — pedido do Daniel: "remover a duplicidade, pois ja esta
  // dentro de Gestão" — o admin via "Inteligência de Rede" 2x (aqui E em
  // Gestão, ver comentário da Fase 27.151 em menuVisaoGeral). O item
  // continua existindo com visão consolidada da rede toda pro admin
  // (inteligencia-rede/page.tsx), só o link duplicado saiu daqui.
  { href: "/assinaturas", label: "Assinaturas (todos os clientes)", icon: CreditCard },
  { href: "/avaliacoes", label: "Avaliações dos Clientes", icon: Star }, // PWA: Icons.star_outline
  // Fase 27.129 — pedido do Daniel: "Rede de Postos nao faz sentido estar na
  // visao do cliente". Escrita já era admin-only em código
  // (gruposEconomicos.ts::ehAdminOuSuperusuario), então deixava o item no
  // menu do cliente sem nenhuma ação que ele pudesse de fato realizar ali —
  // movido pra Administração, junto de Grupo Econômico/Assinaturas/etc.
  { href: "/rede-postos", label: "Rede de Postos", icon: Network },
  // Fase 27.137 — fila de revisão dos possíveis duplicados sinalizados pela
  // checagem de "Meu Posto" contra a base ANP (endereço/coordenadas muito
  // próximos de outro posto, CNPJ diferente) — nunca bloqueia o posto, só
  // sinaliza pra um admin decidir aqui.
  { href: "/postos-duplicados", label: "Possíveis Duplicados (Postos)", icon: FileSearch }, // PWA: Icons.find_in_page
  // Fase 27.86 — parâmetros globais do sistema (hoje só o timeout de
  // logout por inatividade; ver /configuracoes).
  { href: "/configuracoes", label: "Configurações do Sistema", icon: Settings },
  // Programa "Estrada que Cuida" (app do motorista) — catálogo de resgate
  // simulado (v1, sem parceiros reais) + fila de resgates pra cumprimento
  // manual. Ver PROPOSTA-FIDELIDADE-MOTORISTA.md.
  { href: "/fidelidade", label: "Catálogo de Fidelidade", icon: Gift },
  // Fase Central-Treinamento (20/07/2026) — pedido do Daniel: treinamento
  // interativo sem depender de time comercial/técnico. CRUD do conteúdo
  // que alimenta o ícone "?" e a Central de Treinamento (/treinamento).
  { href: "/administracao/central-conteudo", label: "Central de Conteúdo", icon: GraduationCap },
  // Fase P0.5 — piso mínimo ANTT (Res. 5.867/2020), tabela nacional
  // importável via XLSX, só admin.
  { href: "/administracao/pisos-antt", label: "Piso Mínimo ANTT", icon: Scale },
  // Fase Central-Avisos (28/07/2026) — pedido do Daniel: canal oficial pra
  // comunicar novidades/correções/manutenção-indisponibilidade/avisos gerais
  // a clientes, motoristas e postos, sem depender de e-mail/WhatsApp. CRUD
  // do que alimenta o sino no rodapé do menu (ver <AvisosSino /> abaixo).
  { href: "/administracao/central-avisos", label: "Central de Avisos", icon: Bell },
  // Fase Onda-2 (benchmark TicketLog, item #5) — CRUD do catálogo nacional
  // de oficinas credenciadas, exibido pro cliente em /oficinas.
  { href: "/administracao/oficinas-credenciadas", label: "Oficinas Credenciadas", icon: Hammer },
];

// Fase Acesso-Rápido-Favoritos (04/08/2026, pedido do Daniel) — mapa
// achatado de TODOS os itens de menu possíveis (frota + posto +
// administração), usado só pra: (1) resolver label/ícone de um href
// favoritado, sem duplicar essa informação em outro lugar; (2) saber quais
// hrefs são "rastreáveis" (contam acesso pra frecência — ver
// RastreadorAcessoMenu.tsx). Um mesmo href pode aparecer em mais de um
// array (ex.: /assistente em menuContaAjuda E menuPostoContaAjuda, sempre
// com o mesmo label/ícone; /permissoes em menuSistema E menuAdministracao,
// com labels levemente diferentes) — o Map só guarda a última ocorrência,
// sem consequência prática pra decidir a ordem dos favoritos.
const TODOS_ITENS_MENU: ItemMenuLateral[] = [
  ...menuVisaoGeral,
  ...menuCadastros,
  ...menuRoteirizacaoAbastecimento,
  ...menuFretes,
  ...menuManutencaoAtivos,
  ...menuFinanceiro,
  ...menuRelatorios,
  ...menuEngajamento,
  ...menuContaAjuda,
  ...menuSistema,
  ...menuPostoVisaoGeral,
  ...menuPostoCadastros,
  ...menuPostoOperacao,
  ...menuPostoFinanceiro,
  ...menuPostoContaAjuda,
  ...menuPostoSistema,
  ...menuAdministracao,
];
const MAPA_ITENS_MENU = new Map(TODOS_ITENS_MENU.map((item) => [item.href, item]));
const HREFS_RASTREAVEIS = TODOS_ITENS_MENU.map((item) => item.href);

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
    acoesSugeridasPendentes,
    cadastrosPendentes,
    multasPendentes,
    logoutInatividadeMinutos,
    avisos,
    favoritosBrutos,
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
      // Fase Motor-de-Ação-Automática — bolinha de ações sugeridas pendentes
      // (CNH vencida, posto acima da média, hodômetro fora do padrão),
      // mesma blindagem "falha vira 0" das demais contagens.
      contarAcoesSugeridasPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar ações sugeridas pendentes (ignorado):", e);
        return 0;
      }),
      // Fase auto-cadastro-abastecimento — bolinha de veículos/motoristas
      // criados automaticamente por integração de abastecimento, ainda sem
      // o resto do cadastro (mesma blindagem "falha vira 0" das demais).
      contarCadastrosPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar cadastros pendentes (ignorado):", e);
        return 0;
      }),
      // Fase Onda-2 (benchmark TicketLog, item #4) — bolinha de multas
      // pendentes de indicação com prazo vencendo em até 7 dias, mesma
      // blindagem "falha vira 0" das demais contagens.
      contarMultasPendentesAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao contar multas pendentes (ignorado):", e);
        return 0;
      }),
      // Fase 27.86 — timeout do logout automático por inatividade, lido
      // aqui (não só no filho /configuracoes) porque o MonitorInatividade
      // roda em TODA tela do dashboard; buscarLogoutInatividadeMinutos já
      // tem fallback interno pro padrão (30min) se a leitura falhar.
      buscarLogoutInatividadeMinutos(supabase),
      // Fase Central-Avisos (28/07/2026) — já vem segmentada (por
      // segmento/plano/empresa do usuário) e com `lido` calculado; o sino
      // (badge) e o banner fixo (fixado=true) abaixo só filtram em memória,
      // sem query extra. Mesma blindagem "falha vira 0/[]" das demais.
      listarAvisosAcao().catch((e) => {
        console.error("[dashboard/layout] falha ao listar avisos (ignorado):", e);
        return [];
      }),
      // Fase Acesso-Rápido-Favoritos (04/08/2026) — lista já ordenada
      // (fixados manualmente primeiro, depois os de maior frecência) pra
      // alimentar a barra de atalhos e as estrelas do menu lateral; mesma
      // blindagem "falha vira []" das demais. `supabase.rpc(...)` devolve um
      // PostgrestFilterBuilder (thenable, mas sem `.catch` de verdade) — por
      // isso a IIFE async em vez de encadear `.then().catch()` direto nele.
      (async (): Promise<{ href: string; fixado: boolean }[]> => {
        try {
          const { data, error } = await supabase.rpc("favoritos_menu_do_usuario", { p_limite: 8 });
          if (error) throw error;
          return data ?? [];
        } catch (e) {
          console.error("[dashboard/layout] falha ao buscar favoritos do menu (ignorado):", e);
          return [];
        }
      })(),
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

  // Fase enforcement-permissoes (04/08/2026, pedido do Daniel: "as
  // permissoes deveriam travar se estiverem desligadas, tanto na web quanto
  // no PWA") — até aqui, a matriz de /permissoes só editava a tabela, nada
  // no app lia essas linhas de verdade (achado registrado na fase anterior).
  // Daqui pra baixo: filtra os itens de menu pelo que o perfil atual NÃO tem
  // acesso, e bloqueia (redirect) quem tenta acessar a URL direta de uma
  // tela sem permissão — ver src/lib/permissoes.ts pro mapa de rotas e as
  // limitações conhecidas (só o padrão global é aplicado no bloqueio, não a
  // customização por empresa).
  const bypassPermissao = ehBypassPermissao(perfilUsuario?.perfil, user.email);
  const mapaPermissoes =
    !bypassPermissao && perfilUsuario?.perfil
      ? await carregarMapaPermissoes(supabase, perfilUsuario.perfil)
      : new Map<string, boolean>();
  const podeAcessar = (funcionalidade: string | null) => bypassPermissao || temAcesso(mapaPermissoes, funcionalidade);
  // Mesma checagem acima, mas a partir do href de um item de menu — usada
  // pra filtrar cada uma das listas de menu abaixo (item some quando o
  // perfil atual não tem permissão pra funcionalidade correspondente).
  const podeAcessarItem = (item: { href: string }) => podeAcessar(HREF_FUNCIONALIDADE[item.href] ?? null);

  // Fase Acesso-Rápido-Favoritos (04/08/2026) — resolve os hrefs favoritados
  // (fixados manualmente ou sugeridos por frecência) pra label/ícone via
  // MAPA_ITENS_MENU, descartando o que não existir mais em nenhum menu ou
  // cuja permissão tenha sido revogada depois de favoritado (mesma checagem
  // `podeAcessarItem` usada nas demais listas — nunca mostra um atalho pra
  // uma tela que o usuário não pode mais acessar). `favoritosHrefsSet` é só
  // pra saber, em O(1), se um href já está no acesso rápido (desenha a
  // estrela cheia/vazia em cada item do menu lateral).
  const itensFavoritos: ItemAtalho[] = favoritosBrutos
    .map((f: { href: string; fixado: boolean }): ItemAtalho | null => {
      const item = MAPA_ITENS_MENU.get(f.href);
      // Bugfix pós-deploy (04/08/2026) — o ícone precisa ir JÁ RENDERIZADO
      // (elemento React), nunca a referência crua do componente: este
      // layout.tsx é Server Component e BarraAtalhosFavoritos é "use
      // client" — passar a função do ícone direto pela fronteira derrubava
      // toda página do dashboard ("Functions cannot be passed directly to
      // Client Components..."). Ver comentário completo em
      // BarraAtalhosFavoritos.tsx.
      return item && podeAcessarItem(item)
        ? {
            href: f.href,
            label: item.label,
            icon: item.icon ? <item.icon className="h-3.5 w-3.5 shrink-0 text-frota-600" /> : undefined,
          }
        : null;
    })
    .filter((item): item is ItemAtalho => item !== null);
  const favoritosHrefsSet = new Set(itensFavoritos.map((i) => i.href));

  const headersRequisicao = await headers();
  const pathnameAtual = headersRequisicao.get("x-pathname") ?? "";
  const acessoNegado = (headersRequisicao.get("x-search") ?? "").includes("acesso=negado");
  if (!podeAcessar(resolverFuncionalidadeDaRota(pathnameAtual))) {
    redirect("/dashboard?acesso=negado");
  }

  const ehAdmin = perfilUsuario?.perfil === "admin";

  // Fase reorganizacao-menu (04/08/2026) — badges por href num único mapa,
  // consumido por GrupoMenuLateral em qualquer grupo (cliente ou posto),
  // em vez de repetir `item.href === "/x" && contagem > 0` dentro de cada
  // seção. Motivo real: com os 10 grupos novos, essa repetição por seção
  // teria multiplicado a mesma dívida técnica que já existia — achado ao
  // revisar o arquivo antes desta fase, o badge de "/antifraude" no
  // antigo menuOperacao já era código morto (a rota saiu do menu faz
  // tempo e ninguém tinha limpado a condicional).
  const badgesMenu: Record<string, number> = {
    "/clientes": acessosClientesNaoVistos,
    "/cadastros-pendentes": cadastrosPendentes,
    "/negociacoes": negociacoesPendentes,
    "/abastecimentos": ajustesAbastecimentosPendentes,
    "/acoes-sugeridas": acoesSugeridasPendentes,
    "/multas": multasPendentes,
    "/chamados": chamadosNaoVistos,
  };

  const itensVisaoGeral = menuVisaoGeral.filter(podeAcessarItem);

  // Fase 27.50 — perfil "posto" é uma trilha própria (Revenda), separada da
  // hierarquia de Frota (mesmo espírito da Fase 27.39 em /permissoes): vê um
  // menu bem mais enxuto, sem nenhuma das telas de gestão de frota.
  const ehPosto = perfilUsuario?.perfil === "posto";

  // Achado real de segurança (26/07/2026, investigando um 404 reportado
  // pelo Daniel ao criar um usuário): a RLS de usuarios_app só deixa
  // admin/analista (time interno) enxergarem outros usuários — mas o link
  // "Usuários" aparecia no menu pra QUALQUER perfil (gestor_frota, posto),
  // que conseguia até criar convites (a Server Action usava o cliente
  // admin sem checar quem chamava, já corrigido em usuarios/actions.ts).
  // Tira o item do menu pra quem não pode mesmo usar a tela.
  const podeGerenciarUsuarios = ehAdmin || perfilUsuario?.perfil === "analista";
  // Fase Convite-Self-Service (26/07/2026) — "Minha Equipe" é exclusivo de
  // quem é DONO de uma empresa própria (gestor_frota ou posto); admin/
  // analista já têm "Usuários" (visão global) e colaborador não convida
  // ninguém.
  const podeConvidarEquipe = perfilUsuario?.perfil === "gestor_frota" || perfilUsuario?.perfil === "posto";
  const itensCadastrosFiltrados = (podeGerenciarUsuarios ? menuCadastros : menuCadastros.filter((i) => i.href !== "/usuarios"))
    .filter((i) => i.href !== "/minha-equipe" || podeConvidarEquipe)
    .filter(podeAcessarItem);
  const itensPostoCadastrosFiltrados = (podeGerenciarUsuarios ? menuPostoCadastros : menuPostoCadastros.filter((i) => i.href !== "/usuarios"))
    .filter((i) => i.href !== "/minha-equipe" || podeConvidarEquipe)
    .filter(podeAcessarItem);

  const itensRoteirizacaoAbastecimento = menuRoteirizacaoAbastecimento.filter(podeAcessarItem);
  const itensFretes = menuFretes.filter(podeAcessarItem);
  const itensManutencaoAtivos = menuManutencaoAtivos.filter(podeAcessarItem);
  const itensFinanceiro = menuFinanceiro.filter(podeAcessarItem);
  const itensRelatorios = menuRelatorios.filter(podeAcessarItem);
  const itensEngajamento = menuEngajamento.filter(podeAcessarItem);
  // Admin (time interno FNI) não assina um plano nem avalia a plataforma
  // como cliente — ele só gerencia as assinaturas e acompanha as avaliações
  // de todos os clientes via "Assinaturas (todos os clientes)" e
  // "Avaliações dos Clientes", em Administração. Por isso "Minha Assinatura"
  // e "Avaliar Plataforma" somem do menu pra esse perfil (mesma exceção de
  // sempre, só que agora aplicada a "Conta e Ajuda" em vez da antiga
  // "Gestão").
  const itensContaAjuda = menuContaAjuda
    .filter(
      (item) =>
        !ehAdmin || (item.href !== "/assinatura" && item.href !== "/avaliar" && item.href !== "/central-avisos/gerenciar")
    )
    .filter(podeAcessarItem);
  // "Permissões" tinha uma seção "Configurações" só pra ela, visível só pra
  // quem não era admin nem posto (Fase 27.117); agora mora em "Sistema" — o
  // filtro abaixo preserva a mesma regra pro admin (que já vê "Permissões
  // por Perfil" em Administração, não precisa ver de novo aqui). Posto não
  // entra nessa conta porque `menuPostoSistema` é uma lista própria, sem
  // Permissões.
  const itensSistema = menuSistema
    .filter((item) => !ehAdmin || item.href !== "/permissoes")
    .filter(podeAcessarItem);

  const itensPostoVisaoGeral = menuPostoVisaoGeral.filter(podeAcessarItem);
  const itensPostoOperacaoFiltrados = menuPostoOperacao.filter(podeAcessarItem);
  const itensPostoFinanceiro = menuPostoFinanceiro.filter(podeAcessarItem);
  const itensPostoContaAjuda = menuPostoContaAjuda
    .filter((item) => !ehAdmin || item.href !== "/central-avisos/gerenciar")
    .filter(podeAcessarItem);
  const itensPostoSistema = menuPostoSistema.filter(podeAcessarItem);

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
    <RastreadorAcessoMenu hrefsRastreaveis={HREFS_RASTREAVEIS} />
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
            {/* Fase reorganizacao-menu (04/08/2026, pedido do Daniel: "Fazer
                uma sugestao de reorganizacao do menu" / "Organizacao de
                temas iguais", aplicada nas visões cliente E posto) — as
                antigas "Gestão"/"Operação" do posto (Fase 27.130) viraram 6
                grupos temáticos, mesmo espírito da reorganização do lado
                Frota logo abaixo (ver comentário grande em menuVisaoGeral,
                no topo do arquivo). */}
            <GrupoMenuLateral titulo="Visão Geral" itens={itensPostoVisaoGeral} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} primeiro />
            <GrupoMenuLateral titulo="Cadastros" itens={itensPostoCadastrosFiltrados} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Operação" itens={itensPostoOperacaoFiltrados} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Financeiro" itens={itensPostoFinanceiro} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Conta e Ajuda" itens={itensPostoContaAjuda} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Sistema" itens={itensPostoSistema} badges={badgesMenu} tourPorHref={TOUR_POR_HREF_POSTO} favoritos={favoritosHrefsSet} />
            </>
          ) : (
          <>
          <GrupoMenuLateral
            titulo="Visão Geral"
            itens={itensVisaoGeral}
            badges={badgesMenu}
            tourPorHref={TOUR_POR_HREF}
            dataTourTitulo="menu-geral"
            favoritos={favoritosHrefsSet}
            primeiro
          />
          <GrupoMenuLateral titulo="Cadastros" itens={itensCadastrosFiltrados} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} dataTourTitulo="menu-cadastros" favoritos={favoritosHrefsSet} />

          {/* Fase reorganizacao-menu — os 3 grupos que substituíram a antiga
              "Operação" (33 itens numa lista só) ficam dentro de um mesmo
              `data-tour="menu-operacao"`, pra o passo do tour continuar
              destacando a área operacional inteira (e não só o primeiro
              subgrupo) sem precisar reescrever o texto do passo em
              tourPassos.ts. */}
          <div data-tour="menu-operacao">
            <GrupoMenuLateral titulo="Roteirização e Abastecimento" itens={itensRoteirizacaoAbastecimento} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Fretes" itens={itensFretes} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
            <GrupoMenuLateral titulo="Manutenção e Ativos" itens={itensManutencaoAtivos} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
          </div>
          <GrupoMenuLateral titulo="Financeiro" itens={itensFinanceiro} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
          <GrupoMenuLateral titulo="Relatórios e Sustentabilidade" itens={itensRelatorios} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
          <GrupoMenuLateral titulo="Engajamento" itens={itensEngajamento} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
          <GrupoMenuLateral titulo="Conta e Ajuda" itens={itensContaAjuda} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />
          <GrupoMenuLateral titulo="Sistema" itens={itensSistema} badges={badgesMenu} tourPorHref={TOUR_POR_HREF} favoritos={favoritosHrefsSet} />

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
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0 text-slate-300" />
                        {item.label}
                      </span>
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
          <AvisosSino avisosIniciais={avisos} />
          <CentralAjuda />
          <BotaoSair />
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">
        {/* Fase Acesso-Rápido-Favoritos (04/08/2026, pedido do Daniel) —
            barra de atalhos pras telas mais usadas (frecência) ou fixadas
            manualmente, primeira coisa visível no conteúdo. */}
        <BarraAtalhosFavoritos itensIniciais={itensFavoritos} />
        {/* Fase Central-Avisos — banner fixo pros avisos fixado=true (ex.:
            manutenção em andamento), acima até do lembrete de PWA. */}
        <AvisoBannerFixo avisos={avisos.filter((a) => a.fixado)} />
        {/* Pedido do Daniel (19/07): lembrete sobre a PWA mobile nas visões
            de cliente e posto — não pro admin (time interno FNI), que não é
            o público desse benefício. */}
        {!ehAdmin && <LembretePwaBanner />}
        {/* Fase enforcement-permissoes — aviso depois do redirect de
            bloqueio de rota (ver resolverFuncionalidadeDaRota acima). */}
        {acessoNegado && (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Seu perfil não tem permissão para acessar aquela tela. Fale com quem gerencia a
            equipe se você acha que deveria ter acesso.
          </div>
        )}
        {children}
      </main>
    </div>
    <MonitorInatividade minutos={logoutInatividadeMinutos} />
    </TourProvider>
  );
}
