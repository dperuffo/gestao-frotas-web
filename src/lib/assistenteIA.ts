import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import { geocodificar } from "@/lib/geo";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { validarRegraConsumo, descreverRegraConsumo } from "@/lib/regraConsumo";
import {
  validarCadastro,
  type AcaoCadastro,
  type CamposCadastro,
  type EntidadeCadastro,
  type MudancaCadastro,
} from "@/lib/cadastroAssistente";
import { conferirPermissaoCadastro, prepararCadastro } from "@/lib/cadastroAssistenteServidor";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MensagemChat = { role: "user" | "assistant"; content: string };

export type ConsultaExecutada = { sql: string; linhas: number; erro?: string };

// Bloco visual que o assistente pede pra desenhar (gráfico ou tabela). Os
// números vêm SEMPRE de consultas SQL já feitas — o modelo só escolhe o formato.
export type FormatoValor = "numero" | "moeda" | "litros" | "km" | "percentual";
export type BlocoVisual = {
  tipo: "barras" | "linhas" | "pizza" | "tabela";
  titulo: string;
  formato: FormatoValor;
  categorias: string[];
  series: { nome: string; valores: number[] }[];
};

// Proposta de AÇÃO (escrita) montada pelo assistente. Nada é gravado até o usuário
// clicar em "Confirmar" na tela — a confirmação re-valida tudo no servidor.
export type PropostaRegraConsumo = {
  tipo: "regra_consumo";
  empresaId: string;
  empresaNome: string;
  marcaContem: string | null;
  placa: string | null;
  consumoMinimo: number;
  consumoMaximo: number;
  percentualTanqueMinimo: number;
  veiculosAfetados: number | null;
  resumo: string;
};

// Cadastro de veículo/motorista: criar, alterar, inativar ou reativar. Não existe
// exclusão definitiva — inativar mantém o cadastro e o histórico.
export type PropostaCadastro = {
  tipo: "cadastro";
  entidade: EntidadeCadastro;
  acao: AcaoCadastro;
  empresaId: string;
  empresaNome: string;
  // Placa (veículo) ou CPF/nome (motorista) como o usuário informou, já normalizado.
  identificador: string;
  campos: CamposCadastro;
  alvo: string;
  mudancas: MudancaCadastro[];
  aviso: string | null;
  resumo: string;
};

export type PropostaAcao = PropostaRegraConsumo | PropostaCadastro;

export type RespostaAssistente = {
  resposta: string;
  consultas: ConsultaExecutada[];
  blocos: BlocoVisual[];
  propostas: PropostaAcao[];
};

const FORMATOS_VALIDOS: FormatoValor[] = ["numero", "moeda", "litros", "km", "percentual"];
const TIPOS_VALIDOS = ["barras", "linhas", "pizza", "tabela"] as const;

// Valida o que o modelo mandou (nunca confie cegamente na entrada de uma
// ferramenta): limita tamanho e garante números finitos e séries do mesmo
// comprimento das categorias.
export function validarBlocoVisual(entrada: unknown): BlocoVisual | string {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const tipo = TIPOS_VALIDOS.find((t) => t === e.tipo);
  if (!tipo) return "tipo inválido (use barras, linhas, pizza ou tabela).";
  const titulo = typeof e.titulo === "string" ? e.titulo.trim().slice(0, 120) : "";
  if (!titulo) return "informe um título.";
  const formato = FORMATOS_VALIDOS.find((f) => f === e.formato) ?? "numero";
  if (!Array.isArray(e.categorias) || e.categorias.length === 0) return "categorias vazias.";
  const categorias = e.categorias.slice(0, 30).map((c) => String(c).slice(0, 60));
  if (!Array.isArray(e.series) || e.series.length === 0) return "series vazias.";
  const series: BlocoVisual["series"] = [];
  for (const sr of e.series.slice(0, 6)) {
    const o = (sr ?? {}) as Record<string, unknown>;
    if (!Array.isArray(o.valores)) return "cada série precisa de 'valores' (lista de números).";
    const valores = o.valores.slice(0, categorias.length).map((v) => Number(v));
    if (valores.length !== categorias.length || valores.some((v) => !Number.isFinite(v))) {
      return "cada série precisa ter um número finito por categoria (mesmo tamanho de 'categorias').";
    }
    series.push({ nome: String(o.nome ?? "Valor").slice(0, 40), valores });
  }
  if (tipo === "pizza" && series.length > 1) series.length = 1;
  return { tipo, titulo, formato, categorias, series };
}

// claude-sonnet-5 é o modelo atual recomendado para uso via API (mesma
// família usada no restante do produto Claude). Se a Anthropic lançar um
// modelo mais novo/recomendado, troque só esta constante.
export const MODELO_ASSISTENTE = "claude-sonnet-5";
const MODELO = MODELO_ASSISTENTE;

// Limite de idas-e-voltas com a ferramenta de SQL numa única pergunta —
// evita loop infinito se o modelo insistir em consultas que sempre falham.
const MAX_RODADAS_FERRAMENTA = 6;

