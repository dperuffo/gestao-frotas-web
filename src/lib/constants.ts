// Valores fixos que espelham exatamente as CHECK constraints do banco.
// Sempre que uma dessas listas mudar no banco, atualizar aqui também.

export const STATUS_EMPRESA = ["trial", "ativo", "suspenso", "cancelado"] as const;
export type StatusEmpresa = (typeof STATUS_EMPRESA)[number];

export const STATUS_EMPRESA_LABEL: Record<StatusEmpresa, string> = {
  trial: "Em teste (trial)",
  ativo: "Ativo",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

export const PLANOS = ["gratuito", "basico", "profissional", "enterprise"] as const;
export type Plano = (typeof PLANOS)[number];

// Calibração TMS/ERP (23/07/2026, pedido do Daniel): o plano 'basico' passa
// a ser exibido como "Essencial" — a chave interna continua 'basico' (bate
// com a CHECK constraint do banco, com PLANO_PARA_PRICE_ID nas Edge
// Functions e com todo o resto do código), só o rótulo mudou. Mantido em
// sincronia manual com o mesmo PLANO_LABEL da Edge Function
// stripe-webhook/index.ts (não existe em planos-precos/create-checkout-
// session, que não precisam do label, só do price_id).
export const PLANO_LABEL: Record<Plano, string> = {
  gratuito: "Gratuito",
  basico: "Essencial",
  profissional: "Profissional",
  enterprise: "Enterprise",
};

// Calibração TMS/ERP (23/07/2026): destaques de cada plano pago, mostrados
// nos cards de /assinatura (Minha Assinatura) — reflete o posicionamento da
// plataforma como TMS/ERP pra transportadoras (não só hub de meios de
// pagamento). Cuidado ao editar: cada item aqui precisa ser algo que o
// plano REALMENTE libera hoje no código (ver verificarAcessoFretes em
// src/lib/limitePlano.ts) — não é só texto de marketing solto. Gestão de
// Fretes (TMS) é liberada a partir do Profissional (até 30 fretes/mês) e
// ilimitada no Enterprise; emissão de CT-e/MDF-e e faturamento de fretes
// dependem de ter acesso a Fretes, então seguem a mesma régua.
// Atualização (02/08/2026): incluídas as entregas de gestão operacional de
// frota que ficam liberadas em todos os planos pagos hoje (sem gate de
// código, igual às demais linhas do Essencial acima) — TCO, Checklist de
// Inspeção veicular, Indicadores da Frota, Sinistros/Multas e Rede de
// Oficinas parceiras. Ver mesma atualização em landingBody.ts.
// Atualização (04/08/2026, revisão de permissões pós-benchmark Rodopar/
// Datapar): mesma lógica pras entregas dos Grupos 1 e 2 desse benchmark —
// Torre de Controle (com GPS ao vivo), Programação de Frota, CRM Comercial,
// Estoque de Peças, Patrimônio (depreciação contábil) e Conciliação
// Bancária, todas sem gate de código, liberadas em qualquer plano pago hoje.
// Mesma atualização em landingBody.ts (cards #func + <li> do plano Essencial).
export const FEATURES_PLANO: Record<"basico" | "profissional" | "enterprise", string[]> = {
  basico: [
    "Roteirização, Rotograma e Planos de Viagem",
    "Consulta de preços ANP e Inteligência de Rede",
    "Cadastros de frota, motoristas e centros de custo",
    "TCO, Checklist de Inspeção e Indicadores da Frota",
    "Controle de Sinistros, Multas e Rede de Oficinas",
    "Torre de Controle com GPS ao vivo e Programação de Frota",
    "CRM Comercial, Estoque de Peças, Patrimônio e Conciliação Bancária",
    "Suporte em até 48h",
  ],
  profissional: [
    "Tudo do Essencial",
    "Gestão de Fretes (TMS) — até 30 fretes/mês",
    "Emissão de CT-e/MDF-e e faturamento de fretes",
    "Cotações e Tabelas de Frete (piso ANTT)",
    "Suporte em até 24h",
  ],
  enterprise: [
    "Tudo do Profissional",
    "Gestão de Fretes (TMS) ilimitada",
    "API, integrações e webhooks",
    "SLA 99,95% e suporte 24x7",
    "Negociável para frotas acima de 500 veículos",
  ],
};

// Espelha EXATAMENTE o mapa PLANOS da Edge Function supabase/functions/
// stripe-webhook/index.ts — os limites de cada plano são aplicados por ela
// quando um checkout/upgrade é confirmado. Atualização (26/07/2026): a
// fonte de VERDADE agora é a tabela `limites_plano` no banco + o trigger
// `trg_sincronizar_limites_plano_*` em `empresas` (migração
// limites_plano_trava_estrutural) — ele recalcula max_usuarios/max_veiculos
// toda vez que `plano` muda, não importa a origem da escrita. Esta
// constante continua existindo só pro lado TS (exibição, formulários) —
// se um limite mudar, precisa atualizar os dois lados. -1 = ilimitado.
export const LIMITES_PLANO: Record<Plano, { max_usuarios: number; max_veiculos: number }> = {
  gratuito: { max_usuarios: 1, max_veiculos: 10 },
  basico: { max_usuarios: 5, max_veiculos: 50 },
  profissional: { max_usuarios: 20, max_veiculos: 200 },
  enterprise: { max_usuarios: -1, max_veiculos: -1 },
};

// Calibração de preços de 20/07/2026 (análise de MRR + custo de
// infraestrutura pedida pelo Daniel): faixa de veículos incluída no valor
// BASE de cada plano pago + valor por veículo excedente. Isso é diferente
// de LIMITES_PLANO acima (que é o limite TÉCNICO de enforcement, ex.:
// verificarLimiteFrota) — aqui é só o corte que define a partir de quando
// o excedente passa a ser cobrado. A cobrança do excedente já é
// AUTOMÁTICA via Stripe (produto "Veículo Excedente", medidor
// veiculo_excedente, agregação "last") — a Edge Function
// reportar-excedente-veiculos roda todo dia (cron) e reporta a contagem
// real de cada empresa. Estes valores também alimentam a exibição na tela de
// Assinatura e na landing — nenhum bloqueio nem cobrança automática usa
// isso ainda. Gratuito não cobra excedente (upgrade é o caminho normal).
export const FAIXA_VEICULOS_PLANO: Record<Plano, { veiculos_inclusos: number | null; preco_excedente_centavos: number | null }> = {
  gratuito: { veiculos_inclusos: null, preco_excedente_centavos: null },
  basico: { veiculos_inclusos: 20, preco_excedente_centavos: 450 },
  profissional: { veiculos_inclusos: 60, preco_excedente_centavos: 350 },
  enterprise: { veiculos_inclusos: 150, preco_excedente_centavos: 250 },
};

// Fase Posto/Rede (26/07/2026, pedido do Daniel): planos de assinatura
// específicos pro segmento Revenda (postos revendedores) — completamente
// separados dos planos de frotista acima (PLANOS/PLANO_LABEL/etc., que só
// se aplicam a empresas.segmento='Frota'). Preços aprovados pelo Daniel:
// Essencial R$99, Profissional R$159, Enterprise R$599.
//
// Diferença chave de arquitetura (decisão do Daniel: "criar assinatura
// única por rede — matriz paga por todos"): um posto SEM Rede de Postos
// (grupos_economicos.segmento='Revenda') assina individualmente, igual ao
// padrão de frotista — usa 'posto_essencial' direto em empresas.plano. Já
// um posto DENTRO de uma rede tem sua assinatura na REDE, não nele: quem
// paga é grupos_economicos (plano/status/stripe_customer_id — ver migração
// billing_grupo_economico_posto), administrada pela empresa apontada em
// grupos_economicos.empresa_administradora_id (por padrão, quem criou a
// rede via criar_rede_posto_self_service). O valor espelhado em
// empresas.plano de cada posto membro serve só pra gating/exibição.
export const PLANOS_POSTO = ["posto_essencial", "posto_profissional", "posto_enterprise"] as const;
export type PlanoPosto = (typeof PLANOS_POSTO)[number];

export const PLANO_POSTO_LABEL: Record<PlanoPosto, string> = {
  posto_essencial: "Essencial",
  posto_profissional: "Profissional",
  posto_enterprise: "Enterprise",
};

// Achado real (26/07/2026, investigando por que uma empresa em plano
// enterprise aparecia travada em "1/1 vaga" em /minha-equipe): os limites
// de posto viviam SÓ dentro da Edge Function stripe-webhook, sem nenhuma
// fonte no app — e nada no banco garantia que empresas.max_usuarios/
// max_veiculos ficassem em dia se `plano` mudasse por qualquer caminho
// fora do webhook (3 empresas foram promovidas manualmente e ficaram presas
// nos limites do gratuito). Correção estrutural: tabela `limites_plano` no
// banco (fonte única, cobre Frota e Posto) + trigger que recalcula
// max_usuarios/max_veiculos toda vez que `plano` muda, não importa a
// origem. Esta constante só espelha a tabela pro lado TS, pra quem for
// mexer no código não precisar consultar o banco pra saber os valores —
// se um dia mudar o preço/limite de um plano de posto, atualizar os dois
// lados (aqui e a tabela `limites_plano`, migração
// limites_plano_trava_estrutural).
export const LIMITES_PLANO_POSTO: Record<PlanoPosto, { max_usuarios: number; max_veiculos: number }> = {
  posto_essencial: { max_usuarios: 5, max_veiculos: -1 },
  posto_profissional: { max_usuarios: 20, max_veiculos: -1 },
  posto_enterprise: { max_usuarios: -1, max_veiculos: -1 },
};

// Destaques de cada plano de posto, mesmo espírito de FEATURES_PLANO acima
// — mostrados nos cards de /assinatura quando segmento='Revenda' e na
// landing. Essencial não permite Rede de Postos (posto avulso); Profissional
// e Enterprise liberam criar/entrar em rede com assinatura única pela matriz.
// Pedido do Daniel (27/07/2026): retirado o "Gerente de conta dedicado" do
// Enterprise — não ofertar esse benefício por enquanto (nem pra Frota, nem
// pra Posto). Ver mesma remoção em landingBody.ts e termoAdesao.ts
// (Cláusula 3ª de ambos os Enterprise, com hash recalculado).
// Atualização (02/08/2026): incluído Pré-Pedidos (sem gate de código hoje,
// disponível já no Essencial). Ver mesma atualização em landingBody.ts.
export const FEATURES_PLANO_POSTO: Record<PlanoPosto, string[]> = {
  posto_essencial: [
    "Gestão de faturas e conciliação de abastecimentos",
    "Financeiro: contas a receber e inadimplência",
    "Cadastro de bicos, produtos e preços",
    "Pré-Pedidos de combustível",
    "1 posto (sem Rede de Postos)",
    "Suporte em até 48h",
  ],
  posto_profissional: [
    "Tudo do Essencial",
    "Rede de Postos — até 5 postos inclusos numa assinatura só (matriz paga por todos)",
    "Inteligência de Rede e Antifraude",
    "Posto excedente: R$35/mês cada, acima da faixa inclusa",
    "Suporte em até 24h",
  ],
  posto_enterprise: [
    "Tudo do Profissional",
    "Rede de Postos — até 20 postos inclusos numa assinatura só (matriz paga por todos)",
    "Posto excedente: R$20/mês cada, acima da faixa inclusa",
    "API, integrações e webhooks",
    "SLA 99,95%",
  ],
};

// Faixa de postos inclusa em cada plano de rede + valor do posto excedente
// — mesmo padrão de FAIXA_VEICULOS_PLANO, mas contando POSTOS membros de
// uma grupos_economicos (segmento='Revenda'), não veículos. Só se aplica a
// Profissional/Enterprise (quem tem Rede de Postos); Essencial é sempre 1
// posto avulso, sem excedente. Cobrança automática via Stripe: produto
// "Posto Excedente", medidor posto_excedente, agregação "last" — reportado
// pela Edge Function reportar-excedente-postos (cron diário).
export const FAIXA_POSTOS_PLANO: Record<PlanoPosto, { postos_inclusos: number | null; preco_excedente_centavos: number | null }> = {
  posto_essencial: { postos_inclusos: null, preco_excedente_centavos: null },
  posto_profissional: { postos_inclusos: 5, preco_excedente_centavos: 3500 },
  posto_enterprise: { postos_inclusos: 20, preco_excedente_centavos: 2000 },
};

// Fase Grupo-Economico-Frota-Billing (09/08/2026, pedido do Daniel: cenário
// de clientes com matriz/filiais ou empresas distintas do mesmo grupo
// econômico, "conta a possibilidade de unir várias empresas... com uma
// mensalidade abaixo do que já está mapeado"). Mesma arquitetura da Rede de
// Postos (grupos_economicos, segmento='Frota' aqui): assinatura ÚNICA do
// GRUPO, paga pela empresa administradora (empresa_administradora_id), com
// faixa de empresas inclusas + excedente por empresa — em vez de cada
// empresa membro manter sua própria assinatura em `empresas.plano`. Sem
// nível "essencial": grupo só existe a partir do Profissional pra cima,
// mesmo padrão do posto (quem quer só 1 empresa usa os planos individuais
// PLANOS/LIMITES_PLANO acima, sem grupo nenhum). Cada empresa dentro do
// grupo herda os LIMITES_PLANO do nível equivalente (profissional/
// enterprise) — não têm limite próprio menor.
export const PLANOS_GRUPO_FROTA = ["grupo_frota_profissional", "grupo_frota_enterprise"] as const;
export type PlanoGrupoFrota = (typeof PLANOS_GRUPO_FROTA)[number];

export const PLANO_GRUPO_FROTA_LABEL: Record<PlanoGrupoFrota, string> = {
  grupo_frota_profissional: "Grupo Profissional",
  grupo_frota_enterprise: "Grupo Enterprise",
};

// Preços de lançamento (calibração inicial 09/08/2026, a validar com o
// Daniel antes de criar os produtos no Stripe — mesma lógica de desconto
// por volume usada em FAIXA_POSTOS_PLANO: ~5 empresas Profissional
// individuais custariam R$2.745/mês avulsas, o grupo sai por R$899).
export const PRECO_GRUPO_FROTA_CENTAVOS: Record<PlanoGrupoFrota, number> = {
  grupo_frota_profissional: 89900,
  grupo_frota_enterprise: 249000,
};

export const FEATURES_GRUPO_FROTA: Record<PlanoGrupoFrota, string[]> = {
  grupo_frota_profissional: [
    "Assinatura única — a empresa administradora paga por todo o grupo",
    "Até 5 empresas inclusas, cada uma com os limites do plano Profissional",
    "Reuso de motoristas e veículos entre as empresas do grupo",
    "Empresa excedente: R$150/mês cada, acima da faixa inclusa",
  ],
  grupo_frota_enterprise: [
    "Assinatura única — a empresa administradora paga por todo o grupo",
    "Até 20 empresas inclusas, cada uma com os limites do plano Enterprise",
    "Reuso de motoristas e veículos entre as empresas do grupo",
    "Empresa excedente: R$100/mês cada, acima da faixa inclusa",
  ],
};

// Faixa de empresas inclusa em cada plano de grupo + valor da empresa
// excedente — mesmo padrão de FAIXA_POSTOS_PLANO, mas contando EMPRESAS
// membras de uma grupos_economicos (segmento='Frota'). Cobrança automática
// via Stripe: produto "Empresa Excedente (Grupo Frota)", medidor
// empresa_excedente_grupo_frota, agregação "last" — reportado pela Edge
// Function reportar-excedente-empresas-grupo (cron diário, a criar).
export const FAIXA_EMPRESAS_GRUPO_FROTA: Record<PlanoGrupoFrota, { empresas_inclusas: number; preco_excedente_centavos: number }> = {
  grupo_frota_profissional: { empresas_inclusas: 5, preco_excedente_centavos: 15000 },
  grupo_frota_enterprise: { empresas_inclusas: 20, preco_excedente_centavos: 10000 },
};

// Duração do trial self-service (cadastro público em /cadastro) — precisa
// bater com a régua de e-mails da Edge Function email-trials (D+3, D+7,
// aviso em D+12 => expira por volta do D+14).
export const DIAS_TRIAL = 14;

export const PORTES = ["Pequeno", "Médio", "Grande"] as const;

export const SEGMENTOS_TRANSPORTE = [
  "Carga Fracionada",
  "Carga Lotação",
  "Carga Perigosa",
  "Distribuição Urbana",
  "Logística Dedicada",
  "Revenda de Combustíveis",
  "Outro",
] as const;

// Ciclo Diesel: Diesel S10 e Diesel S500 / Ciclo Otto: Gasolina, Etanol, GNV e Flex
export const CICLOS_COMBUSTIVEL = [
  { key: "diesel_s10", label: "Diesel S10", ciclo: "Diesel" },
  { key: "diesel_s500", label: "Diesel S500", ciclo: "Diesel" },
  { key: "gasolina", label: "Gasolina", ciclo: "Otto" },
  { key: "etanol", label: "Etanol", ciclo: "Otto" },
  { key: "gnv", label: "GNV", ciclo: "Otto" },
  { key: "flex", label: "Flex", ciclo: "Otto" },
] as const;

// Fase Convite-Self-Service (26/07/2026) — "colaborador" é o perfil dos
// convidados via /minha-equipe (convite self-service de gestor_frota/posto
// pra própria empresa). Nasce sem nenhum poder próprio; tudo que ele pode
// ver/fazer é definido em /permissoes pelo dono da empresa. Ver decisão
// registrada na migração usuarios_app_perfil_colaborador — não reaproveita
// 'analista' porque esse perfil hoje também destrava a tela interna
// /usuarios de gerenciar usuários de QUALQUER cliente do sistema.
export const PERFIS = ["admin", "gestor_frota", "analista", "posto", "colaborador"] as const;
export type Perfil = (typeof PERFIS)[number];

// Sentinela usado em permissoes_perfil.empresa_id pra representar "padrão
// global" (gerenciado só pelo admin), nunca uma empresa real — ver Fase 27.1.
export const EMPRESA_ID_GLOBAL = "00000000-0000-0000-0000-000000000000";

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  gestor_frota: "Gestor de Frota",
  analista: "Analista",
  posto: "Posto",
  colaborador: "Colaborador",
};

