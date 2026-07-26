// Termo de Adesão e Contrato de Prestação de Serviços — texto oficial.
//
// Calibração TMS/ERP (23/07/2026, pedido do Daniel): o termo deixou de ser
// um texto único (Versão 1.0, que enumerava os 3 planos numa cláusula só) e
// passou a ter uma Cláusula 3ª ESPECÍFICA por plano contratado — o cliente
// só lê e assina as condições do plano que ele realmente está assinando,
// já refletindo o posicionamento da plataforma como TMS/ERP (módulo de
// Gestão de Fretes, CT-e/MDF-e, faturamento de fretes). Versão bumped pra
// 2.0 por causa dessa mudança estrutural.
//
// IMPORTANTE: este texto é a fonte canônica usada tanto pra exibir o termo
// no modal de aceite (`ModalTermoAdesao`) quanto pro comprovante em PDF
// (`TermoAdesaoPdf`). Os hashes abaixo (HASH_TERMO_ADESAO_POR_PLANO) foram
// calculados uma única vez a partir do texto de CADA plano (SHA-256 do
// resultado de `montarParagrafosTermoAdesao(plano).join("\n")`) e estão
// hardcoded — de forma idêntica — na Edge Function que trata a adesão
// (`create-checkout-session`), porque Edge Functions do Supabase são
// deployadas separadamente e não importam arquivos do Next.js. Se o texto
// de algum plano mudar: 1) recalcular o hash SÓ daquele plano, 2) atualizar
// o hash hardcoded na Edge Function, 3) documentar no README. Não é preciso
// mudar VERSAO_TERMO_ADESAO pra um ajuste pontual num único plano — só para
// mudanças estruturais que afetem os 3 (como esta).
export const VERSAO_TERMO_ADESAO = "2.0";

export type PlanoComTermo = "basico" | "profissional" | "enterprise";

export const HASH_TERMO_ADESAO_POR_PLANO: Record<PlanoComTermo, string> = {
  basico: "069dae7acc7750c63d4a2ff9357d8029bd234ccbeb3a0a8f62a2a7d59a4d22ed",
  profissional: "72b2edc95d19d23daf51e2faba057291c624f10e39920254e35e419d33eba38c",
  enterprise: "dc6c424a26850b62246786acb7598a3da144ff822b354bff2c205a52e5cf7da5",
};

const CABECALHO_COMUM = [
  "FLEET NETWORK INTELLIGENCE — FNI Gestão de Frotas (fxgestaodefrotasonline.com)",
  "",
  "PARTE I — DAS PARTES E DO OBJETO",
  "Cláusula 1ª — Das Partes. 1.1. CONTRATADA: FLEET NETWORK INTELLIGENCE LTDA. (FNI), operadora da plataforma SaaS FNI Gestão de Frotas, acessível em fxgestaodefrotasonline.com. 1.2. CONTRATANTE: pessoa física ou jurídica que realiza a adesão eletrônica, doravante denominada CLIENTE.",
  "Cláusula 2ª — Do Objeto. 2.1. Prestação de serviços de Software como Serviço (SaaS) de gestão inteligente de frotas, combustíveis e fretes (TMS/ERP para transportadoras), nos limites do plano contratado. 2.2. Recursos gerais da plataforma: consulta e análise de preços ANP (~38.000 postos); roteirização otimizada para frotas; dashboard analítico e comparativos ANP; relatórios exportáveis em PDF e Excel; Assistente IA; API e integrações com Ticket Log, Rede Frota, Veloe e Pró-Frotas.",
  "",
];