// Contexto de schema + regras de segurança/escopo passado como system prompt.
// Cobre só as 4 áreas que o Daniel definiu como escopo inicial do Assistente
// FNI (abastecimentos/custos, veículos/motoristas, manutenção preditiva,
// centros de custo/indicadores). Tabelas fora desse escopo (ex.: postos_gf,
// anp_postos, integrações, permissões) não são mencionadas de propósito —
// mesmo que o modelo tente consultá-las, o RLS por trás do
// ia_executar_select decide o que ele realmente enxerga.
const SYSTEM_PROMPT = `Você é o Assistente FNI, um assistente que responde, em português do Brasil,
tanto perguntas sobre a operação de frota do usuário logado (dados reais, via SQL)
quanto perguntas sobre como usar a plataforma Fleet Network Intelligence (FNI) —
"onde fica X", "como faço Y", "o que significa esse indicador", "quais integrações
existem", etc. São dois tipos de pergunta bem diferentes; identifique qual é o caso
antes de escolher a ferramenta.

## Pergunta sobre COMO USAR a plataforma (dúvida de uso, não de dados)

Use a ferramenta "buscar_ajuda_treinamento" para procurar no conteúdo oficial de
ajuda/treinamento da plataforma (o mesmo conteúdo que aparece nos ícones "?" de
cada tela e na Central de Treinamento em /treinamento). Baseie sua resposta NESSE
conteúdo — não invente passos de uso que não estão lá. Se a busca não retornar
nada relevante, diga que não encontrou aquele tópico no material de treinamento e
sugira que o usuário explore a Central de Treinamento (/treinamento) ou fale com o
suporte, em vez de adivinhar como a tela funciona.
Isso é especialmente importante para perguntas sobre integrações (meios de
pagamento, Pró-Frotas, ERPs, automação de posto, NF-e, carga de preços) — é uma
área onde é fácil o usuário presumir que algo é automático quando na verdade
depende de configuração ou lançamento manual, e o conteúdo de treinamento tem o
cuidado de deixar isso explícito.

## Pergunta sobre DADOS reais da operação (números, listas, rankings)

Você tem uma ferramenta chamada "consultar_banco" que executa uma consulta SQL
somente leitura (SELECT ou WITH ... SELECT) direto no banco Postgres do produto.
Use-a sempre que precisar de dados reais para responder — nunca invente números.

Regras importantes sobre a ferramenta:
- Apenas 1 comando por chamada, começando com SELECT ou WITH.
- Não é possível fazer INSERT, UPDATE, DELETE ou qualquer alteração — a ferramenta
  bloqueia isso automaticamente. Você só lê dados, nunca altera nada.
- O resultado é limitado a 200 linhas. Se precisar de agregados (soma, média,
  contagem, top N), prefira calcular isso dentro do SQL (GROUP BY, SUM, AVG,
  ORDER BY ... LIMIT) em vez de pedir todas as linhas e somar você mesmo.
- A consulta roda com a permissão do usuário logado (Row Level Security). Isso
  significa que você só consegue ver dados das empresas/clientes aos quais esse
  usuário tem acesso — nunca tente "burlar" isso filtrando por outro empresa_id;
  não vai funcionar, e não é isso que o usuário quer de qualquer forma.
- Se uma consulta der erro, leia a mensagem de erro, ajuste o SQL e tente de novo
  (nomes de coluna errados são o erro mais comum — confira o schema abaixo).

## Schema disponível (tabelas do escopo deste assistente)

### ia_abastecimentos — TODOS os abastecimentos, de todos os meios de pagamento (USE ESTA POR PADRÃO)
Junta PróFrotas, outros provedores (Veloe, Sem Parar etc.), abastecimento interno e
abastecimentos feitos pelo PDV FNI. Já vem sem estornados/pendentes/negados.
provedor ('profrotas', 'interno', 'pdv' ou o nome do provedor externo), empresa_id (uuid),
placa, motorista_nome, data_abastecimento (timestamptz), hodometro, posto_nome,
municipio, uf (podem ser nulos), produto (combustível), litros, preco_litro, valor_total.
Para qualquer pergunta de gasto/consumo/ranking/preço de combustível, consulte esta
visão (e não profrotas_abastecimentos, que só cobre um dos meios de pagamento). Para
agrupar por mês use date_trunc('month', data_abastecimento). Se o usuário perguntar "por
meio de pagamento", agrupe por provedor.

### profrotas_abastecimentos — só abastecimentos PróFrotas (detalhes que só existem nele: veiculo_id, motorista_id, pv_cnpj)
id, cnpj_frota, empresa_id (uuid), data_abastecimento (timestamptz),
motorista_id, motorista_nome, veiculo_id, veiculo_placa,
pv_cnpj, pv_razao_social (posto), pv_municipio, pv_uf,
item_nome (tipo de combustível), item_quantidade (litros),
item_valor_unitario (preço por litro), item_valor_total (custo do abastecimento),
hodometro, abastecimento_estornado (0 = válido, 1 = estornado — normalmente filtre
por abastecimento_estornado = 0).

### cadastro_veiculos — veículos da frota
id, cnpj_frota, empresa_id (não existe direto — resolva com
public.empresa_id_do_cnpj(cnpj_frota) = 'uuid-da-empresa' se precisar filtrar),
placa, marca, modelo, ano_modelo, ano_fabricacao, combustivel, tanque (capacidade),
autonomia, hodometro_atual, ativo (boolean), centro_custo_id, centro_custo_nome,
tipo_veiculo, municipio, uf_veiculo.
Dica: para listar veículos de uma empresa específica, prefira
"select * from veiculos_da_empresa('uuid-da-empresa')" (função já pronta) em vez
de comparar cnpj_frota manualmente — o formato do CNPJ nessa tabela é inconsistente.

### motoristas — motoristas cadastrados
id, empresa_id (uuid), nome_completo, cpf, telefone, email, status (ex.: "Ativo",
"Inativo"), classificacao, cnh, cnh_vencimento, centro_custo_id.

### manutencoes_realizadas — histórico de manutenções
id, cnpj_frota, empresa_id (uuid), placa, data_manutencao, hodometro, tecnico,
oficina, custo_total, itens_realizados (array de texto), obs_gerais.

### centros_custo — centros de custo cadastrados
id, empresa_id (uuid), cnpj_frota, nome, codigo, descricao, responsavel, ativo.

### centros_custo_veiculos — histórico de alocação de veículo a centro de custo
id, centro_custo_id, empresa_id (uuid), cnpj_frota, placa, data_inicio, data_fim
(null = alocação atual/vigente), ativo.

### multas — multas de trânsito
id, empresa_id (uuid), placa, motorista_id, numero_ait, orgao_autuador, local_infracao,
data_infracao (date), data_limite_indicacao (date), descricao, gravidade, pontos,
valor_original, valor_desconto, status ('pendente_indicacao', 'indicada', 'paga',
'recorrida', 'vencida', 'cancelada'), pago_em, indicado_em.
"Multas em aberto" = status em ('pendente_indicacao','indicada'). Para motorista, junte
com motoristas (multas.motorista_id = motoristas.id).

### fretes — fretes ofertados/contratados pela empresa
id, empresa_id (uuid), titulo, origem_label, destino_label, coleta_cidade, coleta_uf,
entrega_cidade, entrega_uf, tipo_carga, peso_carga_kg, data_saida_prevista, prazo_entrega,
km_estimado, valor_oferecido, status ('disponivel', 'aguardando_confirmacao', 'aceito',
'em_andamento', 'concluido', 'cancelado', 'recusado'), motorista_id, criado_em.

### pecas_estoque — estoque de peças da oficina/frota
id, empresa_id (uuid), nome, codigo, unidade_medida, quantidade_atual, quantidade_minima,
custo_unitario_medio, ativa. "Estoque baixo" = quantidade_atual <= quantidade_minima.

### empresas — clientes da plataforma (metadados, não dados operacionais)
id (uuid), nome, cnpj, ativo.

## Respostas visuais (gráficos e tabelas)

Você tem a ferramenta "exibir_grafico", que desenha um gráfico ou tabela na tela do
usuário. Use-a DEPOIS de consultar os dados, sempre que a resposta for:
- ranking ou comparação entre itens (veículos, postos, motoristas, centros de custo) → "barras";
- evolução no tempo (por dia, semana, mês) → "linhas";
- participação no total (ex.: % por combustível, por centro de custo) → "pizza" (até 8 fatias);
- lista detalhada com mais de uma coluna de números → "tabela" (1 série = 1 coluna).
Regras: os números devem vir exatamente do resultado das consultas (nunca invente nem
estime); no máximo 15 categorias (agrupe o resto em "Outros" ou use LIMIT); ordene
rankings do maior para o menor; escolha "formato" (moeda, litros, km, percentual ou
numero) conforme a unidade. Depois do gráfico, escreva só 1 a 3 frases com a conclusão
principal (o que chama atenção) — não repita os números todos em texto nem faça
tabela markdown quando já chamou exibir_grafico. Para respostas de 1 número só, não
precisa de gráfico.

## Preços de combustível ao longo de uma rota

Para "preciso da variação de preços na minha rota para decidir onde abastecer" use a
ferramenta "precos_na_rota" (origem e destino em texto livre, ex.: "Curitiba, PR" e
"São Paulo, SP"; combustível; raio opcional). Ela usa o mesmo motor da tela de
Roteirização e devolve os postos do corredor da rota, em ordem de quilometragem, com
preço, desvio da rota (km) e origem do preço ("proprio" = negociado/importado do cliente;
"anp" = estimativa oficial da ANP). Se o usuário não disser o combustível, assuma o mais
provável pelo contexto (ex.: caminhão → Diesel S-10 Comum) e informe a suposição; se não
disser origem/destino, peça. Depois: (1) "linhas" com preço × posto na ordem da rota para
mostrar a variação, ou "barras" com os 8 mais baratos; (2) escreva as recomendações: o
posto mais barato, o quanto economiza vs. a média do trecho (R$/L e para um tanque de
referência de 100 L) e se o desvio da rota compensa. Deixe claro quando o preço é estimativa
ANP. Nunca recomende posto sem preço.

## Cadastrar regra de consumo (km/l) — AÇÃO que grava dados, sempre com confirmação

Quando o usuário pedir para "parametrizar/cadastrar/criar" uma regra de consumo (ex.: "veículos da
Fiat com média de 9 a 12 km/l para autorizar o abastecimento"), use a ferramenta
"propor_regra_consumo". Ela NÃO grava: mostra ao usuário um cartão com o resumo e botões
Confirmar/Cancelar. Depois de chamar, diga apenas que a proposta está na tela aguardando a confirmação
e explique em 1 frase o efeito: o abastecimento fora da faixa será BLOQUEADO na autorização (PDV),
avaliado só quando há hodômetro atual e anterior e o abastecimento enche ao menos 50% do tanque. Nunca
afirme que a regra foi criada. Se faltar o mínimo, o máximo ou a marca/placa, pergunte antes.
Use "marca_contem" para marca/modelo (ex.: "Fiat") OU "placa" para um veículo — nunca os dois.

## Cadastro de veículo e motorista — AÇÃO que grava dados, sempre com confirmação

Quando o usuário pedir para cadastrar, alterar, inativar ou reativar um veículo ou motorista, use a
ferramenta "propor_cadastro". Ela NÃO grava: mostra um cartão com o resumo e botões Confirmar/Cancelar.
Depois de chamar, diga só que a proposta está na tela aguardando a confirmação. Nunca afirme que o
cadastro foi feito.
- Não existe exclusão definitiva. Se pedirem "excluir/apagar/remover", explique em 1 frase que o sistema
  inativa (mantém o cadastro e o histórico de abastecimentos, multas e fretes) e proponha "inativar".
- Veículo: para criar, a placa é obrigatória (marca, modelo, ano etc. são opcionais). Para alterar,
  inativar ou reativar, informe a placa atual em "identificador".
- Motorista: para criar, nome completo e CPF são obrigatórios. Para alterar, inativar ou reativar,
  "identificador" é o CPF ou o nome do motorista (prefira o CPF; se houver nomes parecidos a ferramenta
  avisa e você pede o CPF).
- Preencha em "campos" só o que o usuário disse; nunca invente dados (CPF, placa, datas). Se faltar um
  campo obrigatório, pergunte antes de chamar a ferramenta.
- Se a ferramenta devolver erro (já existe, não encontrado, sem permissão), explique ao usuário em
  linguagem simples e diga o que ele pode fazer.
- Vale para um cliente por vez: exige o cliente selecionado.

## Previsão de custo (projeção até o fim do mês)

Quando perguntarem "qual a previsão de gasto/custo com combustível até o fim do mês" (ou
semana/ano), use ia_abastecimentos e faça a projeção em 2 passos de SQL, sem inventar:
1. Realizado no mês até hoje: soma de valor_total (e litros) de
   date_trunc('month', now()) até agora; e quantos dias já passaram / quantos faltam
   (use current_date, extract(day from ...) e o último dia do mês).
2. Ritmo diário de referência: média diária dos ÚLTIMOS 30 dias completos (sum/30). Como
   conferência, compare com o mesmo período dos 2 meses anteriores.
Previsão = realizado até hoje + ritmo diário × dias restantes. Mostre um gráfico "barras"
com 3 barras (Realizado até hoje, Projeção dos dias restantes, Total previsto do mês) ou
"linhas" com o acumulado por dia + projeção, e escreva: o valor previsto, o ritmo diário
usado, o total do mês anterior para comparação e que é uma ESTIMATIVA baseada no ritmo
recente (não considera mudança de preço, feriados ou fim de semana). Se o usuário
tiver mais de uma empresa, a consulta já vem restrita ao que ele pode ver; se
perguntar "da minha frota" e houver várias empresas, pergunte qual ou mostre por empresa.

## Como responder

- Responda em português do Brasil, de forma direta e objetiva — o usuário é
  gestor de frota, não precisa de jargão técnico de SQL na resposta final.
- Sempre que fizer sentido, apresente números formatados (R$, km, litros) e,
  se a pergunta pedir um ranking ou lista, use uma tabela markdown simples.
- Se a consulta não retornar nenhuma linha, diga isso claramente em vez de
  inventar uma resposta.
- Se a pergunta for ambígua (ex.: "esse mês" sem dizer qual mês), assuma o mês
  atual e informe essa suposição na resposta.
- Se a pergunta de dados estiver fora do escopo do schema acima, explique
  educadamente que você só responde sobre abastecimentos/custos, veículos,
  motoristas, manutenção, multas, fretes, estoque de peças e centros de custo — mas lembre que dúvidas sobre COMO
  USAR outras telas da plataforma (roteirização, fretes, integrações, assinatura
  etc.) você pode responder via buscar_ajuda_treinamento.
- Ao responder com base em buscar_ajuda_treinamento, cite o título da lição/tópico
  usado e, quando fizer sentido, mencione que o usuário pode ver o conteúdo
  completo (às vezes com imagens) na Central de Treinamento, em /treinamento.`;

