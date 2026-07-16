# Proposta — Regras Antifraude (verificação externa antes de autorizar abastecimento)

Próxima fase sugerida: **Fase 27.15x** (confirmar número exato no README antes
de começar; a última fase registrada até agora é a 27.153).

Decisões já confirmadas com o Daniel (16/07/2026): escopo da regra pode ser
por motorista, por veículo ou pela empresa toda; se a verificação falhar,
autoriza o abastecimento (fail-open) e notifica o cliente pra investigar antes
do próximo; PWA (Flutter) recebe a mesma tela de gestão da web, não só a web.

## 1. Objetivo

Hoje a plataforma só detecta problemas em abastecimentos **depois** que eles
já aconteceram (tela `/anomalias`, checagem manual, 4 regras fixas em código).
Este módulo inverte isso: o cliente cadastra regras próprias, com vigência, e
um sistema externo (bandeira de cartão, posto, gateway de pagamento) **consulta
a plataforma antes de liberar o abastecimento**, recebendo um veredito
aprovado/reprovado + motivo.

## 2. Modelo de dados

Nova tabela `regras_antifraude`, seguindo o padrão multi-tenant já usado em
`parametros_*` e `api_keys` (`empresa_id` + RLS por empresa):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | pk |
| `empresa_id` | uuid | dono da regra (RLS) |
| `nome` | text | rótulo livre, ex. "Limite diário motorista X" |
| `tipo` | text | `limite_valor_quantidade` \| `janela_tempo_frequencia` \| `localizacao_posto` |
| `escopo` | text | `motorista` \| `veiculo` \| `empresa` — a quem a regra se aplica |
| `escopo_referencia` | text | CPF do motorista ou placa do veículo; nulo quando `escopo = 'empresa'` |
| `condicoes` | jsonb | parâmetros específicos do `tipo` (ver exemplos abaixo) |
| `status` | text | `ativo` \| `inativo` (mesmo padrão de `parametros_*`) |
| `vigencia_inicio` | date | nula = vale desde já |
| `vigencia_fim` | date | nula = sem prazo |
| `criado_em` / `criado_por` | timestamptz / text | auditoria (padrão já usado em Preços/Negociações) |

Exemplos de `condicoes` por tipo (sem repetir o escopo, que já é coluna própria):

```jsonc
// limite_valor_quantidade
{ "litros_max_dia": 300, "valor_max_abastecimento": 800 }

// janela_tempo_frequencia
{ "intervalo_minimo_horas": 6, "horario_permitido": { "inicio": "05:00", "fim": "22:00" } }

// localizacao_posto
{ "postos_permitidos_cnpj": ["12345678000100"], "distancia_maxima_km_da_rota": 15 }
```

## 3. Telas de gestão (web e PWA)

**Web:** reaproveitar a estrutura de `/parametros-uso` — abas por tipo de
regra, tabela com nome / escopo / status / vigência / ações (editar,
ativar/desativar, excluir), formulário que muda os campos conforme o tipo.
Encaixe no menu: nova seção **Antifraude**, ao lado de `/anomalias`.

**PWA (Flutter):** mesma tela, versão mobile — lista com os mesmos campos
(nome, escopo, status, vigência) e formulário de criação/edição, seguindo o
padrão visual já usado nas telas de cadastro do app (ex. veículos/motoristas).
Cadastro e consulta de regras ficam disponíveis nos dois lados; quem de fato
verifica e autoriza é sempre o sistema externo, via API.

## 4. Endpoint para sistemas externos

Reaproveitar o Hub de Integrações já existente (`/api/integracoes/*`), mesma
autenticação por API key (`Authorization: Bearer <chave>`, tabela `api_keys`,
hash SHA-256) — novo escopo `ESCOPO_ANTIFRAUDE_VERIFICAR`.

```
POST /api/integracoes/antifraude/verificar
Authorization: Bearer <chave>

{
  "placa": "ABC1D23",
  "motorista_cpf": "12345678900",
  "posto_cnpj": "98765432000100",
  "data_hora": "2026-07-16T14:30:00-03:00",
  "litros": 45,
  "valor_total": 315.90
}
```

Resposta:

```jsonc
// aprovado
{ "autorizado": true }

// reprovado
{
  "autorizado": false,
  "motivo": "Limite diário de 300L excedido para este motorista (já abastecido: 280L hoje).",
  "regra_id": "..."
}

// falha interna ao avaliar as regras (fail-open)
{
  "autorizado": true,
  "aviso": "Não foi possível concluir a verificação antifraude — abastecimento autorizado por padrão. O cliente foi notificado para revisar."
}
```

## 5. Lógica de avaliação

- Busca as regras `ativo` da empresa do posto/cliente envolvido, com
  vigência cobrindo a data atual, filtrando por escopo (regras da empresa
  toda + regras específicas daquele motorista/veículo, se existirem).
- Cada regra é avaliada isoladamente; a primeira que reprovar já responde
  (resposta rápida, sistema externo não pode ficar esperando).
- Nenhuma regra ativa reprovou (ou não há regras cadastradas) →
  `autorizado: true`, comportamento atual continua valendo pra quem não
  configurou nada.
- **Erro interno durante a avaliação** (timeout de banco, condição malformada
  etc.) → **fail-open**: responde `autorizado: true` com o campo `aviso`, e
  grava uma notificação para a empresa (ver seção 6). A ideia é nunca travar
  a operação do cliente por uma falha nossa, mas garantir que ele saiba que
  aquele abastecimento específico não foi checado.

## 6. Notificação de falha de verificação

Não existe hoje uma tabela de notificação genérica na plataforma (cada
"bolinha" no menu é uma contagem própria por feature, ex. Fase 27.150 pra
Aprovação de Documentos). Seguindo o mesmo padrão:

- Nova tabela `antifraude_verificacoes_falhas` (`empresa_id`, `detalhe`,
  `abastecimento_referencia`, `criado_em`, `lida_em` nullable).
- Badge no menu ao lado de "Antifraude", contando falhas não lidas — mesmo
  padrão JSX da Fase 27.150 (`contarDocumentosPendentesAcao()` → aqui vira
  `contarFalhasVerificacaoAntifraude()`).
- E-mail via Resend, reaproveitando o padrão de `notificarNegociacao()`
  (`src/lib/negociacoesPostos.ts`, que já invoca uma Edge Function de e-mail
  para eventos de negócio) — dispara pro responsável da empresa assim que uma
  falha é registrada, "best-effort" (nunca bloqueia a resposta da API).

## 7. Fases sugeridas

1. Tabela `regras_antifraude` + RLS (empresa_id, mesmo padrão de `parametros_*`).
2. Tela de gestão na web (3 tipos, escopo, vigência).
3. Endpoint `POST /api/integracoes/antifraude/verificar` + escopo de API key + lógica de avaliação + fail-open.
4. Tabela `antifraude_verificacoes_falhas` + badge no menu + e-mail via Resend.
5. Tela de gestão no PWA (Flutter) — mesmo modelo da web.
6. Exemplos de `curl` na aba Integrações (mesmo padrão da Fase 27.122).
7. Testes com o robô de abastecimentos de teste, simulando reprovações e falhas.
