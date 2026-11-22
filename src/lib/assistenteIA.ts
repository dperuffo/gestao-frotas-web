import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

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

export type RespostaAssistente = { resposta: string; consultas: ConsultaExecutada[]; blocos: BlocoVisual[] };

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
const MODELO = "claude-sonnet-5";

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

function escaparTermoIlike(termo: string): string {
  return termo.replace(/[%_]/g, (c) => `\\${c}`);
}

function clienteAnthropic(): Anthropic {
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
  supabase: Supabase
): Promise<RespostaAssistente> {
  const anthropic = clienteAnthropic();
  const consultas: ConsultaExecutada[] = [];
  const blocos: BlocoVisual[] = [];

  const mensagens: Anthropic.MessageParam[] = [
    ...historico.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: pergunta },
  ];

  for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTA; rodada++) {
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [FERRAMENTA_SQL, FERRAMENTA_AJUDA, FERRAMENTA_GRAFICO],
      messages: mensagens,
    });

    const blocosTexto = resposta.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const blocosFerramenta = resposta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (blocosFerramenta.length === 0) {
      const texto = blocosTexto.map((b) => b.text).join("\n").trim();
      return { resposta: texto || (blocos.length > 0 ? "" : "Não consegui gerar uma resposta para essa pergunta."), consultas, blocos };
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
  };
}