const FERRAMENTA_SQL: Anthropic.Tool = {
  name: "consultar_banco",
  description:
    "Executa uma consulta SQL somente leitura (SELECT ou WITH) no banco de dados da FNI e retorna até 200 linhas em JSON. A consulta roda com a permissão do usuário logado (Row Level Security) — só retorna dados das empresas às quais ele tem acesso.",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "Consulta SQL somente leitura, uma única instrução, iniciando com SELECT ou WITH.",
      },
    },
    required: ["sql"],
  },
};

// Segunda ferramenta do Assistente FNI (Fase Central-Treinamento, 20/07/2026):
// busca no conteúdo oficial de ajuda/treinamento (conteudo_ajuda), o mesmo
// conteúdo dos ícones "?" e da Central de Treinamento — mantém as respostas
// sobre "como usar a plataforma" fiéis ao que realmente existe, em vez do
// modelo inventar passos. Usa o supabase.from() normal (não uma RPC própria)
// porque a RLS de conteudo_ajuda já libera select de linhas ativo=true pra
// qualquer usuário autenticado — não precisa de nenhum privilégio especial.
const FERRAMENTA_AJUDA: Anthropic.Tool = {
  name: "buscar_ajuda_treinamento",
  description:
    "Busca no conteúdo oficial de ajuda/treinamento da plataforma FNI (tooltips contextuais e lições da Central de Treinamento) por um termo ou tema. Use para responder dúvidas de 'como usar', 'onde fica', 'o que significa' ou 'quais integrações existem' — nunca para dados da operação do usuário (para isso use consultar_banco).",
  input_schema: {
    type: "object",
    properties: {
      termo: {
        type: "string",
        description:
          "Termo ou tema a buscar (ex.: 'integração pró-frotas', 'excedente de veículos', 'roteirização', 'manutenção preditiva').",
      },
    },
    required: ["termo"],
  },
};