export const SEGMENTO_USUARIO = ["Frota", "Revenda"] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// Nome do estado como a ANP grafa no relatório oficial (maiúsculas, sem
// acento) — usado para casar o UF (sigla) do posto com a coluna "ESTADO" de
// anp_precos_referencia.
export const UF_PARA_ESTADO_ANP: Record<string, string> = {
  AC: "ACRE",
  AL: "ALAGOAS",
  AP: "AMAPA",
  AM: "AMAZONAS",
  BA: "BAHIA",
  CE: "CEARA",
  DF: "DISTRITO FEDERAL",
  ES: "ESPIRITO SANTO",
  GO: "GOIAS",
  MA: "MARANHAO",
  MT: "MATO GROSSO",
  MS: "MATO GROSSO DO SUL",
  MG: "MINAS GERAIS",
  PA: "PARA",
  PB: "PARAIBA",
  PR: "PARANA",
  PE: "PERNAMBUCO",
  PI: "PIAUI",
  RJ: "RIO DE JANEIRO",
  RN: "RIO GRANDE DO NORTE",
  RS: "RIO GRANDE DO SUL",
  RO: "RONDONIA",
  RR: "RORAIMA",
  SC: "SANTA CATARINA",
  SP: "SAO PAULO",
  SE: "SERGIPE",
  TO: "TOCANTINS",
};

