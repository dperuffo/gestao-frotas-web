# Proposta — Painel de Comunicação (avisos, novidades e indisponibilidade)

Documento pra avaliação do Daniel antes de implementar. Objetivo: um canal oficial dentro da
aplicação pra comunicar evoluções, correções e indisponibilidades da plataforma — com texto,
imagem/banner — sem depender de e-mail ou WhatsApp.

## 1. O que já existe e vamos reaproveitar

Não existe hoje nenhum sistema central de notificação — o que existe é um padrão parecido em
dois lugares, que servem de base pra esta feature:

- **`conteudo_ajuda`** (`src/app/(dashboard)/administracao/central-conteudo/`): tabela editável
  sem deploy, com CRUD de admin protegido em duas camadas (RLS `perfil_usuario_atual()='admin'`
  + `garantirAdmin()` na Server Action), upload de imagem pra bucket próprio do Storage
  (`treinamento-imagens`), path salvo em coluna `*_path`. É o modelo mais próximo do que
  precisamos — vamos seguir a mesma estrutura de tela e o mesmo padrão de proteção.
- **`LembretePwaBanner`** (`src/components/pwa/`): faixa fixa no topo do `<main>`, renderizada
  uma vez em `layout.tsx`, dispensável pelo usuário. É o modelo visual do banner de aviso
  crítico (ex: manutenção em andamento).
- **Perfis** (`src/lib/constants.ts`): `admin` é o perfil global do time FNI, já usado pra
  gerenciar conteúdo de todos os clientes — será quem publica os comunicados.
- **Segmento e Plano** (`empresas.segmento` = Frota/Revenda, `empresas.plano`): já existem e dão
  a base pronta pra segmentar quem vê cada aviso (ex: um aviso só sobre Fretes não interessa a
  postos).

## 2. Modelo de dados proposto

Duas tabelas novas — separar o **comunicado** (o conteúdo) de **quem já viu** (o rastreio de
leitura), mesma lógica que já existe pros badges de "não visto" hoje espalhados por feature
(`contarChamadosNaoVistosAcao` etc.) — aqui centralizado numa tabela só.

**`comunicados`**
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | |
| `tipo` | texto | `novidade` \| `correcao` \| `manutencao` \| `aviso_geral` |
| `urgencia` | texto | `informativo` \| `atencao` \| `critico` — muda cor/ícone e se é dispensável |
| `titulo` | texto | |
| `resumo` | texto | linha curta pro sino/banner |
| `corpo` | texto | conteúdo completo (markdown simples — negrito, links, listas) |
| `imagem_path` | texto opcional | banner, bucket próprio `comunicados-imagens` |
| `segmentos_alvo` | texto[] | `["Frota"]`, `["Revenda"]` ou ambos — vazio = todos |
| `planos_alvo` | texto[] opcional | filtro fino por plano, quando fizer sentido |
| `empresas_alvo` | uuid[] opcional | avisos direcionados a clientes específicos (ex: uma integração que só afeta quem usa NF-e de certo provedor) |
| `data_publicacao` | timestamp | quando começa a aparecer |
| `data_expiracao` | timestamp opcional | quando some sozinho (essencial pra "manutenção das 2h às 4h") |
| `fixado` | bool | se true, vira banner no topo (não só item no sino) enquanto estiver na janela |
| `ativo` | bool | soft-delete, mesmo padrão de `conteudo_ajuda` |
| `criado_em`, `atualizado_em`, `atualizado_por` | | mesmo padrão |

**`comunicados_leituras`**
| Coluna | Tipo |
|---|---|
| `comunicado_id` | uuid (FK) |
| `usuario_email` | texto (mesma chave de junção "sem FK" já usada em `/negociacoes` e no dashboard) |
| `lido_em` | timestamp |

Isso dá de graça: contador de não lidos pro sino, histórico "quem já viu o aviso de
manutenção" (útil se precisar provar que avisou), e não obriga marcar como lido pra sumir do
banner (o dispensar é local, mas o "lido" pra fins de contagem é por usuário/servidor, não por
navegador — funciona entre desktop e celular).

## 3. Onde aparece pro usuário

- **Sino no rodapé do menu lateral** (`<aside>`), ao lado do ícone de ajuda que já existe hoje —
  com badge de contagem de não lidos.
- **Painel lateral (drawer)** ao clicar no sino: lista os comunicados ativos, mais recentes
  primeiro, com ícone por tipo (🆕 novidade, 🐛 correção, 🔧 manutenção, 📣 aviso geral) e cor por
  urgência. Marca como lido ao abrir.
- **Banner fixo no topo**, só para comunicados com `fixado=true` (tipicamente manutenção em
  andamento ou aviso crítico) — mesmo componente visual do `LembretePwaBanner`, mas cada um some
  sozinho na `data_expiracao`, sem precisar editar código.
- **Página "Central de Comunicados"** (histórico completo, tipo changelog público) — bom pra
  transparência e pra quem quer conferir o que mudou num release.

## 4. Painel de administração

Nova tela em `/administracao/central-comunicacao`, mesmo modelo do `central-conteudo`: listar,
criar, editar, ativar/desativar, excluir. Formulário com: tipo, urgência, título, resumo, corpo
(textarea com markdown simples, sem WYSIWYG pesado pra começar), upload de imagem, seletor de
segmento/plano/empresas-alvo, data de início/fim, checkbox "fixar como banner".

## 5. Pontos que preciso da sua decisão

1. **Urgência crítica bloqueia a tela?** Proposta: não — só destaca visualmente (banner
   vermelho fixo + drawer). Um modal obrigatório de "ciente" é mais invasivo e acho
   desnecessário pra um SaaS B2B, mas se você quiser essa opção pra avisos regulatórios/legais
   dá pra adicionar um `exige_confirmacao: bool` na tabela.
2. **Rich text**: markdown simples (negrito, links, listas, título) resolve 90% dos casos com
   bem menos esforço que um editor WYSIWYG completo. Só subo a régua se você já imaginar
   comunicados mais elaborados (colunas, botões, etc).
3. **Escopo desta primeira fase**: só painel web, ou já incluir o PWA (Flutter, app do
   motorista/cliente)? O padrão do projeto até aqui é sempre portar toda feature nova pro
   Flutter — mas dá pra fazer em duas etapas (web primeiro, valida o formato, depois porta).
4. **Nome da feature**: "Painel de Comunicação", "Central de Avisos" ou outro nome pra aparecer
   no menu?

## 6. Fases de implementação sugeridas

1. Schema (`comunicados` + `comunicados_leituras`) + RLS + tela de admin (CRUD completo, sem
   nada visível pro cliente ainda — dá pra testar o cadastro isolado).
2. Exibição pro usuário: sino + drawer + contagem de não lidos + banner fixo + página de
   histórico.
3. (Se decidido no ponto 5.3) Portar sino + drawer + banner pro PWA Flutter.

Me diz o que ajustar e seguimos pra implementação.