const FERRAMENTA_GRAFICO: Anthropic.Tool = {
  name: "exibir_grafico",
  description:
    "Desenha um gráfico (barras, linhas, pizza) ou uma tabela na tela do usuário com dados que você JÁ consultou. Cada série tem um valor numérico por categoria. Pode ser chamada mais de uma vez na mesma resposta.",
  input_schema: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["barras", "linhas", "pizza", "tabela"] },
      titulo: { type: "string", description: "Título curto, ex.: 'Custo de combustível por veículo — últimos 30 dias'." },
      formato: { type: "string", enum: ["numero", "moeda", "litros", "km", "percentual"] },
      categorias: { type: "array", items: { type: "string" }, description: "Rótulos do eixo X (ou linhas da tabela)." },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            valores: { type: "array", items: { type: "number" }, description: "Um número por categoria, na mesma ordem." },
          },
          required: ["nome", "valores"],
        },
      },
    },
    required: ["tipo", "titulo", "categorias", "series"],
  },
};

const FERRAMENTA_ROTA: Anthropic.Tool = {
  name: "precos_na_rota",
  description:
    "Calcula a rota entre origem e destino e lista os postos no corredor da rota com o preço do combustível escolhido (em ordem de km). Usa o mesmo motor da Roteirização da FNI. Use para comparar preços e decidir onde abastecer numa viagem.",
  input_schema: {
    type: "object",
    properties: {
      origem: { type: "string", description: "Cidade/endereço de origem, ex.: 'Curitiba, PR'." },
      destino: { type: "string", description: "Cidade/endereço de destino, ex.: 'São Paulo, SP'." },
      combustivel: {
        type: "string",
        enum: [...PRODUTOS_POSTO],
        description: "Combustível a comparar.",
      },
      raio_km: { type: "number", description: "Distância máxima do posto até a rota, em km (padrão 5, máximo 15)." },
    },
    required: ["origem", "destino", "combustivel"],
  },
};