// Caminho inverso: nome do estado (normalizado) -> sigla. Necessário porque
// algumas planilhas de origem (ex: postos_gf.xlsx) trazem o nome completo
// do estado na coluna "UF" em vez da sigla.
export const ESTADO_PARA_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_PARA_ESTADO_ANP).map(([uf, estado]) => [estado, uf])
);

export const STATUS_MOTORISTA = ["Ativo", "Inativo"] as const;
export type StatusMotorista = (typeof STATUS_MOTORISTA)[number];

// Usado tanto em motoristas.classificacao quanto em cadastro_veiculos.classificacao.
export const CLASSIFICACAO = ["Próprio", "Agregado"] as const;
export type Classificacao = (typeof CLASSIFICACAO)[number];

// Achado real (30/07/2026, pedido do Daniel): quase toda a frota cadastrada
// (2389 de 2404 veículos) estava com tipo_veiculo = "Outro" — rótulo genérico
// que não dizia nada. Renomeado para "Carro de Passeio" porque é isso que a
// maioria desses veículos realmente é (frota leve, não caminhões/carretas).
// Migração de dados (renomear_outro_para_carro_passeio) atualizou os
// registros existentes pra manter consistência com este rótulo.
export const TIPOS_VEICULO = [
  "Cavalo Mecânico",
  "Carreta",
  "Truck",
  "Toco",
  "VUC",
  "Utilitário",
  "Carro de Passeio",
] as const;

