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
];
