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
export const FEATURES_PLANO: Record<"basico" | "profissional" | "enterprise", string[]> = {
  basico: [
    "Roteirização, Rotograma e Planos de Viagem",
    "Consulta de preços ANP e Inteligência de Rede",
    "Cadastros de frota, motoristas e centros de custo",
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
// quando um checkout/upgrade é confirmado. Não há uma tabela de referência
// única no banco pra isso (decisão da Fase 20: reaproveitar os planos como
// já estavam configurados no Stripe/webhook em vez de remodelar agora) —
// se um limite mudar de um lado, precisa mudar dos dois. -1 = ilimitado.
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

export const PERFIS = ["admin", "gestor_frota", "analista", "posto"] as const;
export type Perfil = (typeof PERFIS)[number];

// Sentinela usado em permissoes_perfil.empresa_id pra representar "padrão
// global" (gerenciado só pelo admin), nunca uma empresa real — ver Fase 27.1.
export const EMPRESA_ID_GLOBAL = "00000000-0000-0000-0000-000000000000";

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  gestor_frota: "Gestor de Frota",
  analista: "Analista",
  posto: "Posto",
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

export const TIPOS_VEICULO = [
  "Cavalo Mecânico",
  "Carreta",
  "Truck",
  "Toco",
  "VUC",
  "Utilitário",
  "Outro",
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