// Fase 27.124 — porte do veículo (cadastro_veiculos.tipo), diferente de
// tipo_veiculo (carroceria) e classificacao (Próprio/Agregado). Mesmo
// conceito Leve/Pesado já usado como filtro em Parâmetros de Uso (Fase
// 27.121: variação de hodômetro, dias/horários, postos permitidos).
export const TIPO_PORTE_VEICULO = ["Leve", "Pesado"] as const;
export type TipoPorteVeiculo = (typeof TIPO_PORTE_VEICULO)[number];

// status_transacao não tem CHECK constraint no banco (a integração com o meio
// de pagamento pode mandar outros valores) — esta lista é só a convenção usada
// nos lançamentos manuais/importação feitos por este app.
export const STATUS_TRANSACAO = ["Confirmado", "Pendente", "Cancelado"] as const;
export type StatusTransacao = (typeof STATUS_TRANSACAO)[number];

// Referência nacional de preço médio de combustível (ESTIMATIVA — só usada
// como último recurso, quando a tabela anp_precos_referencia ainda não tem
// dados importados). Assim que a planilha oficial precos_anp.xlsx é
// carregada, a Inteligência de Rede usa o preço médio real da ANP em vez
// deste dicionário fixo.
export const ANP_PRECO_REFERENCIA_FALLBACK: Record<string, number> = {
  "Gasolina Comum": 6.3,
  "Gasolina Aditivada": 6.45,
  "Diesel S10": 6.05,
  "Diesel S500": 5.95,
  Etanol: 4.1,
  GNV: 4.25,
};