// Cláusula 3ª — a única parte do termo que varia por plano. Cada plano lista
// só as SUAS condições reais (limites de usuários/veículos, o que o plano
// libera do módulo de Gestão de Fretes/TMS, e o prazo de suporte) — nunca os
// outros planos, pra não confundir o cliente sobre o que ele está de fato
// contratando. Precisa continuar batendo com LIMITES_PLANO/FAIXA_VEICULOS_
// PLANO/FEATURES_PLANO (src/lib/constants.ts) e com verificarAcessoFretes
// (src/lib/limitePlano.ts) — se um desses mudar, revisar o texto aqui também
// (e recalcular o hash do plano afetado).
const CLAUSULA_3_POR_PLANO: Record<PlanoComTermo, string> = {
  basico:
    "Cláusula 3ª — Plano Contratado: ESSENCIAL. 3.1. Limites: até 5 (cinco) usuários e até 50 (cinquenta) veículos, sendo os primeiros 20 (vinte) veículos inclusos no valor mensal desta adesão — veículos excedentes são cobrados automaticamente à razão de R$ 4,50 (quatro reais e cinquenta centavos) por veículo/mês. 3.2. Recursos inclusos: Roteirização, Rotograma e Planos de Viagem; consulta de preços ANP e Inteligência de Rede; cadastros de frota, motoristas e centros de custo; dashboard e relatórios básicos. 3.3. O plano Essencial NÃO inclui o módulo de Gestão de Fretes (TMS) — emissão de CT-e/MDF-e, faturamento de fretes, Cotações e Tabelas de Frete. 3.4. Suporte técnico em até 48 (quarenta e oito) horas úteis. 3.5. Trial gratuito de 14 dias, sem necessidade de cartão de crédito, antes da confirmação desta adesão.",
  profissional:
    "Cláusula 3ª — Plano Contratado: PROFISSIONAL. 3.1. Limites: até 20 (vinte) usuários e até 200 (duzentos) veículos, sendo os primeiros 60 (sessenta) veículos inclusos no valor mensal desta adesão — veículos excedentes são cobrados automaticamente à razão de R$ 3,50 (três reais e cinquenta centavos) por veículo/mês. 3.2. Recursos inclusos: todos os recursos do plano Essencial, mais o módulo de Gestão de Fretes (TMS) com criação de até 30 (trinta) fretes por mês; emissão de CT-e/MDF-e e faturamento de fretes; Cotações e Tabelas de Frete com piso mínimo ANTT; relatórios avançados; API e Webhooks. 3.3. O limite de 30 fretes/mês é renovado automaticamente no início de cada mês; fretes excedentes ao limite requerem upgrade para o plano Enterprise. 3.4. Suporte técnico em até 24 (vinte e quatro) horas úteis. 3.5. Trial gratuito de 14 dias, sem necessidade de cartão de crédito, antes da confirmação desta adesão.",
  enterprise:
    "Cláusula 3ª — Plano Contratado: ENTERPRISE. 3.1. Limites: usuários e veículos ilimitados, sendo os primeiros 150 (cento e cinquenta) veículos inclusos no valor mensal desta adesão — veículos excedentes são cobrados automaticamente à razão de R$ 2,50 (dois reais e cinquenta centavos) por veículo/mês. 3.2. Recursos inclusos: todos os recursos do plano Profissional, mais o módulo de Gestão de Fretes (TMS) sem limite de fretes criados por mês; Single Sign-On (SSO/SAML); integrações dedicadas com TOTVS/SAP; gerente de conta dedicado. 3.3. SLA (Service Level Agreement) de disponibilidade de 99,95% e suporte técnico 24x7 (24 horas por dia, 7 dias por semana). 3.4. Condições comerciais diferenciadas são negociáveis para frotas acima de 500 (quinhentos) veículos, mediante aditivo específico a este Termo.",
};

