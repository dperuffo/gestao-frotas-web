import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MensagemChat = { role: "user" | "assistant"; content: string };

export type ConsultaExecutada = { sql: string; linhas: number; erro?: string };

export type RespostaAssistente = { resposta: string; consultas: ConsultaExecutada[] };

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
const SYSTEM_PROMPT = `Você é o Assistente FNI, um analista de dados especializado em gestão de frotas
que responde, em português do Brasil, perguntas sobre a operação do usuário logado
na plataforma Fleet Network Intelligence (FNI).

## Como você consulta dados

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

### profrotas_abastecimentos — abastecimentos e custos de combustível
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

### empresas — clientes da plataforma (metadados, não dados operacionais)
id (uuid), nome, cnpj, ativo.

## Como responder

- Responda em português do Brasil, de forma direta e objetiva — o usuário é
  gestor de frota, não precisa de jargão técnico de SQL na resposta final.
- Sempre que fizer sentido, apresente números formatados (R$, km, litros) e,
  se a pergunta pedir um ranking ou lista, use uma tabela markdown simples.
- Se a consulta não retornar nenhuma linha, diga isso claramente em vez de
  inventar uma resposta.
- Se a pergunta for ambígua (ex.: "esse mês" sem dizer qual mês), assuma o mês
  atual e informe essa suposição na resposta.
- Se a pergunta estiver fora do escopo de dados de frota (schema acima), explique
  educadamente que você só responde sobre abastecimentos/custos, veículos,
  motoristas, manutenção e centros de custo.`;

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

  const mensagens: Anthropic.MessageParam[] = [
    ...historico.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: pergunta },
  ];

  for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTA; rodada++) {
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [FERRAMENTA_SQL],
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
      return { resposta: texto || "Não consegui gerar uma resposta para essa pergunta.", consultas };
    }

    mensagens.push({ role: "assistant", content: resposta.content });

    const resultadosFerramenta: Anthropic.ToolResultBlockParam[] = [];
    for (const bloco of blocosFerramenta) {
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
  };
}