// Liga o nome do "Produto" como ele aparece na planilha de preços por posto
// (preco_posto.xlsx) ao nome padronizado que a ANP usa no relatório oficial
// (precos_anp.xlsx) — os nomes não batem exatamente, e a ANP agrupa
// variações "comum/aditivado" em uma única categoria por combustível.
export const PRODUTO_PARA_CATEGORIA_ANP: Record<string, string> = {
  "Diesel S-500 Comum": "OLEO DIESEL",
  "Diesel S-500 Aditivado": "OLEO DIESEL",
  "Diesel S-10 Comum": "OLEO DIESEL S10",
  "Diesel S-10 Aditivado": "OLEO DIESEL S10",
  "Etanol Comum": "ETANOL HIDRATADO",
  "Etanol Aditivado": "ETANOL HIDRATADO",
  "Gasolina Comum": "GASOLINA COMUM",
  "Gasolina Aditivada": "GASOLINA ADITIVADA",
  // A ANP não pesquisa gasolina premium/alta octanagem como categoria à
  // parte (é um produto de marca própria de cada rede) — comparamos contra
  // "GASOLINA ADITIVADA" por ser a referência oficial mais próxima, mas é
  // uma aproximação, não um valor oficial da ANP para esse produto exato.
  "Gasolina Alta Octanagem": "GASOLINA ADITIVADA",
  GNV: "GNV",
  GLP: "GLP",
};