const RODAPE_COMUM = [
  "",
  "PARTE II — DAS CONDIÇÕES DE PAGAMENTO",
  "Cláusula 4ª — Condições de Pagamento. 4.1. Cobrança mensal recorrente via cartão ou boleto processado pela Stripe. 4.2. Renovação automática ao final de cada ciclo, salvo cancelamento com 5 dias de antecedência. 4.3. Reajuste anual com notificação prévia de 30 dias. 4.4. Inadimplência acima de 10 dias: suspensão, multa de 2% e juros de 1% a.m.",
  "",
  "PARTE III — DOS DIREITOS E OBRIGAÇÕES",
  "Cláusula 5ª — Direitos do Cliente: acessar todos os recursos do plano contratado (ver Cláusula 3ª); suporte técnico no prazo do plano contratado; portabilidade dos dados em até 30 dias por solicitação; exclusão de dados pessoais conforme LGPD; cancelamento sem multa com 5 dias de antecedência; notificação prévia de 30 dias sobre mudanças relevantes.",
  "Cláusula 6ª — Obrigações do Cliente: usar a plataforma exclusivamente para fins lícitos; não compartilhar credenciais com terceiros não autorizados; manter dados cadastrais atualizados; não realizar engenharia reversa ou extração não autorizada; não comprometer a segurança da plataforma; efetuar pagamentos nas datas acordadas.",
  "Cláusula 7ª — Obrigações da FNI: manter plataforma disponível conforme SLAs; proteger dados com TLS 1.3 em trânsito e criptografia em repouso; isolar dados entre tenants com Row Level Security; notificar incidentes de segurança em até 72 horas; manter backups por no mínimo 90 dias.",
  "",
  "PARTE IV — DO USO ADEQUADO",
  "Cláusula 8ª — Uso Aceitável e Restrições. 8.1. É expressamente proibido ao CLIENTE: acessar a plataforma por bots ou scrapers sem autorização; contornar mecanismos de autenticação ou controle de acesso; fazer upload de arquivos maliciosos ou código prejudicial; usar a plataforma em violação à LGPD ou Marco Civil da Internet; sublicenciar ou ceder acesso a terceiros sem consentimento da FNI.",
  "",
  "PARTE V — SEGURANÇA DA INFORMAÇÃO E LGPD",
  "Cláusula 9ª — Medidas de Segurança Adotadas: autenticação OAuth 2.0 via Google e Microsoft; MFA disponível para todos os usuários; TLS 1.3 obrigatório em todas as comunicações; dados em repouso criptografados no Supabase/PostgreSQL; isolamento por tenant com Row Level Security (RLS); WAF com proteção contra SQL Injection e XSS; logs de auditoria de todas as ações administrativas.",
  "Cláusula 10ª — Tratamento de Dados Pessoais (LGPD). 10.1. A FNI é Controladora dos dados pessoais nos termos da Lei nº 13.709/2018 (LGPD). 10.2. Dados tratados: identificação (nome, e-mail, CNPJ/CPF), dados de uso e dados operacionais inseridos pelo CLIENTE. 10.3. Bases legais: execução de contrato (art. 7º, V), legítimo interesse (art. 7º, IX) e consentimento (art. 7º, I). 10.4. Direitos dos Titulares: acesso, correção, eliminação, portabilidade e revogação via privacidade@fxgestaodefrotasonline.com. 10.5. DPO: contato@fxgestaodefrotasonline.com. 10.6. Retenção: 90 dias após cancelamento; logs de auditoria por 12 meses.",
  "",
  "PARTE VI — DA CONFIDENCIALIDADE",
  "Cláusula 11ª — Obrigação de Confidencialidade. 11.1. As Partes mantêm sigilo sobre informações confidenciais: dados operacionais, algoritmos, código-fonte, estratégias comerciais e dados de terceiros. 11.2. Vigência: 5 anos após encerramento deste Termo. 11.3. Exceções: domínio público ou ordem judicial/regulatória.",
  "",
  "PARTE VII — DISPOSIÇÕES GERAIS",
  "Cláusula 12ª — Propriedade Intelectual. 12.1. Todos os direitos sobre a plataforma (código, algoritmos, design) são de titularidade exclusiva da FNI. 12.2. O CLIENTE mantém propriedade sobre todos os dados que inserir na plataforma.",
  "Cláusula 13ª — Limitação de Responsabilidade. 13.1. A FNI não se responsabiliza por: decisões baseadas nas análises; imprecisões nos dados ANP; danos por uso indevido; interrupções por force majeure. 13.2. Responsabilidade total limitada ao valor pago nos últimos 3 meses de assinatura.",
  "Cláusula 14ª — Vigência, Rescisão e Foro. 14.1. Entra em vigor na data de adesão e permanece ativo enquanto a assinatura estiver vigente. 14.2. Rescisão pelo CLIENTE: a qualquer momento com 5 dias de antecedência, sem multa. 14.3. Foro: Comarca de São Paulo/SP.",
  "",
  "ASSINATURA ELETRÔNICA",
  "A adesão eletrônica mediante clique em 'Aceito os Termos de Adesão' tem plena validade jurídica nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020. Ao aceitar este Termo de Adesão, o CLIENTE também declara estar de acordo com os Termos de Uso gerais da plataforma FNI Gestão de Frotas.",
];

// Monta o texto completo do Termo de Adesão pro plano informado — mesma
// estrutura de sempre (título, PARTE I comum, Cláusula 3ª específica do
// plano, PARTE II em diante comum), só a Cláusula 3ª muda de plano pra
// plano. Usado tanto pelo modal de aceite quanto pelo PDF do comprovante.
export function montarParagrafosTermoAdesao(plano: PlanoComTermo): string[] {
  return [
    `TERMO DE ADESÃO E CONTRATO DE PRESTAÇÃO DE SERVIÇOS — Versão ${VERSAO_TERMO_ADESAO}`,
    ...CABECALHO_COMUM,
    CLAUSULA_3_POR_PLANO[plano],
    ...RODAPE_COMUM,
  ];
}

// Junta os parágrafos com quebra de linha simples — é exatamente este texto
// (mesmos parágrafos, mesmo separador) que gera o hash de cada plano em
// HASH_TERMO_ADESAO_POR_PLANO acima. Não alterar a lógica de junção sem
// recalcular os hashes na Edge Function create-checkout-session.
export function textoCanonicoTermoAdesao(plano: PlanoComTermo): string {
  return montarParagrafosTermoAdesao(plano).join("\n");
}
