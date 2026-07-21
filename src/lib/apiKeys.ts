import { randomBytes, createHash } from "crypto";

// Chaves de API pra sistemas externos do cliente empurrarem dados pra FNI
// (hoje: custos fixos — seguro, IPVA, licenciamento, rastreamento, multas).
// A tabela public.api_keys já existia no banco (pronta, mas nunca usada —
// ver README Fase 22) com o desenho certo pra isso: só o HASH da chave é
// gravado (hash_chave), nunca o valor puro. A chave em texto só existe no
// momento da geração, é devolvida uma única vez pro usuário copiar, e nunca
// mais pode ser recuperada (se perder, precisa gerar outra).

const PREFIXO_CHAVE = "fni_cf_";

export function gerarChaveApi(): { chave: string; hash: string } {
  const chave = PREFIXO_CHAVE + randomBytes(24).toString("hex");
  return { chave, hash: hashChaveApi(chave) };
}

export function hashChaveApi(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

export const ESCOPO_CUSTOS_FIXOS = "custos_fixos:write";

// Fase 25 — Hub de Integrações: novos escopos, um por recurso/ação, pra uma
// chave só pedir permissão do que de fato vai usar (um provedor de cartão
// de combustível não precisa enxergar usuários, por exemplo). Todos seguem
// o padrão "recurso:acao" já estabelecido acima.
export const ESCOPO_ABASTECIMENTOS_WRITE = "abastecimentos:write";
export const ESCOPO_MANUTENCOES_WRITE = "manutencoes:write";
export const ESCOPO_VEICULOS_READ = "veiculos:read";
export const ESCOPO_MOTORISTAS_READ = "motoristas:read";
export const ESCOPO_CENTROS_CUSTO_READ = "centros_custo:read";
export const ESCOPO_POSTOS_READ = "postos:read";
export const ESCOPO_USUARIOS_READ = "usuarios:read";

// Fase 27.50 — Negociação com Postos Revendedores: o POSTO (não o cliente de
// frota) é quem gera essa chave, na própria tela de Integrações dele, pro
// sistema/ERP do posto enviar propostas e consultar/responder o andamento
// sem precisar logar na plataforma. "write" cria propostas/contrapropostas
// e responde (aceitar/recusar); "read" consulta o status das negociações.
export const ESCOPO_NEGOCIACOES_WRITE = "negociacoes:write";
export const ESCOPO_NEGOCIACOES_READ = "negociacoes:read";

// Fase 27.94 — pedido do Daniel: ERPs de automação de posto (sistema de
// bomba/gestão) devem poder subir a NF-e (modelo 55) de venda de
// combustível automaticamente, vinculando-a ao abastecimento que ela
// documenta — mesmo fluxo de crítica/matching que o upload manual pelo
// navegador (/notas-fiscais), só que autenticado por chave de API em vez de
// sessão de usuário.
export const ESCOPO_NOTAS_FISCAIS_WRITE = "notas_fiscais:write";

// Fase 27.144 — pedido do Daniel: sistemas de automação de posto (bomba/PDV
// — Tanknomia, SAT Combustíveis e afins) devem poder integrar direto, sem
// depender de um provedor de cartão de combustível no meio, empurrando cada
// abastecimento REALIZADO no posto assim que ele acontece. Mesma tabela
// abastecimentos_externos da Fase 25/27.136 (então cai automaticamente nos
// mesmos indicadores financeiros, cobrança, ajuste e NF-e que qualquer outro
// meio de pagamento) — a diferença é só de quem detém a chave e como o
// cliente é identificado: aqui é o POSTO quem gera a chave (como já faz pra
// Negociação e Notas Fiscais), e o corpo da requisição informa o CNPJ do
// cliente (frota) que abasteceu, resolvido pra empresa_id na hora. CNPJ e
// nome do próprio posto NÃO vêm do corpo — são sempre os da empresa dona da
// chave, pra um posto nunca conseguir lançar venda em nome de outro.
export const ESCOPO_ABASTECIMENTOS_FORNECIDOS_WRITE = "abastecimentos_fornecidos:write";

// Fase 27.120 — Parâmetros de Uso: regras cadastradas pelo cliente pra
// balizar abastecimentos autorizados em postos ou soluções de automação/
// meios de pagamento integrados. Primeiro tipo: Vínculo Motorista ↔
// Veículo — o sistema externo consulta antes de liberar o abastecimento se
// aquele par (placa + motorista) está ativo. Os outros 9 tipos do anexo do
// Daniel ganham escopo próprio conforme forem implementados.
export const ESCOPO_PARAMETROS_VINCULO_READ = "parametros_vinculo:read";

// Fase 27.121 — os outros 9 tipos de "Parâmetros de Uso", 1 escopo de
// leitura por tipo (Hodômetro Leve/Pesado dividem 1 escopo só — mesma
// tabela no banco, ver parametros_variacao_hodometro).
export const ESCOPO_PARAMETROS_INTERVALO_READ = "parametros_intervalo:read";
export const ESCOPO_PARAMETROS_VALOR_DIARIO_READ = "parametros_valor_diario:read";
export const ESCOPO_PARAMETROS_VOLUME_DIARIO_READ = "parametros_volume_diario:read";
export const ESCOPO_PARAMETROS_PRODUTO_READ = "parametros_produto:read";
export const ESCOPO_PARAMETROS_HODOMETRO_READ = "parametros_hodometro:read";
export const ESCOPO_PARAMETROS_DIAS_HORARIOS_READ = "parametros_dias_horarios:read";
export const ESCOPO_PARAMETROS_POSTOS_READ = "parametros_postos:read";
export const ESCOPO_PARAMETROS_SERVICOS_READ = "parametros_servicos:read";
export const ESCOPO_PARAMETROS_COTAS_READ = "parametros_cotas:read";

// Fase 27.15x — Regras Antifraude: diferente de Parâmetros de Uso (o sistema
// externo consulta e decide sozinho), aqui é a PLATAFORMA quem avalia as
// regras e devolve o veredito pronto (autorizado/reprovado + motivo) — 1
// único escopo cobre a consulta, já que as regras dos 3 tipos moram na mesma
// tabela e são avaliadas juntas numa chamada só.
export const ESCOPO_ANTIFRAUDE_VERIFICAR = "antifraude:verificar";

// Fase 27.140 — Parâmetros de NF: preferências de emissão de nota fiscal
// configuradas pelo cliente frotista (exige NF, separa combustível de
// produtos/serviços, forma de emissão, destino da nota), por CNPJ da frota
// ou regra padrão — consultadas por ERPs e sistemas de automação de posto
// antes de emitir a nota, mesmo racional de Parâmetros de Uso.
export const ESCOPO_PARAMETROS_NF_READ = "parametros_nf:read";

// Catálogo central dos escopos disponíveis — usado tanto pela UI de geração
// de chave (/integracoes, pra montar os checkboxes) quanto pela documentação
// da API. Adicionar um escopo novo aqui é o único lugar a mudar pra ele
// aparecer selecionável na tela.
export const CATALOGO_ESCOPOS: { escopo: string; categoria: string; label: string; descricao: string }[] = [
  {
    escopo: ESCOPO_CUSTOS_FIXOS,
    categoria: "Pagamentos",
    label: "Custos fixos (escrita)",
    descricao: "Lançar seguro, IPVA, licenciamento, rastreamento, multas e pedágio.",
  },
  {
    escopo: ESCOPO_ABASTECIMENTOS_WRITE,
    categoria: "Pagamentos",
    label: "Abastecimentos (escrita)",
    descricao: "Lançar transações de combustível de cartões/fornecedores diversos.",
  },
  {
    escopo: ESCOPO_MANUTENCOES_WRITE,
    categoria: "Pagamentos",
    label: "Manutenções (escrita)",
    descricao: "Lançar manutenções realizadas por oficinas/redes credenciadas.",
  },
  {
    escopo: ESCOPO_VEICULOS_READ,
    categoria: "Cadastros",
    label: "Veículos (leitura)",
    descricao: "Consultar a frota cadastrada (placa, marca, modelo, centro de custo).",
  },
  {
    escopo: ESCOPO_MOTORISTAS_READ,
    categoria: "Cadastros",
    label: "Motoristas (leitura)",
    descricao: "Consultar motoristas cadastrados (nome, CNH, status, centro de custo).",
  },
  {
    escopo: ESCOPO_CENTROS_CUSTO_READ,
    categoria: "Cadastros",
    label: "Centros de custo (leitura)",
    descricao: "Consultar a estrutura de centros de custo do cliente.",
  },
  {
    escopo: ESCOPO_POSTOS_READ,
    categoria: "Cadastros",
    label: "Postos revendedores (leitura)",
    descricao: "Consultar a rede de postos negociada do cliente.",
  },
  {
    escopo: ESCOPO_USUARIOS_READ,
    categoria: "Cadastros",
    label: "Usuários (leitura)",
    descricao: "Consultar pessoas com acesso à plataforma (nome, e-mail, perfil — nunca dados de MFA).",
  },
  {
    escopo: ESCOPO_NEGOCIACOES_WRITE,
    // Fase 27.51 — quem sempre gera essa chave é o POSTO (é ele quem tem o
    // escopo negociacoes:*), então a categoria fala do ponto de vista dele:
    // "negociação com o(s) cliente(s) dele", não "com postos".
    categoria: "Negociação com Cliente",
    label: "Negociações (escrita)",
    descricao: "Enviar proposta/contraproposta de negociação a um cliente e responder (aceitar/recusar).",
  },
  {
    escopo: ESCOPO_NEGOCIACOES_READ,
    categoria: "Negociação com Cliente",
    label: "Negociações (leitura)",
    descricao: "Consultar o andamento das negociações enviadas por este posto.",
  },
  {
    escopo: ESCOPO_NOTAS_FISCAIS_WRITE,
    categoria: "Notas Fiscais",
    label: "Notas fiscais (escrita)",
    descricao: "Enviar o XML da NF-e de venda de combustível, vinculando-a ao abastecimento correspondente.",
  },
  {
    escopo: ESCOPO_ABASTECIMENTOS_FORNECIDOS_WRITE,
    categoria: "Abastecimentos Fornecidos",
    label: "Abastecimentos fornecidos (escrita)",
    descricao:
      "Lançar, direto do sistema de automação da bomba/PDV do posto, cada abastecimento realizado a um cliente.",
  },
  {
    escopo: ESCOPO_PARAMETROS_VINCULO_READ,
    categoria: "Parâmetros de Uso",
    label: "Vínculo motorista/veículo (leitura)",
    descricao: "Consultar se um motorista está autorizado a abastecer um veículo específico antes de liberar a transação.",
  },
  {
    escopo: ESCOPO_PARAMETROS_INTERVALO_READ,
    categoria: "Parâmetros de Uso",
    label: "Intervalo entre abastecimentos (leitura)",
    descricao: "Consultar o intervalo mínimo exigido entre 2 abastecimentos, por veículo ou motorista.",
  },
  {
    escopo: ESCOPO_PARAMETROS_VALOR_DIARIO_READ,
    categoria: "Parâmetros de Uso",
    label: "Valor diário por motorista (leitura)",
    descricao: "Consultar o valor máximo (R$) permitido por dia para um motorista.",
  },
  {
    escopo: ESCOPO_PARAMETROS_VOLUME_DIARIO_READ,
    categoria: "Parâmetros de Uso",
    label: "Volume diário por veículo (leitura)",
    descricao: "Consultar o volume máximo (L) permitido por dia para um veículo.",
  },
  {
    escopo: ESCOPO_PARAMETROS_PRODUTO_READ,
    categoria: "Parâmetros de Uso",
    label: "Produto abastecido (leitura)",
    descricao: "Consultar quais combustíveis são permitidos para um veículo.",
  },
  {
    escopo: ESCOPO_PARAMETROS_HODOMETRO_READ,
    categoria: "Parâmetros de Uso",
    label: "Variação de hodômetro (leitura)",
    descricao: "Consultar a variação máxima de hodômetro permitida entre abastecimentos, por classificação Leve/Pesado.",
  },
  {
    escopo: ESCOPO_PARAMETROS_DIAS_HORARIOS_READ,
    categoria: "Parâmetros de Uso",
    label: "Dias e horários permitidos (leitura)",
    descricao: "Consultar a janela de dias/horários em que o abastecimento é permitido.",
  },
  {
    escopo: ESCOPO_PARAMETROS_POSTOS_READ,
    categoria: "Parâmetros de Uso",
    label: "Postos permitidos (leitura)",
    descricao: "Consultar quais postos estão autorizados para um cliente/veículo/motorista.",
  },
  {
    escopo: ESCOPO_PARAMETROS_SERVICOS_READ,
    categoria: "Parâmetros de Uso",
    label: "Limite de serviços (leitura)",
    descricao: "Consultar limites de quantidade/valor por serviço (lavagem, restaurante etc.).",
  },
  {
    escopo: ESCOPO_PARAMETROS_COTAS_READ,
    categoria: "Parâmetros de Uso",
    label: "Cota por veículo (leitura)",
    descricao: "Consultar limite e consumo já realizado da cota (R$ ou L) de um veículo no período atual.",
  },
  {
    escopo: ESCOPO_ANTIFRAUDE_VERIFICAR,
    categoria: "Antifraude",
    label: "Verificação antifraude",
    descricao:
      "Consultar, antes de autorizar um abastecimento, se ele passa nas regras antifraude cadastradas pelo cliente.",
  },
  {
    escopo: ESCOPO_PARAMETROS_NF_READ,
    categoria: "Parâmetros de NF",
    label: "Parâmetros de NF (leitura)",
    descricao:
      "Consultar as preferências de emissão de nota fiscal do cliente (exige NF, forma de emissão, destino) por CNPJ da frota.",
  },
];