// Produtos vendidos nos postos, na mesma granularidade que a planilha de
// carga (preco_posto.xlsx) grava em historico_precos.combustivel — esta é a
// lista que deve aparecer em qualquer seletor de "qual combustível", tanto
// pra registrar preço manual quanto pra escolher o combustível de uma
// viagem na Roteirização. Evita strings soltas (como as de
// CICLOS_COMBUSTIVEL, que descrevem o MOTOR do veículo, não o produto
// vendido no posto) que não batem com o que a importação em lote grava.
export const PRODUTOS_POSTO = [
  "Gasolina Comum",
  "Gasolina Aditivada",
  "Gasolina Alta Octanagem",
  "Etanol Comum",
  "Etanol Aditivado",
  "Diesel S-10 Comum",
  "Diesel S-10 Aditivado",
  "Diesel S-500 Comum",
  "Diesel S-500 Aditivado",
  "GNV",
  "GLP",
] as const;

// Fase Abastecimento-Interno (21/08/2026) — mesma lista de PRODUTOS_POSTO
// (posto interno vende os mesmos combustíveis de um posto revendedor comum),
// mais Arla32: NÃO é um combustível ANP (é um aditivo à base de ureia usado
// só em motores Diesel com sistema SCR), por isso fica de fora de
// PRODUTOS_POSTO/combustiveis_codigo_anp e é tratado como item opcional
// lançado JUNTO de um abastecimento de Diesel (mesmo formulário/operação),
// nunca como combustível avulso escolhido sozinho.
export const ARLA32 = "Arla32" as const;
export const COMBUSTIVEIS_POSTO_INTERNO = [...PRODUTOS_POSTO] as const;