async function executarPrecosNaRota(entrada: unknown, empresaId: string | null | undefined): Promise<{ conteudo: string; erro?: boolean }> {
  if (!empresaId) {
    return {
      erro: true,
      conteudo:
        "Não foi possível identificar a empresa do usuário (ele pode ter acesso a várias). Peça para selecionar um cliente no seletor da tela e perguntar de novo.",
    };
  }
  const e = (entrada ?? {}) as Record<string, unknown>;
  const origemTxt = typeof e.origem === "string" ? e.origem.trim() : "";
  const destinoTxt = typeof e.destino === "string" ? e.destino.trim() : "";
  const combustivel = PRODUTOS_POSTO.find((c) => c === e.combustivel);
  if (!origemTxt || !destinoTxt || !combustivel) {
    return { erro: true, conteudo: "Informe origem, destino e um combustível válido." };
  }
  const raio = Math.min(15, Math.max(1, Number(e.raio_km) || 5));

  const [orig, dest] = await Promise.all([geocodificar(origemTxt), geocodificar(destinoTxt)]);
  if (orig.length === 0) return { erro: true, conteudo: `Não encontrei a origem "${origemTxt}". Peça uma cidade/UF mais específica.` };
  if (dest.length === 0) return { erro: true, conteudo: `Não encontrei o destino "${destinoTxt}". Peça uma cidade/UF mais específica.` };

  const { calcularRotaEPostosAcao } = await import("@/app/(dashboard)/roteirizacao/actions");
  const r = await calcularRotaEPostosAcao({
    empresaId,
    origem: { lat: orig[0].lat, lon: orig[0].lon },
    destino: { lat: dest[0].lat, lon: dest[0].lon },
    combustivel,
    raioKm: raio,
  });

  const comPreco = r.candidatos.filter((c) => Number.isFinite(c.preco) && c.preco > 0);
  if (comPreco.length === 0) {
    return { conteudo: JSON.stringify({ origem: orig[0].label, destino: dest[0].label, distancia_km: r.distanciaKm, postos: [], aviso: "Nenhum posto com preço de " + combustivel + " no corredor da rota." }) };
  }
  const precos = comPreco.map((c) => c.preco);
  const media = precos.reduce((a, b) => a + b, 0) / precos.length;
  const postos = [...comPreco]
    .sort((a, b) => a.km - b.km)
    .slice(0, 40)
    .map((c) => ({
      posto: c.label,
      cidade: c.municipio ?? null,
      uf: c.uf ?? null,
      bandeira: c.bandeira ?? null,
      km_na_rota: Math.round(c.km),
      desvio_km: Math.round(c.desvioKm * 10) / 10,
      preco: Math.round(c.preco * 1000) / 1000,
      origem_preco: c.origem === "anp" ? "anp" : "proprio",
    }));
  return {
    conteudo: JSON.stringify({
      origem: orig[0].label,
      destino: dest[0].label,
      combustivel,
      distancia_km: r.distanciaKm,
      duracao_min: r.duracaoMin,
      rota_em_linha_reta: r.linhaReta,
      resumo_precos: {
        postos_com_preco: comPreco.length,
        minimo: Math.min(...precos),
        maximo: Math.max(...precos),
        media: Math.round(media * 1000) / 1000,
      },
      postos,
    }),
  };
}

const FERRAMENTA_PROPOR_REGRA_CONSUMO: Anthropic.Tool = {
  name: "propor_regra_consumo",
  description:
    "Prepara (SEM gravar) uma regra de consumo em km/l que bloqueia abastecimentos fora da faixa. O usuário confirma na tela. Informe marca_contem (ex.: 'Fiat') OU placa.",
  input_schema: {
    type: "object",
    properties: {
      marca_contem: { type: "string", description: "Trecho da marca/modelo, ex.: 'Fiat' ou 'Argo'." },
      placa: { type: "string", description: "Placa de um veículo específico (alternativa à marca)." },
      consumo_minimo: { type: "number", description: "Consumo mínimo aceito, em km/l." },
      consumo_maximo: { type: "number", description: "Consumo máximo aceito, em km/l." },
      percentual_tanque_minimo: { type: "number", description: "Só avaliar se encher ao menos este % do tanque (padrão 50)." },
    },
    required: ["consumo_minimo", "consumo_maximo"],
  },
};

async function executarProporRegraConsumo(
  entrada: unknown,
  supabase: Supabase,
  contexto: { empresaId?: string | null; empresaNome?: string | null } | undefined,
  propostas: PropostaAcao[]
): Promise<{ conteudo: string; erro?: boolean }> {
  if (!contexto?.empresaId) {
    return {
      erro: true,
      conteudo: "Selecione um cliente no seletor do topo do Assistente antes de cadastrar uma regra (a regra vale para uma empresa).",
    };
  }
  const e = (entrada ?? {}) as Record<string, unknown>;
  const v = validarRegraConsumo({
    marcaContem: typeof e.marca_contem === "string" ? e.marca_contem : null,
    placa: typeof e.placa === "string" ? e.placa : null,
    consumoMinimo: Number(e.consumo_minimo),
    consumoMaximo: Number(e.consumo_maximo),
    percentualTanqueMinimo: e.percentual_tanque_minimo == null ? null : Number(e.percentual_tanque_minimo),
  });
  if (typeof v === "string") return { erro: true, conteudo: v };

  // Quantos veículos do cadastro a regra alcança (informativo, só leitura, com RLS).
  let afetados: number | null = null;
  try {
    const base = supabase.rpc("veiculos_da_empresa", { p_empresa_id: contexto.empresaId }, { count: "exact", head: true });
    const { count } = v.placa ? await base.ilike("placa", `%${v.placa}%`) : await base.ilike("marca", `%${v.marcaContem}%`);
    afetados = count ?? null;
  } catch {
    afetados = null;
  }

  propostas.push({
    tipo: "regra_consumo",
    empresaId: contexto.empresaId,
    empresaNome: contexto.empresaNome ?? "",
    ...v,
    veiculosAfetados: afetados,
    resumo: descreverRegraConsumo(v),
  });
  return {
    conteudo: `Proposta exibida ao usuário com botões Confirmar/Cancelar (alcança ${afetados ?? "?"} veículo(s) cadastrado(s)). NADA foi gravado ainda — aguarde a confirmação do usuário.`,
  };
}

const FERRAMENTA_PROPOR_CADASTRO: Anthropic.Tool = {
  name: "propor_cadastro",
  description:
    "Prepara (SEM gravar) o cadastro, alteração, inativação ou reativação de um veículo ou motorista. O usuário confirma na tela. Não existe exclusão definitiva: para 'excluir' use acao 'inativar'.",
  input_schema: {
    type: "object",
    properties: {
      entidade: { type: "string", enum: ["veiculo", "motorista"] },
      acao: { type: "string", enum: ["criar", "alterar", "inativar", "reativar"] },
      identificador: {
        type: "string",
        description: "Quem será alterado/inativado/reativado: placa (veículo) ou CPF/nome (motorista). Não usar em 'criar'.",
      },
      campos: {
        type: "object",
        description:
          "Dados a gravar. Veículo: placa, marca, modelo, ano_modelo, ano_fabricacao, hodometro_atual, combustivel, tanque, autonomia, cor, chassi, renavam, uf_veiculo, municipio, numero_eixos, classificacao (Próprio|Agregado), tipo (Leve|Pesado). Motorista: nome_completo, cpf, telefone, email, cnh, cnh_vencimento (DD/MM/AAAA), exame_toxicologico_vencimento, aso_vencimento, classificacao (Próprio|Agregado). Em 'alterar', só os campos que mudam. Vazio em inativar/reativar.",
        additionalProperties: true,
      },
    },
    required: ["entidade", "acao"],
  },
};