// De-para do tipo de motor do veículo (cadastro_veiculos.combustivel, que
// usa os rótulos de CICLOS_COMBUSTIVEL) para os produtos de posto
// compatíveis. Um veículo Flex pode abastecer com gasolina OU etanol — por
// isso a Roteirização precisa perguntar qual das opções usar naquela
// viagem, em vez de adivinhar. Chaves em minúsculas para comparar sem
// depender de acentuação/caixa exata do que foi importado.
export const PRODUTOS_POR_TIPO_VEICULO: Record<string, string[]> = {
  "diesel s10": ["Diesel S-10 Comum", "Diesel S-10 Aditivado"],
  "diesel s500": ["Diesel S-500 Comum", "Diesel S-500 Aditivado"],
  gasolina: ["Gasolina Comum", "Gasolina Aditivada", "Gasolina Alta Octanagem"],
  etanol: ["Etanol Comum", "Etanol Aditivado"],
  gnv: ["GNV"],
  flex: ["Gasolina Comum", "Gasolina Aditivada", "Etanol Comum", "Etanol Aditivado"],
};

// Fase 27.48 — Planos de Viagem.
export const STATUS_PLANO_VIAGEM = ["rascunho", "planejado", "em_andamento", "concluido", "cancelado"] as const;
export type StatusPlanoViagem = (typeof STATUS_PLANO_VIAGEM)[number];

export const STATUS_PLANO_VIAGEM_LABEL: Record<StatusPlanoViagem, string> = {
  rascunho: "Rascunho",
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