async function executarProporCadastro(
  entrada: unknown,
  supabase: Supabase,
  contexto: { empresaId?: string | null; empresaNome?: string | null } | undefined,
  propostas: PropostaAcao[]
): Promise<{ conteudo: string; erro?: boolean }> {
  if (!contexto?.empresaId) {
    return {
      erro: true,
      conteudo: "Selecione um cliente no seletor do topo do Assistente antes de mexer em cadastros (o cadastro pertence a uma empresa).",
    };
  }
  const e = (entrada ?? {}) as Record<string, unknown>;
  const v = validarCadastro({ entidade: e.entidade, acao: e.acao, identificador: e.identificador, campos: e.campos });
  if (typeof v === "string") return { erro: true, conteudo: v };

  // A empresa já foi validada por quem chamou (perguntarAssistenteAcao) e a RLS esconde o que o
  // usuário não pode ver; aqui só conferimos perfil e permissão da funcionalidade.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const semPermissao = await conferirPermissaoCadastro(supabase, v.entidade, perfil ?? null, user?.email, contexto.empresaId);
  if (semPermissao) return { erro: true, conteudo: semPermissao };

  const prep = await prepararCadastro(supabase, contexto.empresaId, v);
  if ("erro" in prep) return { erro: true, conteudo: prep.erro };

  propostas.push({
    tipo: "cadastro",
    entidade: v.entidade,
    acao: v.acao,
    empresaId: contexto.empresaId,
    empresaNome: contexto.empresaNome ?? "",
    identificador: v.identificador,
    campos: v.campos,
    alvo: prep.alvo,
    mudancas: prep.mudancas,
    aviso: prep.aviso,
    resumo: prep.resumo,
  });
  return {
    conteudo: `Proposta exibida ao usuário com botões Confirmar/Cancelar: ${prep.resumo} NADA foi gravado ainda — aguarde a confirmação do usuário.`,
  };
}

function escaparTermoIlike(termo: string): string {
  return termo.replace(/[%_]/g, (c) => `\\${c}`);
}

// `chaveCliente`: chave Anthropic própria da empresa (Vault). Sem ela, usa a chave da FNI.
function clienteAnthropic(chaveCliente?: string | null): Anthropic {
  if (chaveCliente) return new Anthropic({ apiKey: chaveCliente });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Adicione essa variável ao seu .env.local (com a chave da sua assinatura da API Anthropic) para usar o Assistente FNI."
    );
  }
  return new Anthropic({ apiKey });
}

// Núcleo do Assistente FNI: recebe a pergunta + histórico da conversa, deixa
// o modelo decidir se (e quantas vezes) precisa chamar a ferramenta de SQL
// via ia_executar_select, executa cada consulta com o cliente Supabase da
// requisição atual (autenticado como o usuário logado, então sujeito a RLS
// normalmente) e devolve a resposta final em texto, junto com a lista de
// consultas SQL realmente executadas (para transparência na UI).
export async function perguntarAssistente(
  pergunta: string,
  historico: MensagemChat[],
  supabase: Supabase,
  contexto?: {
    empresaId?: string | null;
    empresaNome?: string | null;
    chaveApi?: string | null;
    // Canal que não mostra cartões de confirmação (ex.: app do motorista): sem ferramentas que gravam.
    semAcoes?: boolean;
    // Acumula os tokens gastos (entrada/saída) — o chamador registra o consumo por cliente,
    // mesmo se a execução falhar no meio (por isso é um objeto compartilhado, não o retorno).
    medidor?: { entrada: number; saida: number };
  }
): Promise<RespostaAssistente> {
  const anthropic = clienteAnthropic(contexto?.chaveApi);
  const consultas: ConsultaExecutada[] = [];
  const blocos: BlocoVisual[] = [];
  const propostas: PropostaAcao[] = [];
  let pediuRespostaFinal = false;

  const mensagens: Anthropic.MessageParam[] = [
    ...historico.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: pergunta },
  ];

  for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTA; rodada++) {
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system:
        (contexto?.empresaId
          ? `${SYSTEM_PROMPT}\n\n## Cliente selecionado pelo usuário\nO usuário está trabalhando com a empresa "${contexto.empresaNome ?? ""}" (empresa_id = '${contexto.empresaId}'). Nas consultas de dados, FILTRE por esse empresa_id (nas tabelas que têm a coluna; em cadastro_veiculos use public.empresa_id_do_cnpj(cnpj_frota) = '${contexto.empresaId}') e diga na resposta que os números são dessa empresa.`
          : SYSTEM_PROMPT) +
        (contexto?.semAcoes
          ? "\n\n## Canal somente leitura\nNeste canal você NÃO grava dados: não há ferramenta para cadastrar, alterar ou inativar veículo/motorista nem criar regras. Se o usuário pedir isso, diga em 1 frase que ele deve fazer pelo painel web (Veículos, Motoristas ou Parâmetros de uso) ou pelo Assistente do painel web."
          : ""),
      tools: contexto?.semAcoes
        ? [FERRAMENTA_SQL, FERRAMENTA_AJUDA, FERRAMENTA_GRAFICO, FERRAMENTA_ROTA]
        : [FERRAMENTA_SQL, FERRAMENTA_AJUDA, FERRAMENTA_GRAFICO, FERRAMENTA_ROTA, FERRAMENTA_PROPOR_REGRA_CONSUMO, FERRAMENTA_PROPOR_CADASTRO],
      messages: mensagens,
    });
    if (contexto?.medidor) {
      contexto.medidor.entrada += resposta.usage?.input_tokens ?? 0;
      contexto.medidor.saida += resposta.usage?.output_tokens ?? 0;
    }

    const blocosTexto = resposta.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const blocosFerramenta = resposta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (blocosFerramenta.length === 0) {
      const texto = blocosTexto.map((b) => b.text).join("\n").trim();
      // Resposta vazia (ex.: o modelo parou logo depois de uma ferramenta, ou estourou o
      // limite de tokens): pede UMA vez a resposta final em vez de desistir.
      if (!texto && blocos.length === 0 && propostas.length === 0 && !pediuRespostaFinal) {
        console.error("[assistente] resposta vazia", { stop_reason: resposta.stop_reason, rodada, tipos: resposta.content.map((b) => b.type) });
        pediuRespostaFinal = true;
        if (resposta.content.length > 0) mensagens.push({ role: "assistant", content: resposta.content });
        mensagens.push({
          role: "user",
          content:
            "Escreva agora a resposta final ao usuário, em português, com base no que já foi obtido. Se faltou alguma informação (ex.: origem ou destino mais específicos), diga o que precisa.",
        });
        continue;
      }
      return { resposta: texto || (blocos.length > 0 || propostas.length > 0 ? "" : "Não consegui gerar uma resposta para essa pergunta."), consultas, blocos, propostas };
    }

    mensagens.push({ role: "assistant", content: resposta.content });

    const resultadosFerramenta: Anthropic.ToolResultBlockParam[] = [];
    for (const bloco of blocosFerramenta) {
      if (bloco.name === "exibir_grafico") {
        const validado = validarBlocoVisual(bloco.input);
        if (typeof validado === "string") {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: `Não foi possível exibir: ${validado}`,
            is_error: true,
          });
        } else {
          blocos.push(validado);
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: "Exibido ao usuário. Agora escreva só a conclusão em 1 a 3 frases.",
          });
        }
        continue;
      }
      if (bloco.name === "propor_regra_consumo") {
        const r = await executarProporRegraConsumo(bloco.input, supabase, contexto, propostas);
        resultadosFerramenta.push({ type: "tool_result", tool_use_id: bloco.id, content: r.conteudo, is_error: r.erro });
        continue;
      }
      if (bloco.name === "propor_cadastro") {
        try {
          const r = await executarProporCadastro(bloco.input, supabase, contexto, propostas);
          resultadosFerramenta.push({ type: "tool_result", tool_use_id: bloco.id, content: r.conteudo, is_error: r.erro });
        } catch (err) {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: `Não consegui preparar o cadastro: ${err instanceof Error ? err.message : "falha desconhecida"}`,
            is_error: true,
          });
        }
        continue;
      }
      if (bloco.name === "precos_na_rota") {
        try {
          const r = await executarPrecosNaRota(bloco.input, contexto?.empresaId);
          resultadosFerramenta.push({ type: "tool_result", tool_use_id: bloco.id, content: r.conteudo, is_error: r.erro });
        } catch (err) {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: `Erro ao calcular a rota: ${err instanceof Error ? err.message : "falha desconhecida"}`,
            is_error: true,
          });
        }
        continue;
      }
      if (bloco.name === "buscar_ajuda_treinamento") {
        const entrada = bloco.input as { termo?: unknown };
        const termo = typeof entrada.termo === "string" ? entrada.termo.trim() : "";

        if (!termo) {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: "Termo de busca vazio — informe um termo ou tema.",
            is_error: true,
          });
          continue;
        }

        const padrao = `%${escaparTermoIlike(termo)}%`;
        const { data, error } = await supabase
          .from("conteudo_ajuda")
          .select("chave, tipo, modulo, titulo, texto")
          .eq("ativo", true)
          .or(`titulo.ilike.${padrao},texto.ilike.${padrao},modulo.ilike.${padrao}`)
          .limit(5);

        if (error) {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: `Erro ao buscar no conteúdo de ajuda: ${error.message}`,
            is_error: true,
          });
        } else if (!data || data.length === 0) {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: "Nenhum resultado encontrado no conteúdo de ajuda/treinamento para esse termo.",
          });
        } else {
          resultadosFerramenta.push({
            type: "tool_result",
            tool_use_id: bloco.id,
            content: JSON.stringify(data),
          });
        }
        continue;
      }

      const entrada = bloco.input as { sql?: unknown };
      const sql = typeof entrada.sql === "string" ? entrada.sql.trim() : "";

      if (!sql) {
        resultadosFerramenta.push({
          type: "tool_result",
          tool_use_id: bloco.id,
          content: "Consulta vazia — informe um SQL válido iniciando com SELECT ou WITH.",
          is_error: true,
        });
        continue;
      }

      const { data, error } = await supabase.rpc("ia_executar_select", { p_sql: sql });

      if (error) {
        consultas.push({ sql, linhas: 0, erro: error.message });
        resultadosFerramenta.push({
          type: "tool_result",
          tool_use_id: bloco.id,
          content: `Erro ao executar a consulta: ${error.message}`,
          is_error: true,
        });
      } else {
        const linhas = Array.isArray(data) ? data.length : 0;
        consultas.push({ sql, linhas });
        resultadosFerramenta.push({
          type: "tool_result",
          tool_use_id: bloco.id,
          content: JSON.stringify(data),
        });
      }
    }
    mensagens.push({ role: "user", content: resultadosFerramenta });
  }

  return {
    resposta:
      "Não consegui concluir a análise dentro do limite de consultas para essa pergunta. Tente reformular de forma mais específica (ex.: informando o período ou o veículo).",
    consultas,
    blocos,
    propostas,
  };
}
