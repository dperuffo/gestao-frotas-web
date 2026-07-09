# Gestão de Frotas — Web App

Aplicação web (Next.js) da Plataforma de Gestão de Frotas — Fase 0 do roadmap:
fundação técnica, autenticação com MFA e design system, construída sobre o
banco Supabase já existente (projeto `nedthbeekvwzcjrhsghp`), compartilhado
com o app Flutter/PWA em produção.

Ver a proposta técnica completa (arquitetura, segurança, fases) no PDF
`proposta_gestao_frotas.pdf` gerado junto com este projeto.

## Como rodar localmente

1. `npm install`
2. Copie `.env.local.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` (já preenchido)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pegue em Project Settings > API no painel do Supabase)
3. `npm run dev` e acesse http://localhost:3000

## Autenticação — descoberta importante e decisão tomada

Investigando o backend Python (`api_server.py`, repositório `estudo-de-rede`), descobri que
o app Flutter/PWA **não usa o Supabase Auth**: ele faz login com Google, manda o `id_token`
para o endpoint `/auth/google` do FastAPI, que valida no Google e emite um **JWT próprio**
(segredo `JWT_SECRET`, nada a ver com o Supabase). O MFA é conferido à parte, com implementação
própria em Python (`pyotp`), usando o campo `mfa_secret` de `usuarios_app`. Por isso a tabela
`auth.users` do Supabase está vazia — e por isso o RLS do banco não é realmente exercido pelo
tráfego atual (o backend usa uma chave própria com acesso total e autoriza "na mão").

Existe também uma aplicação Streamlit (`estudo_de_rede.py`, arquivo enorme) que parece já
implementar boa parte da interface web atual — vale investigar com calma antes da Fase 2.

**Decisão tomada (01/07/2026):** a aplicação web em Next.js usa o **Supabase Auth nativo**,
com "Entrar com Google" e MFA nativo (TOTP via `supabase.auth.mfa`) — isso faz o RLS valer de
verdade, como a proposta técnica recomenda. Consequência: cada usuário precisa reconfigurar o
MFA (escanear um novo QR Code) na primeira vez que acessar a aplicação web, já que o MFA nativo
do Supabase é armazenado separadamente do `mfa_secret` customizado usado pelo app mobile.

### Configuração necessária no painel do Supabase (pendente, fora do meu alcance)

1. Acesse **Authentication > Sign In / Providers > Google** no [painel do Supabase](https://supabase.com/dashboard/project/nedthbeekvwzcjrhsghp/auth/providers) e habilite o provedor.
2. Você vai precisar de um **Client ID** e **Client Secret** do Google Cloud Console (pode ser
   o mesmo já usado pelo app Flutter, ou um novo específico para a web).
3. Em **Authorized redirect URIs** no Google Cloud Console, adicione:
   `https://nedthbeekvwzcjrhsghp.supabase.co/auth/v1/callback`
4. Em **Site URL** / **Redirect URLs** nas configurações de Auth do Supabase, adicione
   `http://localhost:3000/auth/callback` (para testes locais) e a URL de produção quando existir.

## O que já existe nesta Fase 0

- Login com "Entrar com Google" via Supabase Auth, com segundo fator (MFA/TOTP) nativo e
  obrigatório — tela de cadastro do fator (QR Code) na primeira vez, verificação nas próximas.
- Layout do dashboard com o menu **Cadastros** (Clientes, Grupo Econômico, Usuários,
  Motoristas, Veículos, Postos Revendedores) — páginas placeholder prontas para
  receber os formulários/grids nas próximas fases.
- Paleta de cores e componentes de base (`globals.css`, `tailwind.config.ts`).
- Clientes Supabase para Server e Client Components (`src/lib/supabase`).
- Tipos TypeScript do banco (`src/types/database.types.ts`) — cobre as tabelas
  usadas até a Fase 1; use `npm run gen:types` para gerar o arquivo completo
  quando tiver o Supabase CLI configurado.

## Alterações feitas no banco nesta sessão (migrations aplicadas)

- `grupos_economicos` e `grupos_economicos_empresas` (tabelas novas)
- `motoristas` (tabela nova, com auditoria automática em `audit_logs`)
- Colunas novas em `empresas`: endereço completo, contatos, porte, segmento,
  volume potencial por ciclo de combustível
- Colunas novas em `cadastro_veiculos`: `numero_eixos`, `classificacao`

Todas as mudanças são aditivas (não alteram nem removem nada existente) e já
têm políticas de RLS por `empresa_id`, seguindo o mesmo padrão usado em
`usuarios_empresas`.

## Pendência importante de segurança (decisão registrada em 01/07/2026)

Foi identificado que várias tabelas de produção (`empresas`, `usuarios_empresas`,
`frota_abastecimentos`, `historico_precos`, `controle_acesso`, `acordos_precos`,
`postos_gf`, `rotas_salvas`, `preferencias`, `configuracoes`, entre outras) têm
uma política de RLS "permitir tudo" (`USING (true)` / `WITH CHECK (true)`) liberada
para qualquer usuário, autenticado ou não. RLS está ligado, mas não protege
essas tabelas hoje.

Decisão do Daniel: manter como item formal da **Fase 5 (Hardening de Segurança)**,
para não interromper agora o roadmap. Este item já está registrado na seção de
riscos da proposta técnica — não esquecer de tratá-lo antes do go-live.

## Fase 1 — entregue nesta sessão

- **Clientes** (`/clientes`): grid com indicadores, busca, criar/editar — endereço completo,
  contatos, porte, segmento, volume potencial por ciclo de combustível, e visualização do
  plano/limites vindos do Stripe.
- **Grupo Econômico** (`/grupo-economico`): grid com indicadores, criar/editar, tela de
  vínculo/desvínculo de clientes ao grupo.
- **Usuários** (`/usuarios`): grid com indicadores (total, ativos, com MFA habilitado),
  criar (convite automático por e-mail via Supabase Auth Admin API + vínculo ao cliente) e
  editar perfil/dados.
- Botão de sair (logout) no menu lateral.
- Migration adicional: colunas `cpf`, `telefone`, `segmento` em `usuarios_app`.
- Novo arquivo `src/lib/supabase/admin.ts` — cliente com a chave `service_role`,
  usado **somente em Server Actions**, para convidar usuários.

### Validação feita nesta sessão

- `npm run typecheck` (tsc --noEmit): sem erros.
- `npm run lint` (next lint): sem erros.
- `next build` completo **não foi possível validar no sandbox** (o processo trava por volta
  da fase de compilação, aparentemente por lentidão de I/O da pasta sincronizada pelo iCloud —
  não houve nenhum erro de compilação capturado até o ponto em que travou). Rode
  `npm run build` na sua máquina (fora do iCloud, se possível) antes de considerar esta fase
  finalizada.

### Pendências da Fase 1 — fechadas em rodada posterior

- **Toggle de ativar/inativar direto na grid**: botões "Ativar/Suspender" (Clientes) e
  "Ativar/Inativar" (Usuários) em `_components/ToggleAtivoCliente.tsx` e
  `_components/ToggleAtivoUsuario.tsx`, usando as actions já existentes.
- **Administração de `permissoes_perfil`** (`/permissoes`): matriz funcionalidade × perfil
  com interruptores (switches) para permitir/negar acesso por perfil. Link adicionado no menu
  lateral, seção "Administração". Action `alternarPermissao` faz upsert usando a constraint
  única `(funcionalidade, perfil)`.
- **Importação em lote de usuários** (`/usuarios/importar`): upload de planilha CSV
  (colunas `nome`, `email`, `perfil`, `cnpj_cliente` obrigatórias; `cpf`, `telefone`,
  `segmento` opcionais), com modelo para download em `/usuarios/importar/modelo`. Cada linha
  passa pelo mesmo fluxo de convite/criação de perfil/vínculo usado no cadastro individual, com
  relatório de sucesso/erro por linha. Parser CSV próprio em `src/lib/csv.ts` (sem dependência
  externa), casando o CNPJ da planilha com o cliente já cadastrado.

Validado com `npm run typecheck` (sem erros) após cada mudança. `next lint` não pôde ser
reexecutado no sandbox nesta rodada (inconsistência conhecida de `node_modules` quando o
`npm install` roda em paralelo na sua máquina) — rode `npm run lint` localmente para conferir.

## Correção de bug crítico: recursão infinita no RLS de usuarios_app

Depois que o login passou a usar Supabase Auth nativo, a tela `/usuarios` parou de funcionar
com o erro `infinite recursion detected in policy for relation "usuarios_app"`. Causa: duas
policies (`admin_le_todos`, `admin_gerencia_usuarios`) faziam uma subconsulta na própria
`usuarios_app` dentro da policy da própria tabela — o Postgres não permite isso. O bug já
existia, mas ficava escondido porque o backend Python antigo usava a chave `service_role`
(ignora RLS). Corrigido criando a função `perfil_usuario_atual()` (SECURITY DEFINER, mesmo
padrão de `empresas_do_usuario`) e reescrevendo as duas policies para usá-la, quebrando o ciclo.

## Fase 2 — entregue

- **Motoristas** (`/motoristas`): grid com indicadores, busca, criar/editar, toggle
  ativar/inativar, importação em lote via planilha CSV (`/motoristas/importar`, modelo em
  `/motoristas/importar/modelo`).
- **Veículos** (`/veiculos`): grid com indicadores, busca, criar/editar, toggle
  ativo/inativo, importação em lote via planilha CSV (`/veiculos/importar`, modelo em
  `/veiculos/importar/modelo`). Como `cadastro_veiculos` usa `cnpj_frota` (texto) em vez de
  `empresa_id`, o formulário tem um select de "Cliente" que grava o CNPJ da empresa
  selecionada.
- **Correção de segurança**: `cadastro_veiculos` e `centros_custo` tinham RLS **habilitado
  mas sem nenhuma policy** (achado do advisor `rls_enabled_no_policy`) — só o `service_role`
  conseguia acessar essas tabelas, o que impediria o CRUD de funcionar para o usuário comum.
  Criadas policies seguindo o padrão de `motoristas`/`grupos_economicos` (função
  `empresas_do_usuario` + bypass do admin). Para `cadastro_veiculos`, nova função
  `empresa_id_do_cnpj()` casa o `cnpj_frota` com `empresas.cnpj` de forma normalizada.
- **Correção de bug**: a normalização de CNPJ (`apenasDigitos`, usada na importação de
  usuários) removia letras — isso quebra com o novo CNPJ alfanumérico que a Receita Federal
  passou a emitir a partir de 2026. Trocada por `normalizarCNPJ()` (remove só pontuação,
  mantém letras).

Validado com `npm run typecheck` (sem erros) após cada módulo. `next lint` não pôde ser
reexecutado no sandbox (mesma inconsistência de `node_modules` já registrada) — rode
`npm run lint` e `npm run build` localmente antes de considerar a fase encerrada.

## Fase 3 — Abastecimentos (entregue)

A tabela real usada pela integração com o meio de pagamento **PróFrotas** é
`profrotas_abastecimentos` (não `frota_abastecimentos`, que existe no banco mas está vazia e
não é usada). É uma tabela "granular por item": cada linha é um item de uma transação
(`identificador` identifica o abastecimento; `item_id` identifica o item dentro dele),
alimentada automaticamente pela integração (colunas `payload_raw`, `sync_key`, `importado_em`
confirmam isso). Outras integrações com meios de pagamento estão previstas para o futuro.

- **Abastecimentos** (`/abastecimentos`, menu "Operação"): grid com indicadores (litros
  totais, valor total, custo médio por litro), filtros por texto (placa/motorista/posto) e
  período, lançamento manual (`/abastecimentos/novo`) e edição/exclusão pontual — para clientes
  sem integração automática ou para corrigir um registro — e importação em lote via planilha
  CSV (`/abastecimentos/importar`, modelo em `/abastecimentos/importar/modelo`).
- **Correção de segurança encontrada durante a construção**: os 115 registros já existentes em
  `profrotas_abastecimentos` estavam todos com `empresa_id` nulo. A policy de RLS libera
  leitura quando `empresa_id IS NULL` — com um único cliente na base isso não vazava nada, mas
  assim que um segundo cliente sincronizasse dados, todo mundo veria os abastecimentos de todo
  mundo. Corrigido com: (1) trigger `preencher_empresa_id_profrotas` que preenche `empresa_id`
  automaticamente a partir do `cnpj_frota` (usa a função `empresa_id_do_cnpj` da Fase 2), tanto
  para inserções futuras da integração quanto para lançamentos manuais/importação; (2) backfill
  dos 115 registros existentes (confirmado: 115/115 com `empresa_id` preenchido). A cláusula
  `empresa_id IS NULL` continua na policy (não foi removida — é uma decisão de RLS, fica
  registrada para revisão na Fase 5).
- Lançamentos manuais/importados geram um `identificador` único usando uma sequência dedicada
  de números negativos (`profrotas_identificador_manual_seq`, exposta via RPC
  `nextval_identificador_manual`), para nunca colidir com os identificadores reais que vêm da
  integração (sempre positivos).

Validado com `npm run typecheck` (sem erros). `next lint` não pôde ser reexecutado no sandbox
(mesma inconsistência de `node_modules` já registrada) — rode `npm run lint` e
`npm run build` localmente.

## Fase 4 — Dashboard geral (entregue)

- **Dashboard** (`/dashboard`, agora a página inicial da aplicação): indicadores consolidados
  (clientes/motoristas/veículos ativos), litros e valor abastecidos no mês, custo médio por
  litro, alerta de CNH vencendo em 30 dias, gráfico de consumo/gasto dos últimos 6 meses
  (recharts) e top 5 clientes por gasto.

### Investigação do `estudo_de_rede.py` (Streamlit) para a aba "Dashboard"

A pedido do Daniel, investiguei a aba **📈 Dashboard** do Streamlit antes de expandir esta
fase. Achado importante: aquele dashboard **não é** uma visão de frota por cliente — é uma
ferramenta de inteligência da rede de postos parceiros ("Postos GF"), com 13 sub-abas
comparando preços da rede contra referências da ANP (cobertura por estado, penetração vs ANP,
mapa de densidade, alertas de preço, saving potencial/ano, postos com preço inconsistente,
score por região, distribuição A/B/C/D, eficiência de rotas, evolução temporal, etc.). Usa as
tabelas `postos_gf` e `historico_precos` — **ambas vazias em produção hoje** (0 registros).
O código-fonte antigo até documenta, em comentário, um bug conhecido no carregamento do
histórico (`session_state["_intel_data"] nunca é populado — chave errada`). Ou seja: os dados
de preços negociados da rede hoje só existem em planilhas carregadas ad-hoc na sessão do
Streamlit, nunca foram persistidos no Supabase. A tabela `anp_postos` (referência nacional da
ANP) tem 35.340 registros reais e pode ser usada como está.

**Decisão do Daniel**: a Inteligência de Rede deve ficar visível só para o `admin` e para
usuários do time interno — não para os perfis de cliente (`gestor_frota`/`posto`). Fica
registrado como próximo passo formal (ver seção abaixo), condicionado a primeiro popular
`postos_gf` de verdade (via o módulo "Postos Revendedores", ainda placeholder no menu).

Validado com `npm run typecheck` (sem erros).

## Fase 5 (em andamento) — Postos Revendedores (entregue)

- **Postos Revendedores** (`/postos`): CRUD completo (grid com indicadores, busca,
  criar/editar/excluir) + **importação em lote via planilha** (`/postos/importar`, modelo em
  `/postos/importar/modelo`) — forma principal de cadastro, como definido pelo Daniel. Reenviar
  um CNPJ já existente atualiza os dados (upsert).
- **Combustíveis e preços vigentes**: cada posto agora tem uma seção de preços por
  combustível, usando a tabela `historico_precos` (unique constraint `cnpj, combustivel,
  data_ref` já existente no banco — cada nova data é um novo registro, formando um histórico).
  Registro manual direto na tela do posto, e **importação em lote de preços**
  (`/postos/importar-precos`, modelo em `/postos/importar-precos/modelo`) pensada para reenvio
  periódico (ex: semanal) — exige que o posto já esteja cadastrado.
- `postos_gf` e `historico_precos` estavam vazias em produção (0 registros) antes desta rodada;
  ambas já tinham a policy de RLS `*_tenant_all` correta (por `empresa_id`), então não foi
  necessário criar policies novas — só popular os dados.

Validado com `npm run typecheck` (sem erros).

## Fase 5 — Inteligência de Rede (entregue)

- **Inteligência de Rede** (`/inteligencia-rede`, menu "Administração"): visão consolidada de
  todos os clientes — cobertura de postos por estado vs `anp_postos` (referência nacional real,
  35.340 registros) e preço médio da rede por combustível vs uma referência nacional estimada
  (`ANP_PRECO_REFERENCIA_FALLBACK` em `src/lib/constants.ts` — **não é uma fonte oficial
  persistida no banco**, o banco não tem uma tabela de preços ANP real hoje; é só uma
  estimativa fixa para dar contexto, igual ao que o Streamlit já fazia como fallback).
- **Restrição por perfil**: a página só mostra dados para quem tem `perfil = admin` (checagem
  via RPC `perfil_usuario_atual()`); qualquer outro perfil vê uma mensagem de acesso restrito.

### Achado de segurança: bypass de admin só funcionava para 1 e-mail

Ao restringir a Inteligência de Rede por perfil, descobri que o "bypass de admin" em **mais de
30 tabelas** do banco é um e-mail fixo (`auth.jwt()->>'email' = 'd.peruffo@gmail.com'`), não uma
checagem de perfil. Ou seja: hoje, só o Daniel pessoalmente consegue ver dados entre clientes —
qualquer outro membro do time interno com perfil `admin` NÃO conseguiria. Corrigido, só para as
2 tabelas necessárias aqui (`postos_gf`, `historico_precos`): adicionado
`perfil_usuario_atual() = 'admin'` como condição extra (aditiva, não removi o e-mail fixo) nas
policies `*_tenant_all`. Também criada a primeira policy de `anp_postos` (SELECT para
`authenticated`) — antes a tabela tinha RLS ligado e **nenhuma policy**, então nem o Daniel
conseguia ler via app (só via `service_role`).

**Pendência formal (não corrigida agora — fora do escopo desta tela)**: as ~27 outras tabelas
que usam o mesmo padrão de e-mail fixo como bypass (`empresas`, `motoristas`,
`profrotas_abastecimentos`, `usuarios_empresas`, etc. — ver lista completa checando
`qual ilike '%d.peruffo@gmail.com%'` em `pg_policies`). Se mais pessoas do time interno
precisarem de acesso "admin" a dados entre clientes nessas tabelas, o mesmo ajuste
(`perfil_usuario_atual() = 'admin'`) precisa ser replicado nelas.

Validado com `npm run typecheck` (sem erros).

## Fase 5 — Reformulação de Postos a partir das planilhas reais (entregue)

O Daniel enviou as 4 planilhas reais e recorrentes usadas hoje fora do sistema
(`postos_anp.xlsx`, `postos_gf.xlsx`, `preco_posto.xlsx`, `precos_anp.xlsx`), bem mais ricas que
o modelo inicial. O módulo de Postos foi refeito em cima delas:

- **Importações passaram a aceitar `.xlsx` direto** (biblioteca `xlsx`/SheetJS,
  `src/lib/xlsx.ts`), no lugar de exigir CSV convertido à mão. Limite de upload de server action
  aumentado para 25mb (`next.config.mjs`) — as planilhas reais chegam a alguns MB.
- **`anp_postos`** ganhou a coluna `gestao_frotas` (boolean): é o próprio indicador, vindo da
  planilha ANP, de quais dos ~35 mil postos nacionais já fazem parte da rede negociada
  (~2.400 hoje). Também ganhou `autorizacao_anp`, `situacao`, `status_sigaf` e uma constraint
  única em `cnpj` (para permitir upsert). Importação recorrente em `/postos/importar-anp`
  (admin only — é dado nacional compartilhado, não por cliente).
- **`postos_gf`** ganhou ~26 colunas novas para cobrir a planilha real (endereço completo,
  bandeira, grupo econômico, rede, contatos, e os campos de estrutura como banheiro,
  restaurante, estacionamento, troca de óleo, internet, tipo de ARLA etc.) — ver
  `src/types/database.types.ts` para a lista completa. A importação (`/postos/importar`) agora
  pede o **cliente dono da planilha inteira** (o arquivo não traz CNPJ do cliente por linha).
- **Bloqueio de posto pelo gestor de frota** (esclarecido pelo Daniel): "desativar" um posto
  **não é excluir** — é o gestor de frota bloqueando aquele posto para não ser usado em
  abastecimentos, mesmo que ele continue na rede negociada. Nova coluna `postos_gf.ativo`
  (boolean, default `true`), com toggle na tela de detalhe do posto e na listagem
  (`bloquearPosto`/`desbloquearPosto` em `actions.ts`) — reimportar a planilha **não reseta**
  esse bloqueio, porque a coluna não é enviada no payload de upsert.
- **Tela `/postos` reformulada**: antes listava só `postos_gf` (a rede já ativa). Agora navega o
  **universo ANP inteiro** (35 mil+ postos, paginado 50/página, filtro por UF/texto/"só Gestão de
  Frotas") e mostra por linha se aquele posto está "Não cadastrado", "Ativo" ou "Bloqueado pelo
  gestor" na rede do cliente selecionado, com ação de ativar/bloquear direto na linha
  (`AcaoPosto.tsx`). Quem só pertence a um cliente não precisa escolher; admin e usuários
  multi-empresa veem um seletor.
- **`historico_precos`** ganhou colunas da planilha real (`codigo_profrotas`, `codigo_abadi`,
  `preco_anterior`, `preco_referencia` por posto, `status`, `status_ponto_venda`,
  `origem_alteracao`, `bandeira`, `data_atualizacao`). Importação (`/postos/importar-precos`)
  casa o CNPJ do posto com o cliente automaticamente via `postos_gf`, quando existir.
- **Nova tabela `anp_precos_referencia`**: guarda a série oficial semanal da ANP
  ("Levantamento de Preços de Combustíveis", níveis Brasil/Região/Estado/Município/Capital),
  vinda de `precos_anp.xlsx`. Importação em `/inteligencia-rede/importar-precos-anp` (admin
  only). A Inteligência de Rede agora compara o preço médio da rede com o **preço oficial real**
  (nível Brasil, semana mais recente importada) sempre que existir um mapeamento de produto
  (`PRODUTO_PARA_CATEGORIA_ANP` em `src/lib/constants.ts`); a estimativa fixa
  (`ANP_PRECO_REFERENCIA_FALLBACK`) só é usada como último recurso, antes da primeira
  importação ou para produtos sem categoria ANP equivalente (ex: "Gasolina Alta Octanagem").
- Índices adicionados para as tabelas grandes (`anp_postos.uf`, `anp_postos.gestao_frotas`,
  `postos_gf.empresa_id`, `historico_precos(cnpj, data_ref)`, `anp_precos_referencia(nivel,
  data_final)`), já que `anp_postos` e `historico_precos` chegam a dezenas de milhares de linhas.
- Rotas antigas de modelo CSV (`/postos/importar/modelo`, `/postos/importar-precos/modelo`)
  ficaram órfãs (sem link) — o ambiente de trabalho não deixou apagar esses dois arquivos. Não
  atrapalham, mas podem ser removidos manualmente na pasta do projeto se quiser limpar.

Validado com `npm run typecheck` (sem erros).

## Próximos passos

A Roteirização (Fase 7) foi entregue — ver seção abaixo. Em aberto:

- Ver seção "Proposta de Fases de Desenvolvimento" no PDF da proposta técnica para o restante
  do escopo original (relatórios adicionais, outras integrações de meio de pagamento).
- Rodar `npm install` localmente (o `package.json`/`package-lock.json` ganharam as dependências
  `xlsx`, `leaflet`, `react-leaflet`, `@types/leaflet`) antes do próximo `npm run dev`/`npm run
  build`, se ainda não tiver feito.

## Fase 7 — Roteirização (entregue)

Antes de implementar, investiguei duas fontes legadas para não reinventar a lógica de negócio:
o app Flutter de produção (`roteirizacao_screen.dart` + endpoints `/roteirizacao/*` do backend
FastAPI) e, a pedido do Daniel, a ferramenta interna em Streamlit (`estudo_de_rede.py`, ~37 mil
linhas) que já tem 4 "modos de consulta" + rotas salvas rodando há mais tempo e com lógica mais
rica. Portei a lógica do Streamlit (mais completa) para TypeScript, mantendo os mesmos nomes de
tabela/campo onde possível para compatibilidade, já que o banco é compartilhado entre as duas
ferramentas.

Cinco telas em `/roteirizacao`, todas puxando de `postos_gf`/`historico_precos` (rede negociada
do cliente, não o universo ANP inteiro):

- **Por UF/Município** (`/roteirizacao`) — filtra a rede por estado/cidade, mapa, ranking dos 5
  postos mais baratos por combustível e um score por posto.
- **Por Rota** (`/roteirizacao/rota`) — origem/destino/paradas (busca por texto via Nominatim),
  calcula o trajeto real pelas estradas via OSRM público e lista os postos da rede dentro de um
  raio configurável do trajeto.
- **Consulta por Posto** (`/roteirizacao/posto`) — busca livre por CNPJ ou nome.
- **Roteirização** (`/roteirizacao/planejar`) — a mais rica: dado um veículo (tanque, autonomia,
  combustível — pré-preenchido se escolher um veículo cadastrado), sugere onde parar para
  abastecer ao longo da rota, quantos litros colocar em cada parada e o custo total. Usa os 4
  perfis de peso do Streamlit (Economia, Equilíbrio, Qualidade, Mínimas Paradas).
- **Rotas Salvas** (`/roteirizacao/salvas`) — reaproveita a tabela `rotas_salvas`, que **já
  existia no banco** (criada pelo Streamlit, com registros reais de produção) — não precisou de
  migração, só adicionar o tipo TS. Cada consulta salva pode ser reaberta, o que pré-preenche o
  formulário e recalcula na hora.

Decisões técnicas:

- **Mapa**: Leaflet + react-leaflet (tiles OpenStreetMap) — gratuito, sem chave de API, mesma
  filosofia do OSRM/Nominatim. `react-leaflet@4` (não a v5) porque o projeto está no React 18.
  Carregado via `next/dynamic({ ssr: false })` dentro de um Client Component
  (`MapaRotaLazy.tsx`), porque o Leaflet usa `window`/`document` direto e quebra em SSR.
- **Roteamento**: OSRM público (`router.project-osrm.org`, com `routing.openstreetmap.de` como
  segundo servidor) — mesmos dois servidores usados no Streamlit, tentados em sequência; se os
  dois falharem, cai para uma aproximação em linha reta (mesmo fallback do app legado).
- **Geocodificação**: Nominatim (OpenStreetMap), com o `User-Agent` identificado — é o único
  serviço de busca de endereço gratuito e sem chave que os dois apps legados já usavam.
- **Score do posto (0-100, grau A-D)**: porta fiel de `_calcular_score_posto()` do Streamlit —
  50% preço vs. referência, 30% quantidade de serviços (dos 10 campos booleanos de `postos_gf`:
  24h, pista de caminhão, ARLA, conveniência, restaurante, banheiro, estacionamento, troca de
  óleo, internet), 20% distância de um ponto de referência.
- **Algoritmo de sugestão de paradas**: porta fiel de `_otimizar_rota_v3()` — guloso com "olhar
  à frente" (look-ahead), nunca deixa o tanque abaixo de 25% de segurança, só "estica" até um
  posto mais à frente se a métrica composta for pelo menos 5% melhor E o preço pelo menos 3%
  menor, corredor de busca fixo em 5 km ao redor da rota (igual ao Streamlit — no modo "Por
  Rota", sem veículo, o raio é livre).
- Só entram no algoritmo de otimização os postos que já têm preço registrado (`historico_precos`)
  para o combustível exato do veículo — sem preço, não dá pra decidir se compensa parar ali.
- `rotas_salvas.tipo` usa os mesmos valores do Streamlit (`estado`/`rota`/`busca`/
  `roteirizacao`) para as duas ferramentas continuarem lendo os dados uma da outra.
- **Card de detalhe ao clicar num posto no mapa** (todos os 4 modos): razão social, CNPJ,
  cidade/UF, bandeira e o preço vigente de cada combustível (próprio do posto, com destaque, ou
  estimativa ANP em cascata município → estado → Brasil — igual à tela de detalhe do posto).
  Carregado sob demanda no clique (`buscarDetalhePostoParaMapaAcao`), não junto com a lista —
  evita dezenas/centenas de consultas de preço de uma vez só quando o mapa tem muitos postos.
- **Cor do marcador por bandeira/distribuidora** (`src/lib/coresBandeira.ts`): Ipiranga sempre
  amarelo, Shell/Raízen sempre vermelho, Petrobras/BR/Vibra sempre verde — as demais bandeiras
  caem numa paleta secundária por hash estável (mesma bandeira sempre com a mesma cor entre uma
  consulta e outra). Cada mapa (UF/Município, Por Rota, Consulta por Posto, e as paradas
  sugeridas da Roteirização) mostra uma legenda no canto inferior esquerdo, montada dinamicamente
  a partir das bandeiras realmente presentes naquela consulta.

### Bug: taxonomia de combustível inconsistente (Comum/Aditivado colapsados, Roteirização nunca achava preço)

Depois de entregue, apareceram duas variações do mesmo problema:

1. O card do posto no mapa mostrava "ETANOL HIDRATADO" duas vezes com o mesmo preço. Causa: eu
   estava rotulando cada linha pela categoria oficial da ANP (que agrupa "Etanol Comum" e
   "Etanol Aditivado" numa única referência), só que são dois produtos DIFERENTES com preços
   diferentes — o agrupamento é correto só pra comparação com a ANP, não pra exibição. Corrigido
   mostrando o nome real do produto (`combustivelGf`) em vez da categoria, e corrigida também
   uma colisão de `key` do React na tela de detalhe do posto que tinha o mesmo problema
   (`p.categoria` sozinho não é único quando o posto tem Comum e Aditivado do mesmo combustível).
2. Mais sério: a Roteirização (`/roteirizacao/planejar`) nunca encontrava nenhum posto candidato
   pra nenhum veículo real cadastrado. Causa raiz: o campo `combustível` do veículo guarda o
   tipo de motor ("Flex", "Diesel S10"...), não o produto vendido no posto — e o formulário
   copiava esse valor bruto direto pro filtro de preço, que nunca bate com o texto gravado em
   `historico_precos` pela planilha ("Gasolina Comum", "Diesel S-10 Aditivado" etc.). Também
   descobri que o formulário de registrar preço manual em Postos Revendedores usava essa mesma
   lista errada (`CICLOS_COMBUSTIVEL`, pensada pra veículo, não pra produto de posto) — dava pra
   registrar um preço com combustível "Flex", o que não existe. Corrigido com:
   - `PRODUTOS_POSTO` (`src/lib/constants.ts`): lista única dos produtos reais vendidos no posto,
     na mesma granularidade da planilha (Comum/Aditivado separados) — usada agora tanto no
     registro manual de preço quanto no seletor de combustível da Roteirização.
   - `PRODUTOS_POR_TIPO_VEICULO`: de-para do motor do veículo pros produtos compatíveis (ex: um
     Flex pode usar gasolina OU etanol — a tela pede pra escolher qual, em vez de adivinhar).
   - `PRODUTO_PARA_CATEGORIA_ANP` ganhou "Gasolina Alta Octanagem" → GASOLINA ADITIVADA (a ANP
     não pesquisa combustível premium separadamente; é a referência mais próxima disponível) e
     GLP.

Validado com `npm run typecheck` e `eslint` (ambos sem erros). Não consegui rodar `npm run
build` completo neste ambiente — o processo trava sem erro logo após o banner inicial do
Next.js, aparentemente uma limitação do sandbox e não do código (o `next dev` e o `typecheck`
funcionam normalmente). Recomendo rodar `npm run build` localmente antes do deploy para
confirmar.

## Fase 6 — Hardening de segurança (entregue)

Os dois itens de segurança formalmente adiados desde a Fase 5 foram resolvidos:

- **Bypass de admin por e-mail fixo** (~30 tabelas): substituído por `perfil_usuario_atual() =
  'admin'` como condição OR adicional em todas as policies que só reconheciam
  `d.peruffo@gmail.com`. Aplicado via um bloco `DO` dinâmico no Postgres (lê `pg_policies` e
  reescreve cada policy com `ALTER POLICY`), evitando reescrever 34 expressões à mão. Mudança
  puramente aditiva — nenhum acesso existente foi removido.
- **Policies `allow_all_*`** (16 tabelas, incluindo `empresas`, `usuarios_empresas`,
  `historico_precos`, `postos_gf`, `frota_abastecimentos`): davam acesso total
  (`using(true)/with_check(true)`) ao role `public` — ou seja, qualquer requisição, até sem
  login, só com a chave anon, lia/gravava esses dados sem nenhuma restrição de tenant (as
  policies corretas de tenant já existiam nas mesmas tabelas, mas o Postgres soma policies com
  OR, então a `allow_all` anulava a proteção). Antes de remover, investiguei o repositório do
  app Flutter/backend FastAPI (`github.com/dperuffo/estudo-de-rede`) pra não quebrar produção:
  - O app Flutter oficial não toca no Supabase — fala só com o backend FastAPI próprio, via
    JWT emitido pelo backend.
  - O backend FastAPI inteiro (todos os arquivos Python) usa a **service_role key**
    (confirmado por comentário em `test_tenant_isolation.py`), que ignora RLS — as `allow_all_*`
    são irrelevantes pra ele.
  - O único cliente que usava a chave anon direto, sem login, era um PWA solto
    (`mobile/fni-mobile.html`) lendo `postos_gf`. Confirmado com o Daniel que está fora de uso.
  - Removidas as 16 policies `allow_all_*` (+ 3 equivalentes específicas de
    `historico_precos`: `allow_insert/select/update_historico_precos`). As policies de tenant
    (`*_tenant_all`, `empresas_select_membro` etc.) e as de `service_role` continuam de pé e
    passam a ser, agora sim, a única porta de entrada real.

Validado com `npm run typecheck` (sem erros) e conferido `pg_policies` após cada migração.

### Bug: postos_gf.uf gravado com nome do estado em vez de sigla

Depois de importar as 4 planilhas, a tabela "Cobertura por estado" da Inteligência de Rede
mostrava "—" pra todo mundo. Causa: a coluna "UF" de `postos_gf.xlsx` traz o nome completo do
estado ("São Paulo"), não a sigla — meu importador só fazia `.toUpperCase()`, então
`postos_gf.uf` ficou como "SÃO PAULO" enquanto `anp_postos.uf` (e o resto do sistema) usa sigla
("SP"), quebrando todo cruzamento por UF (Inteligência de Rede, filtro de UF em `/postos`,
`resolverPrecosVigentes`). Corrigido com `ESTADO_PARA_UF` (`src/lib/constants.ts`, mapa inverso
de `UF_PARA_ESTADO_ANP`) e `resolverUf()` (`src/lib/utils.ts`) — aceita sigla ou nome completo e
sempre devolve a sigla. Aplicado nos 3 importadores que tocam UF (postos_gf, postos_anp,
preços) e feito backfill dos 2.969 registros de `postos_gf` já gravados (`historico_precos` já
estava certo, não precisou). Confirmado `precos_anp.xlsx` carregou corretamente (2.734 linhas,
5 níveis) — o problema era só esse cruzamento de UF, não a carga da planilha oficial.

### Bug: PostgREST corta em 1000 linhas — Inteligência de Rede calculava com dado parcial

Mesmo depois do fix de UF, só algumas UFs apareciam com "Total ANP" preenchido. Causa raiz
diferente e mais séria: as consultas a `postos_gf` (2.969 linhas), `anp_postos` (35.340) e
`historico_precos` (14.079+) usavam `.select()` simples, sem `.range()`/paginação — o PostgREST
corta em 1.000 linhas por padrão nesse caso. Ou seja, todos os totais, médias e contagens da
tela vinham de uma fatia arbitrária dos dados (não necessariamente distribuída por UF), não do
todo. Corrigido criando 4 funções agregadas no Postgres — `postos_gf_por_uf()`,
`anp_postos_por_uf()`, `postos_gf_municipios_unicos()`, `preco_medio_por_combustivel()` (esta
usa `DISTINCT ON` pra pegar o preço mais recente por posto+combustível direto no banco) — que
devolvem só o resumo já calculado, sem o limite de linhas. Confirmado depois do fix: SP passou
de 381 pra 720 postos (o número real).

## Fase 8 — Centros de Custo e indicadores por centro de custo (entregue)

Pedido do Daniel: "podemos criar o CRUD de Centro de Custos e alocacao dos veiculos do
cliente no centro de custo. Trazer indicadores de desempenho no dasboard para
abastecimentos, manutençoes e etc dos veiculos nos centros de custos".

### Descoberta: tabela histórica já existia no banco, sem nenhum app usando

Antes de desenhar o CRUD, investiguei o schema compartilhado e achei `centros_custo_veiculos`
— uma tabela de histórico de alocação (placa, centro_custo_id, data_inicio, data_fim,
ativo) já criada no banco, mas **sem nenhuma policy de RLS** (inacessível a qualquer client
autenticado) e **sem nenhum app consumindo ela** (confirmado via grep no repo do backend
FastAPI, no app Flutter e no Streamlit — nenhum dos três usa essa tabela). Perguntei ao
Daniel se preferia (a) um modelo simples, só com `cadastro_veiculos.centro_custo_id` como
"alocação atual", ou (b) adotar essa tabela como histórico completo. Ele escolheu adotar o
histórico. Decisão: `centros_custo_veiculos` vira o sistema de registro da alocação
(reconstrói "onde esse veículo esteve" em qualquer data passada); `cadastro_veiculos.
centro_custo_id`/`centro_custo_nome` continuam existindo, mas agora como **cache
denormalizado da alocação vigente**, sincronizado automaticamente a cada mudança — nenhuma
tela lê/escreve neles diretamente, tudo passa por `alocarVeiculoCentroCusto()`
(`src/lib/centroCusto.ts`), que fecha a alocação anterior (`data_fim = hoje`, `ativo =
false`) e abre uma nova, em vez de sobrescrever.

### Bug de visibilidade multi-tenant encontrado e corrigido

`centros_custo`, `centros_custo_veiculos` e `manutencoes_realizadas` tinham **100% das linhas
com `empresa_id = NULL`** — foram seedadas via o modelo de tenant mais antigo do backend
FastAPI (`cnpj_frota`, texto), não o modelo `empresa_id` (uuid) que este app usa. Como as
policies de RLS dessas 3 tabelas não têm fallback pra `empresa_id IS NULL` (diferente de
`postos_gf`, por exemplo, que tem de propósito), isso as tornava **invisíveis pra qualquer
usuário não-admin**. Corrigido com uma migration de backfill que casa `cnpj_frota`
(normalizado) com `empresas.cnpj` (também normalizado) — confirmado 0 linhas nulas
remanescentes nas 3 tabelas depois. Também criei as policies de RLS que faltavam em
`centros_custo_veiculos` (`centros_custo_veiculos_membro`/`_service_total`, mesmo padrão das
demais tabelas do projeto).

### CRUD de Centros de Custo (`/centros-custo`)

Segue a mesma estrutura de Grupo Econômico: lista com seletor de cliente + cards de
indicador + tabela (`/centros-custo`), formulário de criação (`/centros-custo/novo`) e
edição com sub-seção de alocação de veículos (`/centros-custo/[id]`). A tela de edição
mostra os veículos atualmente alocados (com botão "Remover"), um seletor pra alocar um novo
veículo (mostrando se ele já está em outro centro de custo) e um histórico completo de
alocações (expansível), tudo via `centros_custo_veiculos`.

`VeiculoForm`/`veiculos/actions.ts` também foram atualizados: criar ou editar um veículo e
escolher um centro de custo agora passa por `alocarVeiculoCentroCusto()` (gera uma linha de
histórico), em vez de escrever `centro_custo_id` direto em `cadastro_veiculos` como fazia
antes.

### RPC de indicadores (`indicadores_centro_custo`)

Função SQL `security invoker` (assim a RLS do usuário chamador vale normalmente, mesmo
padrão de `postos_gf_por_uf`/`preco_medio_por_combustivel`) que recebe `empresa_id` + período
(`data_inicio`/`data_fim`) e devolve, por centro de custo: quantidade de veículos alocados
(alocação atual), custo de abastecimento, litros abastecidos, custo de manutenção, km
rodado, custo total por km e consumo médio (km/l).

O ponto mais delicado foi a **atribuição histórica**: nem `profrotas_abastecimentos` nem
`manutencoes_realizadas` têm uma coluna de centro de custo — cada transação é ligada à placa
do veículo, então pra saber a qual centro de custo ela pertence, a função faz `JOIN` com
`centros_custo_veiculos` casando a placa **e** a data da transação dentro do intervalo
`[data_inicio, data_fim)` da alocação. Isso significa que um abastecimento feito quando o
veículo estava no centro de custo "SP" continua contando pro "SP" mesmo que o veículo tenha
sido remanejado depois — histórico correto, não só o snapshot atual.

Km rodado é estimado por `max(hodometro) - min(hodometro)` dos abastecimentos de cada placa
dentro do período (limitação conhecida: com só 1 abastecimento no período o km rodado fica
zerado pra aquele veículo, já que não há 2 leituras de hodômetro pra subtrair — os dados de
teste atuais têm bastante disso, por isso vários centros de custo aparecem com `custo_por_km`/
`consumo_medio` nulos no ambiente de teste). Consumo médio é a média ponderada
(km rodado total / litros totais do centro de custo), não a média simples dos consumos por
veículo.

### Seção "Desempenho por centro de custo" no Dashboard

Adicionada ao final de `/dashboard`: seletor de cliente + seletor de período (30/90/180/365
dias) chamando a RPC acima, com cards de totais (veículos, custo de abastecimento, custo de
manutenção) e uma tabela por centro de custo (linkando pro respectivo `/centros-custo/[id]`).

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros.

## Fase 9 — Manutenção Preditiva (entregue)

Pedido do Daniel: sugerir ao usuário paradas de manutenção com base em desempenho, consumo,
depreciação etc., verificando antes como outras soluções (e as ferramentas já existentes do
próprio ecossistema) fazem isso — com atenção especial a usabilidade para clientes com **mais
de 1.000 veículos** na frota.

### O que já existia (investigado antes de desenhar)

Encontrei duas implementações de manutenção preditiva já existentes, com propósitos diferentes:

1. **Ferramenta interna em Streamlit** (`estudo_de_rede.py`, aba "🔧 Manutenção Preditiva") —
   um motor de análise rico, não usado por clientes finais: 8 componentes (óleo, pneus,
   filtros, lubrificação, alinhamento, arrefecimento, ruídos, revisão geral), cada um com
   intervalo em km (diferente pra veículo leve/pesado), um score 0-100 ponderado por
   componente, ajustado pela degradação de consumo (calculada comparando o km/L do início x
   fim do histórico de abastecimentos) e pela idade do veículo. Quando existe um registro real
   de manutenção pro componente, ele substitui a estimativa — senão, a estimativa usa "km
   rodado desde a última volta do intervalo" (`km_atual % intervalo`).
2. **Endpoint `/manutencao/status-frota` do backend FastAPI + tela no app Flutter de
   produção** — já em uso por clientes reais hoje: uma regra mais simples, status único por
   veículo (não por componente) baseado em km/dias desde a ÚLTIMA manutenção de qualquer tipo,
   mais uma checagem de "itens mínimos" (óleo e freios).

Escolhi portar o modelo mais rico do Streamlit (o Daniel confirmou, ao ser perguntado, que
prefere manter os intervalos fixos como estão lá, em vez de configuráveis por cliente nesta
fase) — ele dá muito mais informação acionável por veículo (qual componente exatamente está
vencendo, não só "manutenção atrasada"), o que se encaixa melhor com "usabilidade top" pedida
para frotas grandes: dá pra ordenar 1.000 veículos por score e já saber exatamente que
componente olhar em cada um.

### Achado durante a investigação: vocabulário de itens de manutenção não é único

Os 16 itens do formulário de manutenção do Flutter (`Troca de óleo e filtro`, `Revisão de
freios`, `Alinhamento e balanceamento` etc.) não batem exatamente com os 8 componentes do
motor de score, nem com o texto livre que já está gravado em produção (`itens_realizados`),
que por sua vez tem rótulos ainda diferentes (`"Troca de Óleo"`, `"Filtros —
ar/combustível/óleo"`, `"Alinhamento e Balanceamento"` etc.). Em vez de casamento por
igualdade exata (que ia deixar "fonte=real" praticamente inútil pros dados já existentes), o
casamento é por **palavra-chave, com acento e maiúscula normalizados** (`translate()` +
`lower()` + `ilike`) — ex: qualquer item contendo "oleo" conta pro componente "óleo". Validado
manualmente contra os 11 registros reais de manutenção já no banco: bateu certinho pros 6
componentes com correspondência óbvia (óleo, pneus, filtros, alinhamento, arrefecimento,
revisão); os 2 sem correspondência hoje (lubrificação geral, monitoramento de ruídos) ficam
como "estimado" — o que é honesto, já que ninguém registra especificamente esses dois hoje.

### Arquitetura pensada para frotas de 1.000+ veículos

Todo o cálculo pesado (janelas de consumo por par de abastecimentos, junção com histórico de
manutenção, ponderação por componente) roda no Postgres, não no Next.js nem no navegador — 3
funções SQL `security invoker`:

- `manutencao_preditiva_base(empresa, placa?)` — motor: uma linha por (veículo, componente).
  Com `placa` informado, escopo cai pra 1 veículo só (usado pela tela de detalhe); sem
  `placa`, roda pra frota inteira (usado pelas duas funções abaixo).
- `manutencao_preditiva_resumo(empresa, centroCusto?, busca?, status?, ordenar?, limit,
  offset)` — agrega por veículo (score geral, status) e já devolve a página pronta
  (filtro/ordenação/paginação todos no banco, com `total_count` via `count(*) over()` pra
  paginar sem 2ª consulta).
- `manutencao_preditiva_kpis(empresa, centroCusto?, busca?)` — indicadores agregados (total,
  críticos, alertas, ok, score médio) **sempre em 1 linha**, ignorando o filtro de status de
  propósito (senão os cards de indicador zerariam quando a lista filtrada por "Crítico"
  estivesse vazia).

A tela de lista (`/manutencao-preditiva`) é uma tabela paginada (50 por página, via
`searchParams` + `.range()` no banco, sem carregar a frota inteira no cliente) com busca,
filtro por centro de custo/status e ordenação — nada de scroll infinito ou grid de cards por
veículo (o que a ferramenta em Streamlit faz, mas não escala pra 1.000+). A tela de detalhe
(`/manutencao-preditiva/[placa]`) só busca o necessário daquele veículo (via o parâmetro
`p_placa`), com o breakdown por componente, recomendações geradas a partir do resultado
(mesma lógica de `_mp_analisar_veiculo()` do Streamlit, portada em
`gerarRecomendacoes()` em `src/lib/manutencaoPreditiva.ts`), formulário de registro de
manutenção e histórico.

Custo aceito conscientemente: a tela de lista faz 2 chamadas RPC (resumo + kpis), cada uma
rodando o motor (`manutencao_preditiva_base`) uma vez — não há cache/materialização entre
elas nesta fase. Para frotas muito grandes, se isso se tornar um gargalo real, o próximo passo
seria uma tabela materializada atualizada por trigger/cron em vez de recalcular a cada
carregamento de página.

### Registro de manutenção — mesma tabela e vocabulário do Flutter

O formulário "Registrar Manutenção" (na tela de detalhe) grava na mesma tabela
`manutencoes_realizadas` já usada pelo backend/Flutter, com os mesmos 16 itens do checklist de
produção (`ITENS_MANUTENCAO` em `src/lib/manutencaoPreditiva.ts`) — histórico de manutenções
fica visível e editável nos dois apps.

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros.

## Fase 10 — Indicadores avançados no Dashboard (entregue)

Pedido do Daniel: 7 novos painéis no Dashboard — variação de preços (rede do cliente x ANP),
previsão de consumo com projeção calibrada, evolução do preço médio por litro, evolutivo de
volume nos Top 5 postos, ranking dos Top 5 postos por volume, ranking de veículos por gasto e
ranking de motoristas por gasto — todos dentro de um período (normalmente o mês). Também
corrigido: login (Google + MFA) caía em `/clientes` em vez de `/dashboard`.

### Gráfico mais aderente para cada indicador

Antes de implementar, decidi o tipo de gráfico mais adequado pra cada indicador (compartilhado
com o Daniel antes de começar):

- **Variação de preços**: não é série temporal, é comparação de dispersão — barra agrupada
  (preço médio do cliente x preço médio ANP) por combustível, com tabela de mín/máx/desvio
  padrão/coeficiente de variação abaixo (a barra sozinha perderia precisão nos números exatos).
- **Previsão de consumo**: barra (pedido explicitamente), com cor diferente pros dias já
  ocorridos e pros dias projetados.
- **Evolução do preço médio**: linha — tendência contínua ao longo de ~30 pontos diários.
- **Evolutivo de volume — Top 5 postos**: múltiplas linhas (1 por posto) — comparar a
  trajetória de 5 categorias ao longo do tempo com barras ficaria poluído.
- **Top 5 postos por volume / Ranking de veículos / Ranking de motoristas**: barra horizontal
  — ranking de poucos itens com rótulos longos (nome de posto, placa+modelo, nome completo).
  Para os rankings de veículos e motoristas, a barra mostra só o Top 10 (frotas de 1.000+
  veículos não cabem num gráfico) — a tabela completa abaixo mostra os 10 carregados com
  detalhe (litros, quantidade de abastecimentos); a função SQL já suporta paginação
  (`p_limit`/`p_offset`) pra evoluir pra uma lista completa depois, se for pedido.

### RPCs criadas (todas `security invoker`)

- `indicador_variacao_precos(empresa, ini, fim)` — por produto real (não a categoria agrupada
  da ANP): mín/méd/máx/desvio padrão/coeficiente de variação pago pelo cliente, e a mesma
  métrica vinda de `anp_precos_referencia` no nível estado (UF mais frequente entre os
  abastecimentos daquele produto no período — calculado no banco via `row_number()`), caindo
  pra nível Brasil se não achar publicação ANP pro estado no período.
- `indicador_consumo_diario(empresa, ini, fim)` — litros e valor por dia. Alimenta tanto a
  previsão de consumo quanto a evolução do preço médio (preço do dia = valor do dia / litros
  do dia, calculado no app a partir da mesma série — não precisou de uma função separada).
- `indicador_padrao_dia_semana(empresa, lookback=90)` — média de litros por dia da semana
  (domingo a sábado) numa janela de 90 dias, incluindo dias sem nenhum abastecimento como 0
  (via `generate_series`) pra não superestimar dias tipicamente parados (fins de semana).
- `indicador_volume_postos(empresa, ini, fim)` — volume diário só dos 5 postos de maior volume
  total no período (o "Top 5" já sai calculado do banco); alimenta os indicadores 4 e 5 juntos.
- `indicador_ranking_veiculos` / `indicador_ranking_motoristas(empresa, ini, fim, limit,
  offset)` — ranking por gasto total, paginado, com `total_count` via `count(*) over()`.

### Previsão de consumo — como a calibração por dia da semana funciona

Em vez de projetar os dias restantes do mês com uma média linear simples (que erraria muito se,
por exemplo, o mês já tivesse passado majoritariamente por fins de semana, ou o contrário),
a projeção usa um fator multiplicativo por dia da semana: `fator[dia] = média histórica
daquele dia da semana (90 dias) / média geral de todos os dias da semana`. Uma "taxa-base"
diária é calibrada a partir dos dias já ocorridos no mês (dividindo o total real pela soma dos
fatores desses mesmos dias — não pela contagem simples de dias), e cada dia futuro recebe
`base × fator[dia da semana daquele dia]`. É um ajuste de sazonalidade por método dos momentos
— simples de auditar (dá pra conferir a conta na mão) e already validado nos dados de teste:
domingo/sábado saíram com médias de ~10-12 L/dia contra ~30-65 L/dia nos dias úteis, então a
calibração faz diferença real na projeção. Implementado em `src/lib/previsaoConsumo.ts`
(`calcularPrevisaoConsumo`), puro e testável, separado da página.

### Correção: login caindo em `/clientes` em vez de `/dashboard`

`src/app/auth/callback/route.ts` tinha `next ?? "/clientes"` como destino padrão pós-OAuth
(fallback de quando nenhum `?next=` é passado — e o botão "Entrar com Google" nunca passava
esse parâmetro), e `src/app/mfa-setup/page.tsx` também mandava pra `/clientes` depois de
verificar o código MFA. Os dois agora apontam pra `/dashboard`, que já era a tela pretendida
como ponto de entrada do app.

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros.

## Correções pós-Fase 10

### Select de "Produto" vazio na tela de detalhe de Abastecimento

Reportado pelo Daniel: a tela de detalhe de um abastecimento não mostrava o combustível
selecionado (a lista mostrava certo). Causa: `AbastecimentoForm.tsx` populava o `<select
name="item_nome">` com `CICLOS_COMBUSTIVEL` (lista do tipo de MOTOR do veículo — "Diesel S10",
"Gasolina", "Etanol"...), mas o valor salvo em `item_nome` vem no vocabulário de produto de
posto ("Diesel S-10 Aditivado", "Gasolina Comum", "Etanol Comum"...). Como nenhuma `<option>`
batia com o `defaultValue`, o navegador não selecionava nada — mesmo o dado estando correto no
banco (por isso a lista, que só exibe texto puro sem select, mostrava certo). É o mesmo padrão
de bug já corrigido antes em `RegistrarPrecoForm.tsx`. Corrigido trocando para
`PRODUTOS_POSTO` (lista certa, já documentada em `constants.ts` como "a lista que deve
aparecer em qualquer seletor de qual combustível"), com uma opção extra de segurança: se algum
registro tiver um valor fora da lista, ele ainda aparece selecionado em vez de sumir de novo.

### Barra de referência ANP não aparecia no painel "Variação de preços"

Reportado pelo Daniel: a comparação com o preço ANP não aparecia (nem a barra cinza, nem
"ANP médio"/"Fonte ANP" na tabela). Causa: `indicador_variacao_precos` exigia que a data do
snapshot ANP (`data_inicial`/`data_final` de `anp_precos_referencia`) sobrepusesse o período
exato selecionado no indicador (mês corrente por padrão). Como a base de referência ANP hoje só
tem um levantamento carregado (semana de 07 a 13/06), qualquer período fora dessa semana (como
o mês corrente, em julho) não achava nenhuma linha e a comparação inteira desaparecia. Corrigido
pra usar o critério de "preço vigente" já estabelecido em `resolverPrecosVigentes` (tela de
detalhe do posto): em vez de exigir sobreposição de datas, pega o levantamento ANP mais recente
publicado até o fim do período (e, se não houver nenhum antes, o mais recente disponível em
qualquer data) — a ANP publica por levantamento periódico, então a comparação sempre deve usar a
referência oficial mais atual conhecida, não ficar vazia fora de uma janela estreita. A função
agora também retorna `anp_data_referencia`, exibido na coluna "Fonte ANP" (ex: "Estado (SP) ·
ref. 13/06") pra deixar claro que a comparação pode não ser da mesma semana do período do
indicador.

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros, e a
função testada diretamente no banco com dados reais antes e depois da correção.

### Seletor único de cliente + período no topo do Dashboard

Reportado pelo Daniel: antes, cliente e período apareciam em dois seletores diferentes e
soltos (um em dias, dentro da seção "Desempenho por centro de custo"; outro em mês, dentro de
"Indicadores avançados"), cada um recarregando só a sua própria seção. Pedido: uma única seleção
no topo da página, direcionando todos os indicadores por cliente.

Decisão tomada com o Daniel: como o indicador "2. Previsão de consumo" projeta os dias restantes
até o fim do mês (recurso pedido e validado na Fase 10), um período do tipo "últimos N dias"
(que por definição sempre termina hoje) não tem dias futuros para prever. Optamos por unificar
usando o seletor por **mês** (o mesmo que já existia em Indicadores Avançados) em vez do
seletor por dias corridos — assim a projeção continua funcionando exatamente como antes quando
o mês selecionado é o atual, sem precisar de um caso especial. O seletor por dias corridos foi
removido.

Implementado como um único formulário (`empresa` + `mesAno`) logo abaixo do título da página,
que os indicadores "Desempenho por centro de custo", "Manutenção preditiva" (só o cliente; ela
não depende de período) e "Indicadores avançados" (todos os 7 painéis) passam a compartilhar —
removidos os dois formulários duplicados que existiam dentro de cada seção.

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros.

### Erro ao criar Grupo Econômico: record "old" has no field "empresa_id"

Reportado pelo Daniel: não era possível salvar um novo Grupo Econômico — erro
`record "old" has no field "empresa_id"`. Causa: `grupos_economicos` é agrupador de várias
empresas (a relação é `empresas.grupo_economico_id`, não o inverso), então a tabela não tem
coluna `empresa_id`. O trigger genérico de auditoria `fn_audit_log()` (compartilhado entre
várias tabelas — grava em `audit_logs` a cada INSERT/UPDATE/DELETE) acessava
`NEW.empresa_id`/`OLD.empresa_id` direto num `CASE WHEN TG_OP = 'DELETE' THEN OLD.empresa_id
ELSE NEW.empresa_id END`. Isso quebra mesmo na criação (INSERT, que só entra no branch `ELSE`),
porque o Postgres resolve nomes de campo de `record` (`OLD`/`NEW`) no parse da expressão
inteira, não só na hora de avaliar o branch que de fato executa — então `OLD.empresa_id`
precisa existir no tipo da linha mesmo sem ser usado. Corrigido trocando o acesso direto por
extração via `to_jsonb(NEW) ->> 'empresa_id'` (e o mesmo para `OLD`), que devolve `NULL` em vez
de erro quando a coluna não existe — mantém o comportamento idêntico nas tabelas que têm
`empresa_id` e passa a funcionar nas que não têm (hoje só `grupos_economicos`, conferido
consultando todas as tabelas com esse trigger). Testado com um INSERT real em
`grupos_economicos` dentro de uma transação com rollback, antes só no banco.

### Erro ao vincular empresa ao grupo: RLS bloqueando grupos_economicos_empresas

Reportado pelo Daniel, logo após a correção acima: `new row violates row-level security policy
for table "grupos_economicos_empresas"`. Causa: essa tabela de junção (liga uma empresa a um
grupo econômico) só tinha policy de leitura (`gee_membro_select`) para o papel `authenticated`
— nenhuma de escrita (INSERT/UPDATE/DELETE), só para `service_role`. Sem nenhuma policy que
libere a escrita, o RLS bloqueia por padrão (nega tudo que nenhuma policy permite
explicitamente), então vincular/desvincular uma empresa nunca funcionou pelo app fora do
`service_role`. Corrigido criando a policy `gee_admin_escreve`, espelhando exatamente a mesma
regra já usada em `grupos_economicos` (só admin ou `d.peruffo@gmail.com` podem escrever — vincular
é uma ação administrativa, como criar o grupo em si).

## Fase 11 — Integrações API (conectar mais clientes via PróFrotas)

Pedido do Daniel: "conectar mais clientes na aplicação" — portar pro Next.js a tela que já
existia no protótipo Streamlit (aba **⚡ API & Integrações → 🔌 GestãoFrotas**), que permite
cadastrar a chave de acesso de um cliente na API da PróFrotas e trazer os abastecimentos dele
automaticamente, sem lançamento manual.

### O que já existia no banco (nenhuma tabela nova precisou ser criada)

O Supabase é compartilhado entre este app e o protótipo Streamlit — as tabelas
`profrotas_api_keys` (chaves cadastradas) e `profrotas_abastecimentos` (dados sincronizados,
já usada em todas as telas de abastecimento deste app) já existiam, com RLS multi-tenant já
correto (`profrotas_api_keys_tenant_all`: cliente só vê/edita a própria chave, admin vê todas).
Só faltava a tela.

Uma diferença encontrada entre o desenho original e o banco real: o Streamlit tentava upsert
por uma coluna `sync_key` que nunca teve constraint UNIQUE em produção (só existia como
fallback silencioso — a constraint real é `UNIQUE (cnpj_frota, identificador, item_id)`). O
código novo já upserta direto pela constraint real, sem a tentativa extra que sempre falhava.

Também faltava em `profrotas_api_keys` o mesmo trigger que `profrotas_abastecimentos` já tinha
para preencher `empresa_id` a partir do `cnpj_frota` (via `empresa_id_do_cnpj`) — sem isso, uma
chave cadastrada por um usuário não-admin ficaria com `empresa_id` nulo e o RLS bloquearia (mesma
classe de bug já corrigida em `grupos_economicos_empresas`). Corrigido reaproveitando a função
existente `trg_preencher_empresa_id_profrotas()` numa nova trigger na tabela de chaves.

### Tela `/integracoes`

Formulário de cadastro (CNPJ da frota, nome da empresa, token JWT obtido no portal da
PróFrotas) com botão "Validar" (faz uma chamada de teste na API antes de salvar) — o servidor
também valida que o CNPJ corresponde a um cliente já cadastrado em `/clientes` antes de gravar,
com mensagem clara em vez de deixar a chave órfã (sem `empresa_id`, invisível pro próprio
cliente). Lista as chaves cadastradas com último sync, total de registros, e ações de
sincronizar agora / ativar-desativar / remover.

Não foi replicada a aba de visualização "📊 Abastecimentos Sincronizados" do Streamlit — os
dados aparecem em `/abastecimentos`, que já existe neste app e lê a mesma tabela.

### `src/lib/profrotas.ts` — porta da lógica de sincronização

Mesma API externa (`api-portal.profrotas.com.br`), mesmo mapeamento de campos (um registro de
abastecimento pode ter vários itens/produtos — cada item vira uma linha em
`profrotas_abastecimentos`), mesma paginação e retry em 429 (espera progressiva 5s/15s/30s), e
mesmo cuidado do original com tipos: colunas `integer` no Postgres (`abastecimento_estornado`,
`status_autorizacao`, etc.) não aceitam booleano nem string — convertidas explicitamente.

### Sincronização automática agendada — por que não é igual ao Streamlit

O Streamlit mantinha uma thread em background por cliente, rodando de hora em hora dentro do
próprio processo do servidor. Next.js em produção normalmente roda serverless (sem processo
persistente), então esse desenho não se aplica. Decisão tomada com o Daniel: replicar o
"automático" com uma rota (`/api/cron/sync-profrotas`) que sincroniza todas as chaves ativas de
uma vez, disparada de fora por um agendador — mesmo resultado final (sync sem intervenção
manual), mecanismo diferente por natureza da plataforma.

A rota é protegida por `CRON_SECRET` (`Authorization: Bearer <segredo>`) e usa o client de
service role (sem sessão de usuário — não tem como usar RLS aqui). Reprocessa com 2h de
sobreposição desde o último sync bem-sucedido (ou as últimas 4h, no primeiro sync), mesmo
critério do worker original — duplicata não é problema porque o upsert é idempotente.

Incluído `vercel.json` com schedule horário (`0 * * * *`), pronto se o deploy for na Vercel —
mas cron de intervalo menor que 1x/dia exige plano pago da Vercel (Hobby só permite diário). Pra
qualquer outro host, ou pra rodar de fato de hora em hora no plano gratuito, aponte um agendador
externo (cron-job.org, GitHub Actions com `schedule`, ou `pg_cron` do próprio Supabase chamando a
URL via `net.http_post`) pra fazer `POST` nessa rota com o header `Authorization: Bearer
<CRON_SECRET>`.

Validado com `npx tsc --noEmit` e `npx eslint src` (projeto inteiro) — ambos sem erros.

## Correções: importação de postos_gf e historico_precos bloqueada por RLS

Reportado pelo Daniel: importar `postos_gf.xlsx` falhava com `new row violates row-level
security policy (USING expression) for table "postos_gf"` e importar `preco_posto.xlsx`
falhava com o mesmo tipo de erro em `historico_precos` — nos dois casos, "linhas já gravadas
até aqui foram mantidas" (o lote de 500 linhas aborta inteiro no primeiro erro).

### `postos_gf` — conflito real de dono, não bug de policy

`postos_gf` tem **uma única linha global por CNPJ** (chave primária é o `cnpj`, não
`cnpj + empresa_id`) — cada posto físico existe uma vez só no banco, com `empresa_id` marcando
qual cliente "ativou" aquele posto na própria rede hoje. A policy de RLS permite tocar numa
linha com `empresa_id IS NULL` (posto ainda não reivindicado por ninguém) ou do próprio cliente,
mas **recusa de propósito** atualizar uma linha já reivindicada por OUTRO cliente — isso evita
que a planilha de um cliente reatribua silenciosamente um posto que já pertence a outro. O erro
citava "(USING expression)" porque é exatamente esse caminho (UPDATE de uma linha já existente)
que a policy bloqueia.

Ou seja: não era uma policy faltando (como nos dois bugs de Grupo Econômico), era a proteção
funcionando — só que quebrando o lote inteiro em vez de avisar e seguir em frente. Corrigido em
`src/app/(dashboard)/postos/importar/actions.ts`: antes de gravar, busca quem já é dono de cada
CNPJ da planilha, separa os que pertencem a outro cliente, pula essas linhas (sem tentar
escrever — não gera mais erro de RLS) e devolve a contagem de "conflitantes" no resultado.
`ImportForm.tsx` mostra esse número junto com sucesso/erro/duplicadas.

### `historico_precos` — importação é cross-tenant por natureza

Essa tela (`/postos/importar-precos`) não tem seletor de cliente: uma única planilha da
integração Pró-Frotas traz preços de postos de vários clientes ao mesmo tempo, e boa parte dos
CNPJs nem pertence a nenhum cliente ainda — o código já casava `empresa_id` automaticamente
olhando `postos_gf`, mas deixava `null` quando não achava dono, de propósito. A policy de RLS
(mesmo padrão tenant-a-tenant das outras tabelas) recusa `INSERT`/`UPDATE` com `empresa_id`
nulo para o papel `authenticated`, então basicamente toda a planilha falhava, não só as
conflitantes — daí o erro genérico (sem "USING expression") logo na primeira linha.

Diferente do caso de `postos_gf`, aqui não existe "dono a proteger" para decidir — é uma carga
administrativa que varre o mercado inteiro. Corrigido trocando o client usado em
`src/app/(dashboard)/postos/importar-precos/actions.ts` de `createClient()` (client de sessão,
sujeito a RLS) para `createAdminClient()` (chave de service role, ignora RLS por completo) —
mesmo padrão já usado para convite de usuários em `src/lib/supabase/admin.ts`. Depende da env
var `SUPABASE_SERVICE_ROLE_KEY` já estar configurada no ambiente de produção (já é, pois o
convite de usuários já usa).

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos alterados — sem erros.

## Grupo Econômico agora expande acesso entre as empresas do grupo

Reportado pelo Daniel: o conceito de Grupo Econômico deveria ser que usuários de empresas do
mesmo grupo consigam ver e mexer (incluir, editar, consultar) nos dados de TODAS as empresas do
grupo, não só da própria. Verificado: não era esse o comportamento — Grupo Econômico era só um
rótulo organizacional, sem efeito nenhum sobre acesso a dado. Confirmado consultando `pg_policies`
diretamente: nenhuma política de segurança de nenhuma tabela operacional (postos, veículos,
abastecimentos, centros de custo, manutenções etc.) referenciava `grupos_economicos_empresas` —
só as próprias telas de administração do grupo liam essa tabela.

Toda a autorização do app (~30 tabelas) depende de uma única função no banco,
`empresas_do_usuario(email)`, que devolve a lista de `empresa_id` que aquele e-mail pode acessar
— usada tanto no `USING`/`WITH CHECK` do RLS quanto no seletor de cliente (`resolverEmpresaAtual`).
Antes, ela só olhava o vínculo direto em `usuarios_empresas`. Corrigido expandindo a função para
também incluir, via `UNION`, qualquer empresa do mesmo grupo econômico de uma empresa vinculada
diretamente ao usuário (checando que o grupo esteja `ativo`). Como é um ponto único usado em toda
a aplicação, a mudança propaga automaticamente: seletor de cliente, leitura e escrita em todas as
telas — sem precisar alterar cada módulo individualmente.

Testado direto no banco: `select empresas_do_usuario('daniel.peruffo.app@gmail.com')` — usuário
vinculado só a uma empresa ("Transportes de Cargas Testes Ltda"), que está no mesmo grupo
("Grupo Frotas") de outra ("Integra Frotas Ltda") — passou a devolver as duas, antes devolvia só
uma. Rodado `get_advisors` (segurança) depois da migração: nenhum alerta novo, só os pré-existentes
(não relacionados a esta mudança).

## Fase 12 — Inteligência de Rede: painéis executivos, mapa e evolução mensal

Pedido do Daniel: "quero incrementar a visão de inteligência de rede" com Mapa de Densidade,
Top 10 Municípios e um painel Executivo (KPIs de postos/municípios/diesel médio/saving
potencial). Confirmado com o Daniel que todos esses painéis vêm da aba "Dashboard" do Streamlit
de referência (`estudo_de_rede.py`), então portados fielmente de lá.

### RPCs novas (todas `stable`, sem `security definer` — mesma convenção das demais agregações)

- `postos_gf_top_municipios(p_limit)`: top N municípios com mais postos GF (`group by
  municipio, uf`).
- `postos_gf_pontos_mapa()`: `cnpj, razao_social, municipio, uf, lat, lon` de todo posto com
  coordenada — via RPC, não `.select()` direto, porque a tabela já passa de 1.000 linhas
  (PostgREST corta nesse limite por padrão em endpoint de tabela, mesma causa raiz já corrigida
  antes nesta tela — ver "Bug: PostgREST corta em 1000 linhas" acima).
- `historico_precos_evolucao_mensal()`: preço médio por `(mês, combustível)` — a série mensal já
  existe naturalmente no histórico, porque cada reenvio periódico da planilha de preços grava
  linhas novas com `data_ref` diferente.

### Painel "📊 Visão Geral da Rede"

4 cards: Postos GF (+ nº de estados), Municípios (+ % dos estados cobertos), Diesel Médio GF (com
delta vs ANP) e Saving Potencial/Ano. O "Diesel Médio GF" combina as variantes (S-10/S-500,
comum/aditivado) numa média ponderada pela quantidade de postos de cada variante — não uma média
simples entre elas, senão uma variante com poucos postos pesaria igual a uma com muitos. Saving
potencial: se há preço real de diesel e a rede está abaixo do ANP, projeta a economia real
(diferença × 100 L/semana × 52 semanas × total de postos); sem dado de preço, cai numa estimativa
conservadora de 15% — mesmo critério do Streamlit.

### Painel "💰 Saving Mensal Acumulado"

Evolução mensal do preço médio GF com seletor de combustível ("Todos" ou um específico). Com
"Todos" selecionado as barras ficam azuis (não há uma única referência ANP que sirva pra mistura
de combustíveis); com um combustível específico, as barras ficam verdes (abaixo do ANP, saving)
ou vermelhas (acima do ANP, custo extra), com linha tracejada mostrando a referência e o saldo
acumulado do período em R$/L.

### Painel "🗺️ Mapa de Densidade"

Em vez de um heatmap dedicado (sem lib instalada pra isso) ou milhares de ícones de marcador
(pesado com quase 3 mil postos), usa `CircleMarker` do Leaflet — pontos pequenos e semitransparentes
que se sobrepõem visualmente onde a rede é mais densa, mesmo efeito do `Scattermapbox` com opacidade
usado no Streamlit. Componente lazy (`ssr: false`) igual ao mapa de Roteirização, pelo mesmo motivo
(Leaflet manipula `window` direto).

### Painel "⛽ Custo Médio GF vs ANP por Combustível"

Gráfico de barras agrupadas (preço médio GF x referência ANP) inserido dentro do card já existente
de "Preço médio da rede vs referência ANP", acima da tabela — mesma fonte de dados, só uma
visualização a mais.

Validado com `npx tsc --noEmit` e `npx eslint` — sem erros (um erro de regra
`react-hooks/rules-of-hooks` foi pego e corrigido: o `useMemo` da série mensal estava depois de
um `return` condicional).

## Fase 13 — Inteligência de Rede: porte completo do dashboard de referência

O usuário pediu para portar "tudo" que fizesse sentido do restante das abas do Streamlit de
referência (`estudo_de_rede.py`) para dentro da Inteligência de Rede, com a ressalva de que
`rotas_salvas` nesta aplicação é roteirização **planejada/sugerida** pelo próprio otimizador,
**não** trajetória GPS real — então qualquer painel que dependesse disso precisava ser adaptado
ou explicitamente marcado. A tela ganhou abas novas (usando o `AbasPainel` já existente) até somar
9 abas: Preços vs ANP, Alertas de Preço, Modo Comparativo, Macrorregião & Expansão, Mapa &
Municípios, Cobertura × Demanda, Cruzamentos Avançados, Operacional, Tendência & Sazonalidade e
Evolução Temporal.

### Painel "⚠️ Alertas de Preço"

RPC `postos_gf_alertas_preco(p_threshold)`: resolve a referência ANP de cada posto+combustível em
3 níveis (município → estado → Brasil, via CTEs `ref_municipio`/`ref_estado`/`ref_brasil`, sempre
pegando o registro mais recente) e sinaliza quando o preço da rede está mais de X% acima. Precisou
de duas correções de dados no caminho: criar `uf_para_estado_anp(sigla)` (o `postos_gf.uf` guarda
a sigla de 2 letras, não o nome do estado como uma nota de sessão anterior sugeria — confirmado
direto no banco) e `normalizar_texto_anp(texto)` (extensão `unaccent` + maiúsculas + espaços
colapsados) pra bater com o formato de `anp_precos_referencia.municipio`.

### Painel "📐 Cobertura por Macrorregião" + "🎯 Top Oportunidades de Expansão"

Cobertura: % dos municípios de cada uma das 5 macrorregiões (tabela fixa de UF→região, IBGE) que
já têm pelo menos 1 posto GF, contra o total de municípios da região (também fixo, IBGE).
Oportunidades: score = `(1 − penetração_gf/100) × (diesel_anp_uf / diesel_anp_max) × 100` — quanto
menor a penetração da rede e mais caro o diesel de mercado naquele estado, maior a prioridade de
expansão.

### Painel "⚖️ Modo Comparativo"

Compara dois estados ou duas regiões lado a lado (postos, cobertura, distribuidoras, preço médio
por combustível). A versão do Streamlit tinha minimapas por lado; aqui foram deliberadamente
cortados pra não duplicar o Mapa de Densidade que já existe na aba "Mapa & Municípios". A função
`calcularMetricas` foi extraída do componente pra fora (era uma closure sobre props, disparava
`react-hooks/exhaustive-deps`).

### Painel "📅 Tendência × Sazonalidade"

RPCs `historico_precos_serie_uf_combustivel()` (média mensal por UF+combustível, 714 linhas) e
`historico_precos_volatilidade_mensal()` (desvio padrão mensal por combustível via `stddev_pop`, 61
linhas) — pequenas o bastante pra mandar inteiras pro cliente e deixar os filtros 100% reativos.
Regressão linear (mínimos quadrados) foi implementada à mão em JS (sem `numpy.polyfit` disponível)
pra desenhar a linha de tendência pontilhada por UF. O heatmap de sazonalidade (preço médio por mês
do calendário, por UF) virou uma grade HTML/CSS colorida em vez de forçar uma lib de gráfico a
fazer heatmap — reaproveita a mesma escala de 5 cores verde→vermelho do Plotly original.

### Painel "📈 Evolução Temporal"

RPCs `historico_precos_detalhado()` (14 mil+ registros brutos, cnpj+combustível+preço+semana+mês
pré-calculados no banco) e `abastecimentos_preco_periodo()` (preço real pago pela frota, agregado
por UF+período, fonte `profrotas_abastecimentos`). Três seções: tendência de preço por UF (com uma
série extra "💰 Preço real pago" sobreposta, vinda dos abastecimentos reais — só filtrada por UF,
não por combustível, igual ao original), volatilidade por UF (desvio padrão dos preços médios
período-a-período, cores por quartil relativo pro desvio absoluto e por faixa fixa pro coeficiente
de variação) e ranking de estabilidade por posto (CV% sobre os registros brutos, mínimo 3 registros
por posto).

### Painel "🚦 Operacional"

4 sub-abas com RPCs dedicadas: `postos_gf_precos_mapa()` (mapa de calor de preços, cores por
normalização min-max em 3 faixas), `postos_gf_desvio_anp()` (desvio sinalizado, positivo ou
negativo, sem corte de threshold — o corte vira um slider no cliente), `postos_gf_servicos()`
(11 flags booleanos de infraestrutura do posto: arla, 24h, banheiro, estacionamento, internet,
óleo a granel, restaurante, troca de óleo, pista de caminhão, conveniência e conveniência 24h).
O score composto (preço 50% + serviços 30% + distância 20%) é calculado no cliente a partir dessas
duas últimas RPCs; a componente de distância fica sempre neutra (50 pontos fixos), igual ao
Streamlit original, que também nunca varia essa parte nesta tela (não há um ponto de referência de
rota aqui). Graus A/B/C/D: A≥75, B≥55, C≥35, D<35.

### Painel "🔀 Cruzamentos Avançados"

4 sub-abas reaproveitando dados já buscados por outros painéis desta mesma página (sem RPC nova,
exceto `abastecimentos_postos_visitados()` pro sub-painel de Frota Real): regiões caras vs baratas
por UF (classificação por quartil, reaproveitando `preco_medio_por_combustivel_uf`), clusters de
oportunidade por município (4 faixas fixas de desvio vs média nacional, reaproveitando
`historico_precos_detalhado`), GF vs concorrência por UF (reaproveitando `postos_gf_desvio_anp`,
agregado por UF) e Frota Real — mapa de calor dos postos realmente visitados pela frota (raio
proporcional a visitas, cor por preço pago), ranking dos mais usados e preço pago por UF comparado
à referência ANP de Diesel S10.

### Painel "🎯 Cobertura × Demanda" — ressalva de dado importante

No Streamlit original, "Demanda" é uma soma ponderada de rotas salvas (peso 1,0 por UF tocada) +
abastecimentos reais (peso 0,5 por UF do posto). Como rotas salvas nesta aplicação são sugestão de
roteirização e não GPS real, o porte aqui usa **só abastecimentos reais** (`profrotas_abastecimentos`,
já buscados via `abastecimentos_postos_visitados()`) como demanda — nenhuma contribuição de rota
planejada entra na conta. Isso é avisado explicitamente na tela (banner amarelo) e no expander
"Como o Gap Score é calculado". Fórmula: `Gap Score = demanda_normalizada × (1 − cobertura_normalizada)`,
mesmos limiares de prioridade do original (crítico ≥0,60, alto ≥0,35, médio ≥0,15). O mapa de bolhas
usa centróides fixos por UF (não há geocodificação de posto/frota nesse nível), igual ao original.

### Painel "🚚 Eficiência Real por Veículo" — no Dashboard, não na Inteligência de Rede

Esse painel é por cliente (não é uma visão de rede cross-tenant), então foi colocado como item "8."
do `/dashboard` existente, usando o mesmo seletor de cliente+período já ali. RPC nova
`indicador_eficiencia_veiculos(empresa_id, data_inicio, data_fim)`: calcula km rodado real por
LAG() do hodômetro entre abastecimentos consecutivos da mesma placa (a janela de LAG roda sobre o
histórico completo do veículo, não sobre o período filtrado, pra não quebrar a sequência na borda
do filtro) e km/L = km rodado / litros do abastecimento atual. A parte do painel original que
comparava contra "rota ideal" (desvio de trajeto) foi deliberadamente **não portada** — depende de
`rotas_salvas`, que não é GPS real, e o usuário já tinha pedido pra não portar essa comparação sem
alinhar antes.

### Validação

`npx tsc --noEmit` e `npx eslint` limpos no projeto inteiro (não só nos diretórios tocados). RPCs
novas testadas via `execute_sql` antes de expor no client. `get_advisors` (security) rodado depois
de todas as migrações da Fase 13 — nenhum alerta novo introduzido pelas funções desta fase (todas
`STABLE`, sem `SECURITY DEFINER`, com `search_path` fixo; o acesso cross-tenant do time interno já
vem das policies de RLS existentes, que liberam leitura total quando `perfil_usuario_atual() = 'admin'`).

## Fase 14 — Inteligência da Minha Frota: a mesma visão de rede, escopada por cliente

O Daniel perguntou se os clientes (não só o time interno) poderiam ver os próprios indicadores de
rede — preço vs ANP, alertas, mapa e score — desde que restritos à própria frota. Investigação
confirmou que era possível reaproveitar quase tudo já construído na Fase 13.

### Achado de segurança corrigido antes de abrir a tela

`historico_precos_tenant_all` liberava leitura de **qualquer** linha com `empresa_id` nulo pra
**qualquer** usuário autenticado, não só admin. 9.339 das ~14 mil linhas estavam nessa condição —
a grande maioria (9.307) tinha um posto correspondente em `postos_gf` já vinculado a uma empresa
real (ficaram nulas por terem sido importadas antes do posto ser reivindicado por um cliente, e
nunca foram re-sincronizadas quando isso aconteceu). Corrigido com backfill via
`historico_precos.cnpj → postos_gf.empresa_id`, e a policy foi apertada removendo a cláusula
`empresa_id IS NULL`. As 32 linhas remanescentes (postos que não existem mais em `postos_gf`)
ficam visíveis só pro admin — comportamento correto para dado órfão que não pode ser atribuído a
ninguém.

### RPCs viraram multi-uso (rede inteira OU cliente específico)

Em vez de duplicar RPCs, as 7 usadas nos painéis reaproveitados ganharam um parâmetro opcional
`p_empresa_id uuid default null`: `preco_medio_por_combustivel`, `historico_precos_serie_uf_combustivel`,
`historico_precos_volatilidade_mensal`, `postos_gf_alertas_preco`, `postos_gf_pontos_mapa`,
`postos_gf_desvio_anp`, `postos_gf_servicos`. Sem o parâmetro (como a Inteligência de Rede admin já
chamava), o comportamento continua idêntico — rede inteira. Com o parâmetro, filtram só a empresa
informada. O filtro é passado **explicitamente** pela nova tela (não é só "confiar na RLS") porque
um admin pré-visualizando a aba de um cliente específico tem RLS ampla — sem o filtro explícito ele
veria a rede inteira misturada em vez de só o cliente selecionado.

### Nova aba "Inteligência da Minha Frota" em /postos

Terceira aba ao lado de "Rede do cliente" e "Explorar universo ANP" (só aparece com um cliente
selecionado). Reaproveita componentes já existentes da Inteligência de Rede via import direto entre
diretórios de rota (`../inteligencia-rede/_components/...`, permitido — `_components` só exclui do
roteamento, não do resolução de módulos): `GraficoCustoAnp`, `GraficoAlertasPorEstado`,
`TendenciaSazonalidade`, `MapaDensidadeLazy`, `AbasPainel`. Só o painel de Score ganhou um
componente novo (`ScoreFrota.tsx`), simplificado pra ranking por posto em vez de por
macrorregião/UF (não faz sentido agrupar por região quando é a rede de um cliente só). 4 abas:
Preços vs ANP (+ Tendência & Sazonalidade), Alertas de Preço, Mapa dos Meus Postos, Score
Operacional (A/B/C/D) — os demais painéis da Inteligência de Rede (Macrorregião & Expansão,
Cobertura × Demanda, Modo Comparativo, Cruzamentos Avançados) ficaram de fora por serem estratégia
de expansão da rede GF como um todo, sem sentido pra um cliente único.

### Validação

`npx tsc --noEmit` e `npx eslint` limpos no projeto inteiro. `get_advisors` (security) rodado após
a correção de RLS e a mudança de assinatura das 7 RPCs — nenhum alerta novo.

### Bug pós-Fase 14: painéis "sem dados" no admin (Cruzamentos Avançados, Operacional)

Depois da correção do vazamento acima, o admin passou a ver alguns painéis de Inteligência de
Rede vazios ("Sem preços cadastrados para esse combustível" etc.). Investigação (via `execute_sql`
simulando a sessão real com `set_config('request.jwt.claims', ...)` + `set role authenticated`,
já que o sandbox não tem rede liberada pra testar a REST API direto) descartou RLS/dado ausente —
as funções retornavam as linhas certas mesmo sob RLS simulada. Os logs reais da API mostraram a
causa: `postos_gf_alertas_preco`, `postos_gf_desvio_anp` e `preco_medio_por_combustivel_uf`
estavam de fato retornando **500 (statement timeout)** no carregamento real da página.

Causa raiz: a policy `historico_precos_tenant_all` (reescrita na correção do vazamento) chama
`empresas_do_usuario(...)` e `perfil_usuario_atual()` — ambas `SECURITY DEFINER`, a primeira com
join triplo — **sem envolver a chamada em `(select ...)`**, o antipadrão clássico de RLS no
Postgres/Supabase. Isso faz o Postgres reavaliar as funções **linha a linha** em vez de uma vez só
por consulta. Antes da correção do vazamento, a cláusula barata `empresa_id IS NULL` (verdadeira
pra 9.307 das ~14 mil linhas) vinha primeiro no `OR` e curto-circuitava a avaliação — mascarando o
problema. Ao remover essa cláusula (correto do ponto de vista de segurança), toda linha passou a
exigir as funções caras, e consultas que escaneiam `historico_precos`/`postos_gf` inteiros (as 3
citadas) ficaram lentas o bastante (2,7 s isolado, mais sob concorrência de ~20 RPCs em paralelo no
carregamento da página) para estourar o timeout de 8 s do role `authenticated`.

Corrigido reescrevendo as duas policies (`historico_precos_tenant_all`, `postos_gf_tenant_all`)
envolvendo as funções em `(select ...)` — mesma lógica, mas o Postgres calcula uma vez só por
consulta:

```sql
alter policy historico_precos_tenant_all on public.historico_precos
  using (
    ((empresa_id)::text = any (select unnest(empresas_do_usuario((select auth.jwt()) ->> 'email'))))
    or ((select auth.jwt()) ->> 'email' = 'd.peruffo@gmail.com')
    or ((select perfil_usuario_atual()) = 'admin')
  );
```

(`= any(select unnest(...))` em vez de `= any((select ...))` porque a função retorna array —
`ANY` sobre uma subquery espera linhas escalares, não um array embrulhado numa linha só.)

Resultado sob RLS simulada: `postos_gf_desvio_anp` 2,7 s → 1,37 s (buffers 129 mil → 3 mil, 42x
menos I/O); `preco_medio_por_combustivel_uf` timeout → 75 ms; `postos_gf_alertas_preco` timeout →
1,2 s. `get_advisors` (security) confirmou nenhum alerta novo — mesma semântica, só mais rápida.

**Lição pro projeto**: qualquer policy nova que chame `empresas_do_usuario`/`perfil_usuario_atual`
(ou outra função) deve envolver a chamada em `(select ...)` desde o início, e não depender de
short-circuit de `OR` como proteção de performance.

## Fase 15 — Relatórios (Relatório Executivo, Performance por Posto, Score × Performance, Anomalias, Relatórios Personalizados)

Porta parcial da aba "📑 Relatórios" do Streamlit de referência (`referencia-backend-estudo-de-rede/estudo-de-rede/estudo_de_rede.py`,
linha 32805 em diante — 7 sub-abas originais). Escopo combinado com o Daniel: trouxe 5 das 7 peças agora
(Relatório Executivo, Performance por Posto, Score × Performance, Anomalias, Relatórios Personalizados);
ficaram de fora por ora "Oportunidades Comerciais" (a parte de regiões sem cobertura já existe na
Inteligência de Rede) e "Frota FIPE" (integração nova e isolada com BrasilAPI/DENATRAN, domínio diferente
de preço de combustível).

### Nova rota `/relatorios`

Item novo no menu "Operação". Segue o mesmo padrão de `/postos` e `/inteligencia-rede`: resolve perfil e
empresas do usuário, decide o cliente selecionado (seletor pra quem vê mais de um — admin ou usuário
multi-empresa — direto pra quem só tem um), e busca tudo via RPC já filtrado por `p_empresa_id` (inclusive
quando é o admin pré-visualizando um cliente específico — mesma razão da Fase 14: RLS sozinha daria a rede
inteira pro admin, não o cliente selecionado). Sem cliente selecionado, mostra a rede inteira.

### RPCs

`historico_precos_detalhado` ganhou `p_empresa_id uuid default null` (8ª RPC no padrão multi-uso desde a
Fase 14) — alimenta 4 das 5 abas novas (Executivo, Performance por Posto, Score × Performance, Anomalias).
Duas RPCs novas pra Relatórios Personalizados, ambas com `p_empresa_id`/`p_data_inicio`/`p_data_fim`:

```sql
relatorio_abastecimentos_bruto(p_empresa_id, p_data_inicio, p_data_fim)
  -- placa, motorista, produto, litros, valor, preco_litro, cnpj_posto, nome_posto, uf_posto, hodometro, data
relatorio_manutencoes_bruto(p_empresa_id, p_data_inicio, p_data_fim)
  -- placa, oficina, custo_total, data
```

Ambas `LANGUAGE sql STABLE` sem `SECURITY DEFINER` (respeitam RLS normalmente, mesma lógica das outras RPCs
do projeto).

### Lição da investigação de ontem, aplicada preventivamente aqui

Antes de escrever qualquer linha de app, testei a performance das 3 RPCs (a alterada + as 2 novas) sob RLS
real simulada (`set_config('request.jwt.claims', ...)` + `set role authenticated`) — prática que passou a
ser padrão depois do incidente de performance investigado nesta mesma sessão (ver seção "Bug pós-Fase 14"
acima). De quebra, encontrei as policies `profrotas_abastecimentos_tenant_all` e
`manutencoes_realizadas_tenant_all` com o mesmo antipadrão (funções de segurança sem `(select ...)`) — ainda
não tinham dado problema porque a cláusula barata `empresa_id IS NULL` continua na frente do `OR`, mas
corrigi as duas proativamente (mesma técnica, sem mudar semântica) já que as novas RPCs de Relatórios
Personalizados vão escanear essas tabelas com mais frequência. Tempos medidos sob RLS simulada, todos bem
dentro do timeout de 8s do role `authenticated`: `historico_precos_detalhado` 1,05s (14.046 linhas),
`relatorio_abastecimentos_bruto` 19ms (205 linhas), `relatorio_manutencoes_bruto` 14ms (13 linhas).

### As 5 abas

- **📊 Relatório Executivo**: filtros de ano/mês/UF/combustível, KPIs do período, evolução de preço
  (`recharts`), savings estimados vs mercado (percentil 75 como proxy de "preço fora da rede", igual ao
  Streamlit), alertas de risco (alta variação de preço via CV, preço muito acima da média via 2 desvios-padrão,
  UFs sem cobertura). Botão "Baixar PDF Executivo" gera o mesmo conteúdo em PDF via `@react-pdf/renderer`
  (dependência nova) — 100% client-side, sem headless browser, funciona em qualquer host serverless. Segue o
  mesmo padrão do Leaflet: componente isolado (`BotaoBaixarPdfExecutivo.tsx`) carregado via `next/dynamic`
  com `ssr:false` (`BotaoBaixarPdfExecutivoLazy.tsx`), porque `PDFDownloadLink` usa API de navegador.
- **⭐ Performance por Posto**: seletor de posto, evolução de um score simplificado (só preço vs média
  histórica do próprio posto — diferente do score composto de Postos Revendedores, que é uma foto do
  momento), competitividade vs média da rede por combustível, consistência (CV) por combustível.
- **🎯 Score × Performance**: matriz quadrante (gráfico de dispersão) cruzando o score composto (reaproveita
  `calcularScorePosto`, extraído pra `src/lib/scorePosto.ts` porque agora tem 2 consumidores — `ScoreFrota` e
  esta aba) com utilização (nº de registros de preço no histórico, como proxy de movimentação). 4 quadrantes:
  oportunidade de crescer, manter, risco, revisar.
- **🔍 Anomalias**: preços fora do padrão via método IQR (interquartil, por combustível, mínimo 5 registros)
  e postos inconsistentes (CV > 5% entre registros do mesmo posto+combustível) — tudo calculado client-side
  em cima do `historico_precos_detalhado` já carregado.
- **🗂️ Relatórios Personalizados**: construtor "monte o seu relatório" — fonte (Abastecimentos ou
  Manutenção; **Negociações não existe como tabela no banco ainda**, por isso não é uma fonte disponível),
  dimensão (período/produto/veículo/motorista/posto/UF conforme a fonte), métrica (contagem, volume, valor,
  ticket médio, preço médio / custo total, custo médio conforme a fonte) e tipo de gráfico (barras, barras
  horizontais, linhas, pizza, tabela). Agregação 100% client-side sobre os dados brutos filtrados no servidor
  (últimos 365 dias). Exportação em **CSV** (não PDF/Excel como no Streamlit) — trade-off consciente: um
  relatório de forma variável (dimensão/métrica escolhidas em tempo real) é mais simples e robusto de
  exportar em CSV do que gerar um PDF/Excel formatado dinamicamente; fica pra uma iteração futura se fizer
  falta.

### Validação

`npx tsc --noEmit` e `npx eslint "src"` limpos no projeto inteiro (1 warning de `react-hooks/exhaustive-deps`
corrigido). `get_advisors` (security) rodado após as 3 migrações — nenhum alerta novo. `npm install
@react-pdf/renderer` verificado: `next`, `react`, `react-dom`, `recharts`, `leaflet`, `react-leaflet`,
`@supabase/supabase-js`, `@supabase/ssr` e `xlsx` continuam presentes em `node_modules` depois do install
(o npm fez um dedup/prune grande — 121 pacotes removidos, 64 adicionados — mas nada essencial sumiu).

### Bug pós-Fase 15: "Relatório Executivo" não trazia dados de junho, só de maio

Reportado pelo Daniel: o padrão de período (mês mais recente com dado) caiu em julho (mês calendário
vazio) e, mesmo forçando junho manualmente, não vinha nada — só maio trazia resultado, apesar do dado
mais recente no banco ser `2026-06-01`.

Causa: `dadosPeriodo` filtrava com `new Date(r.dataRef).getFullYear()`/`.getMonth()`. `new Date("2026-06-01")`
é interpretado como meia-noite **UTC**; convertido pro fuso local (Brasil, UTC-3) vira `2026-05-31 21:00`,
e `.getMonth()` lido nesse horário local devolve maio, não junho — o registro de 1º de junho "escorregava"
pro filtro de maio. Mesmo padrão de bug nos `tickFormatter`/`labelFormatter` dos gráficos (eixo X e tooltip
mostrariam a data errada, um dia antes da real).

Corrigido evitando `new Date()` para qualquer string `"YYYY-MM-DD"` vinda do banco: dois helpers novos em
`src/lib/utils.ts`, `anoMesDeIso` (extrai ano/mês/dia por slice de string, sem passar por `Date`) e
`formatarDataBr`/`formatarDataCurta` (formatam pra exibição do mesmo jeito, sem instanciar `Date`). Aplicado
em todo filtro/formatação de data das 3 abas afetadas (Relatório Executivo, Performance por Posto,
Anomalias). `formatDate` (helper mais antigo, usado em outras telas do projeto) tem o mesmo padrão de bug
mas não foi alterado nesta correção — está fora do escopo do que foi reportado; vale revisão futura se
aparecer o mesmo sintoma em outra tela.

Validado: `npx tsc --noEmit` e `npx eslint "src"` limpos.

### Bug pós-Fase 1: "Permissões por Perfil" mostrava tabela vazia apesar de ter dados

Reportado pelo Daniel: a tela `/permissoes` mostrava "Nenhuma permissão cadastrada ainda" mesmo
devendo existir configuração de acesso por perfil (Administrador / Gestor de Frota / Analista / Posto).

Causa: a tabela `permissoes_perfil` tinha **104 linhas reais** e RLS habilitado, mas **nenhuma policy
criada** (`rls_enabled_no_policy` — esse alerta já vinha aparecendo em todo `get_advisors(security)`
rodado ao longo do projeto, inclusive nas validações das Fases 13 e 15, mas nunca tinha sido endereçado
porque não tinha sintoma visível até agora). Sem nenhuma policy, o comportamento padrão do Postgres com
RLS ligado é negar acesso a **todo mundo** via PostgREST/Supabase client — leitura e escrita, para
qualquer perfil, inclusive admin. Só era possível ver os dados via SQL direto (que ignora RLS).

Corrigido com duas policies novas (`permissoes_perfil` não é uma tabela multi-tenant — não tem
`empresa_id`, é configuração global do sistema):

```sql
create policy permissoes_perfil_select_authenticated
on public.permissoes_perfil
for select
to authenticated
using (true);

create policy permissoes_perfil_admin_write
on public.permissoes_perfil
for all
to authenticated
using ((select perfil_usuario_atual()) = 'admin')
with check ((select perfil_usuario_atual()) = 'admin');
```

Leitura liberada pra qualquer usuário autenticado (a tela usa isso pra montar a matriz de permissões, e
no futuro outras telas podem precisar checar a própria permissão do perfil logado). Escrita (o toggle da
tela, via `alternarPermissao` em `actions.ts`) restrita a admin — usando `(select perfil_usuario_atual())`
já com o wrap de performance aprendido na correção pós-Fase 14.

Validado com RLS simulado: usuário `gestor_frota` consegue `select` (104 linhas) mas `update` não afeta
nenhuma linha (bloqueado); usuário admin consegue `select` e `update` normalmente. `get_advisors(security)`
confirmou que `permissoes_perfil` saiu da lista de `rls_enabled_no_policy` e nenhum alerta novo apareceu.

Com o bug corrigido, as 104 linhas existentes já ficam visíveis e editáveis na tela — não foi necessário
alterar dado nenhum, só destravar o acesso.

### Fase 16 — Roteirização: Comparativos e Exportações (porta do Streamlit)

Trouxe pra `/roteirizacao/planejar` o que faltava da aba "🧭 Roteirização" do Streamlit de referência
(`estudo_de_rede.py`, linhas ~27719–28987). O formulário de origem/destino/paradas, seleção de veículo
e as 4 estratégias de otimização (Economia/Equilíbrio/Qualidade/Mínimas Paradas) já existiam desde a
Fase 7 e continuam iguais — o que entrou agora é tudo que aparecia nas 4 abas de **resultado** do
Streamlit, que reorganizei em abas equivalentes dentro de `FormRoteirizacao.tsx`: **Mapa da Rota**,
**Abastecimento** (tabela que já existia), **Custo da Viagem** (novo) e **Resumo** (novo).

**Backend (`src/app/(dashboard)/roteirizacao/actions.ts`)**: `calcularRoteirizacaoAcao` agora também
calcula, sem nenhuma chamada extra ao banco/OSRM:
- `comparativoEstrategias`: reaproveita os MESMOS candidatos já buscados e roda `otimizarAbastecimento`
  mais 3 vezes (uma por estratégia não selecionada) — só o algoritmo guloso é reprocessado, rota e
  postos não mudam entre estratégias.
- `precoMedioGf`: média de preço dos postos candidatos no corredor de 5 km da rota.
- `precoReferenciaAnp` / `ufReferencia`: como não temos a UF de origem/destino (só coordenadas), uso a
  UF mais representada entre os postos candidatos como referência, e busco a estimativa oficial ANP
  (`anp_precos_referencia`, nível estado) pra essa UF + combustível escolhido.

**Aba Custo da Viagem**: `ComparativoEstrategias.tsx` (cards das 4 estratégias lado a lado, com a
selecionada destacada e o valor de economia entre a mais cara e a mais barata), `GraficosRota.tsx` (3
gráficos recharts: custo acumulado, nível do tanque com zona de risco <25% e cor por grade A-D, e custo
por posto em barras horizontais) e `ComparativoPrecos.tsx` (preço pago vs. média da rede GF vs.
referência ANP, mais tabela de projeção de economia).

**Aba Resumo**: consolida a rota (origem/paradas/destino) e os KPIs, e reúne as 3 exportações pedidas
pelo Daniel:
- **PDF** (`RelatorioRotaPdf.tsx` + `BotaoBaixarPdfRota(Lazy).tsx`): reaproveita `@react-pdf/renderer`
  já instalado na Fase 15, mesmo padrão de lazy-load client-only do Relatório Executivo.
- **GPX** (`src/lib/gpx.ts` + `BotaoExportarGpx.tsx`): gerado 100% no browser via string XML + Blob
  download — GPX é só XML, não precisou de biblioteca nova.
- **Card PNG** (`BotaoGerarCardPng.tsx`): desenhado num `<canvas>` no navegador (Canvas 2D API nativa:
  `fillRect`/`fillText`/gradiente) e baixado via `canvas.toBlob()` — sem lib nova nem servidor de
  imagem, diferente do Streamlit que usa Pillow no backend.

### Validação

`npx tsc --noEmit` e `npx eslint "src"` limpos no projeto inteiro. Não foi possível fazer verificação
visual automatizada desta vez — a extensão Claude in Chrome ficou desconectada durante a sessão (mesmo
problema já registrado no bug pós-Fase 14) e o Chrome só tem acesso leitura via computer-use (visível,
não clicável). Recomendo o Daniel testar manualmente em `/roteirizacao/planejar`: calcular uma rota com
paradas de abastecimento e conferir as 4 abas, especialmente os gráficos e as 3 exportações.

### Templates de importação: CSV → XLSX

Pedido do Daniel: "todas as planilhas templates precisam ser XLSX e não CSV. É mais fácil e natural
para o usuário". Os 4 templates de importação manual (Usuários, Motoristas, Veículos, Abastecimentos)
geravam e liam arquivo `.csv` puro (parser próprio em `src/lib/csv.ts`). Trocados por `.xlsx` de verdade
de ponta a ponta:

- **`src/lib/xlsx.ts`**: dois helpers novos. `gerarXlsxModelo(cabecalho, linhasExemplo, nomeAba)` monta
  o workbook com SheetJS (`aoa_to_sheet` + `book_append_sheet`) e devolve o arquivo pronto pra download.
  `lerPlanilhaComoTexto(buffer, nomeAba?)` lê uma aba e devolve `string[][]` — mesmo formato que
  `parseCSV()` devolvia, então a lógica de parsing linha a linha dos 4 importadores (que já operava
  sobre `string[]`) não precisou mudar, só a leitura do arquivo.
- **`modelo/route.ts`** dos 4 fluxos: agora devolvem `.xlsx` (`Content-Type` do Office Open XML) em vez
  de `.csv`.
- **`actions.ts`** dos 4 fluxos: trocado `arquivo.text()` + `parseCSV()` por `arquivo.arrayBuffer()` +
  `lerPlanilhaComoTexto()`.
- **`ImportForm.tsx`** dos 4 fluxos: `accept=".xlsx"` e label "Arquivo Excel (.xlsx)".
- **`page.tsx`** dos 4 fluxos: textos "planilha CSV" / "Baixar modelo (CSV)" atualizados.

Bônus: os templates de `postos/importar` e `postos/importar-precos` (modelo de postos_gf e de preços)
também geravam CSV, mas com colunas simplificadas que **não batiam** com o que os importadores reais
esperam — esses dois importadores já trabalham com o layout exato do arquivo exportado do sistema de
origem (43 colunas fixas na aba "Ponto de Venda" pra postos_gf, 16 colunas fixas na aba "Preços"), então
o modelo antigo, se reenviado, teria sido rejeitado. Corrigido pra gerar `.xlsx` com o layout e nome de
aba corretos — hoje sem link nenhum na UI (a importação real usa o arquivo do sistema de origem, não um
modelo preenchido à mão), mas fica coerente e disponível como referência de formato.

**Bug pego durante a validação**: a primeira versão de `gerarXlsxModelo` tentava "copiar" o buffer
devolvido pelo SheetJS via `new Uint8Array(x).set(bytes)`, assumindo que `bytes` era um `Uint8Array`.
Na verdade, nesta versão do pacote `xlsx`, `XLSX.write(..., {type: "array"})` devolve um `ArrayBuffer`
puro — e `.set()` chamado com um `ArrayBuffer` (em vez de um array-like de números) zera o conteúdo
silenciosamente, sem lançar erro. Todo `.xlsx` gerado teria vindo corrompido (zerado) pro usuário, sem
nenhum sintoma visível até tentar abrir o arquivo. Pego escrevendo um script Node de teste que gera,
reabre e compara byte a byte antes de considerar a tarefa concluída — corrigido devolvendo o
`ArrayBuffer` direto, sem a cópia desnecessária.

Validado com script Node fora do Next (gera os 6 modelos, relê cada um com a mesma função que o
importador usa, confirma cabeçalho/linha 1/contagem de colunas — 43 pra postos_gf, 16 pra preços — e
que a validação de primeira célula dos importadores reais passa). `npx tsc --noEmit` e
`npx eslint "src"` limpos.

## Fase 17 — Rotograma de Segurança

Pedido do Daniel: "No streamlit tem uma funcionalidade de Rotograma. Quero trazer para cá também."

Investigação prévia: diferente de Relatórios (Fase 15) e Roteirização — Comparativos (Fase 16), o
"Rotograma" **não existe como código funcionando** na ferramenta Streamlit de referência (`estudo_de_rede.py`,
37 mil linhas, zero ocorrências). Existe só como mockup de marketing na landing page da ferramenta
(`landing/index.html`), descrevendo um "Rotograma de Segurança": mapa de pontos de risco (áreas de
perigo, zonas de crime, radares/lombadas) e pontos de parada (posto, restaurante, hotel) ao longo de
uma viagem, mais um bloco fixo de contatos de emergência, exportável em PDF para o motorista levar na
estrada. Não havia lógica de referência pra portar — construído do zero a partir da ideia do mockup.

Achado durante a investigação: a tabela `rotogramas` **já existia no banco** (compartilhada com a
ferramenta Streamlit, nunca chegou a ser usada de fato por lá), com um schema pronto que bate quase
exatamente com o mockup: `id`, `numero` (sequencial), `empresa_id`, `user_email`, `origem`, `destino`,
`veiculo`, `motorista`, `placa`, `data_viagem`, `carga`, `observacoes`, `riscos` (jsonb) e `paradas`
(jsonb). Reaproveitada sem precisar de migration de schema novo. Suas 4 policies, porém, estavam todas
com `USING (true)` / `WITH CHECK (true)` — sem checar `empresa_id` nem autenticação, igual ao bug já
corrigido em `permissoes_perfil` (ver acima). Substituídas pelo mesmo padrão multi-tenant usado em
`motoristas`/`centros_custo`/`veiculos`: membro da empresa dona do registro, ou perfil admin, mais uma
policy de `service_role`. Validado com sessão simulada (`set_config('request.jwt.claims', ...)`):
gestor de frota consegue inserir/ver só os rotogramas da própria empresa; `get_advisors(security)`
re-rodado confirma que `rotogramas` não aparece mais em `rls_enabled_no_policy`.

Construído em `src/app/(dashboard)/rotograma/`:

- **`tipos.ts`**: tipos `RotogramaRisco`/`RotogramaParada` (campos `local`, `categoria`, `descricao`),
  3 categorias de risco (perigo/crime/radar) e 3 de parada (abastecimento/alimentação/pernoite), cada
  uma com cor e ícone, e a lista fixa de `CONTATOS_EMERGENCIA` (PRF 191, SAMU 192, Bombeiros 193, PM 190,
  ANTT 166 — números nacionais do Brasil, não dependem de cadastro).
- **`actions.ts`**: CRUD (`criarRotogramaAcao`, `atualizarRotogramaAcao`, `excluirRotogramaAcao`) — os
  campos dinâmicos de risco/parada chegam do form como `riscos[0][local]`, `riscos[0][categoria]`, ...
  e são reconstruídos em array no server. Também `buscarRotaSalvaParaRotogramaAcao`, que lê uma rota já
  salva na Roteirização (`rotas_salvas`, tipo `"roteirizacao"`) e devolve origem/destino/placa pra
  pré-preencher o formulário — poupa o usuário de digitar tudo de novo se já roteirizou a viagem.
- **`page.tsx`** (listagem), **`novo/page.tsx`**, **`[id]/page.tsx`** (visualização rica: pontos de
  risco e parada coloridos por categoria, contatos de emergência, exportar PDF, editar, excluir),
  **`[id]/editar/page.tsx`**.
- **`_components/RotogramaForm.tsx`**: formulário com listas dinâmicas de risco/parada (adicionar/
  remover linha), com opção de importar dados de uma rota salva.
- **`_components/VisualizacaoRotograma.tsx`**: bloco visual reutilizado na página de detalhe.
- **`_components/RotogramaPdf.tsx`** + `BotaoBaixarPdfRotograma.tsx` + `BotaoBaixarPdfRotogramaLazy.tsx`:
  mesmo padrão `@react-pdf/renderer` + `next/dynamic({ssr:false})` das Fases 15/16.
- **`_components/BotaoExcluirRotograma.tsx`**: exclusão com confirmação inline.

Menu lateral: item "Rotograma" adicionado em Operação, entre Roteirização e Manutenção Preditiva.

`database.types.ts`: bloco `rotogramas` adicionado manualmente (mesmo estilo de `rotas_salvas`, escrito
à mão em vez de gerado, já que o schema já existia no banco).

Validado com `npx tsc --noEmit -p .` (projeto inteiro, sem erros) e `npx eslint` nos arquivos novos
(limpo). RLS revalidada via `get_advisors(security)` e sessão simulada.

**Nota**: durante a cópia dos arquivos pro projeto, um `cd` com glob mal formado criou por engano um
diretório literal `Gest*` (nome real com asterisco) como irmão de `Gestão de Frotas` dentro do sandbox —
identificado, removido, e os arquivos recopiados pro lugar certo antes da validação final. Não afetou o
projeto real; ficou restrito ao sandbox temporário desta sessão.

## Correção — Dashboard não filtrava indicadores pelo cliente selecionado

Bug reportado pelo Daniel com print de tela: os 6 cards do topo (Motoristas ativos, Veículos ativos,
Litros no mês, Valor no mês, Custo médio/litro — Clientes ativos ficou de fora, ver abaixo), o gráfico
"Consumo e gasto" e a lista "CNH vencendo em 30 dias" sempre mostravam números da rede inteira,
ignorando o seletor de cliente do topo — só "Desempenho por centro de custo" e "Indicadores avançados"
respeitavam o filtro.

Corrigido em `src/app/(dashboard)/dashboard/page.tsx`: `resolverEmpresaAtual` foi movido pra antes da
consulta principal, e as queries de motoristas/CNH ganharam `.eq("empresa_id", empresaSelecionada)`
condicional. `cadastro_veiculos` não tem coluna `empresa_id` (o vínculo é por `cnpj_frota`, resolvido
via a função `empresa_id_do_cnpj` usada na própria RLS policy da tabela) — por isso, quando há cliente
selecionado, uma consulta extra busca o `cnpj` da empresa e filtra veículos por `cnpj_frota`. Os
abastecimentos usados nos cards e no gráfico agora vêm de `abastecimentosCliente` (o array já buscado,
filtrado em memória pelo cliente); o array original sem filtro continua alimentando só o "Top 5 clientes
por gasto", que por natureza compara clientes entre si e não faz sentido escopar a um único cliente —
"Clientes ativos" (contagem de empresas-cliente) também ficou de fora por essa mesma razão. Texto de
ajuda do seletor atualizado pra deixar esse comportamento explícito.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (ambos limpos).

## Melhoria — Motorista e Placa do Rotograma viram listas de cadastro

Pedido do Daniel com print do formulário: os campos "Motorista" e "Placa" (texto livre) poderiam ser
listas com os registros já cadastrados do cliente selecionado.

Adicionado em `src/app/(dashboard)/rotograma/actions.ts`: `listarMotoristasEVeiculosAcao(empresaId)`,
que busca motoristas ativos por `empresa_id` e veículos ativos por `cnpj_frota` (resolvido a partir do
`empresas.cnpj` do cliente — mesmo mapeamento usado na correção do Dashboard). Em
`RotogramaForm.tsx`, os dois campos viraram `<select>` controlados, recarregados via `useEffect` sempre
que o cliente muda (no formulário de "novo") ou já carregados de cara com o `empresa_id` do próprio
Rotograma (na edição, onde o cliente é fixo). Se o valor salvo não estiver na lista atual (ex.: registro
digitado antes dessa mudança, ou motorista/veículo desde então inativado), ele aparece como opção extra
pra não se perder ao editar — mesmo padrão defensivo já usado no select de Produto do formulário de
Abastecimentos.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos).

## Correção — Placa do Rotograma sempre vazia (CNPJ não normalizado)

Bug real reportado pelo Daniel testando o formulário: com cliente selecionado, "Motorista" listava
certinho, mas "Placa" continuava mostrando só "Selecione..." — nenhum veículo aparecia.

Causa raiz: `cadastro_veiculos` não tem `empresa_id`, o vínculo é por `cnpj_frota`. O código (tanto no
formulário do Rotograma quanto na correção do Dashboard, ambos desta mesma sessão) comparava
`cnpj_frota` direto com `empresas.cnpj` via `.eq()`. Só que `empresas.cnpj` sempre vem formatado
("25.265.787/0001-44"), enquanto `cadastro_veiculos.cnpj_frota` tem uma mistura de registros com e sem
pontuação no banco real — o `.eq()` de igualdade exata nunca batia. Confirmado via SQL: 0 veículos com
match exato, 28 com match normalizado (só dígitos/letras, maiúsculo) pra "Frotas & Frotas Ltda".

A própria RLS de `cadastro_veiculos` já resolve isso corretamente há tempos, via a função
`empresa_id_do_cnpj` (normaliza os dois lados com `regexp_replace(upper(cnpj), '[^0-9A-Z]', '', 'g')`
antes de comparar) — só o código da aplicação é que não estava reaproveitando essa mesma lógica.

Corrigido criando a RPC `public.veiculos_da_empresa(p_empresa_id uuid)`, que devolve os veículos
(`setof cadastro_veiculos`) resolvendo o vínculo com a mesma normalização de `empresa_id_do_cnpj` —
`SECURITY INVOKER` (padrão), então continua respeitando a RLS de quem chama, não é um bypass.
Substituiu o `.eq("cnpj_frota", ...)` em dois lugares: `listarMotoristasEVeiculosAcao` (Rotograma) e nos
cards "Veículos ativos"/"Veículos totais" do Dashboard (que tinham exatamente o mesmo bug, introduzido
na correção anterior desta sessão). `database.types.ts` ganhou a assinatura da nova RPC.

Validado: `select count(*) from veiculos_da_empresa(...)` bate com a contagem normalizada esperada (28);
sessão simulada confirma que a RLS subjacente continua sendo respeitada (gestor só vê veículos das
empresas que tem acesso). `npx tsc --noEmit -p .` e `npx eslint` limpos.

## Melhoria — Linha do tempo de riscos e paradas no Rotograma

Pedido do Daniel com print da tela de detalhe: gráfico de linha do tempo com os pontos críticos e
paradas entre origem e destino, exibido na tela e replicado no PDF exportado para o motorista.

Adicionado campo `km` (opcional) em `RotogramaRisco`/`RotogramaParada` (`tipos.ts`), preenchido por um
novo input "Km" em cada linha do formulário (`RotogramaForm.tsx`) — mas nada quebra pra Rotogramas já
cadastrados sem esse campo: `resolverLinhaDoTempo` resolve a posição de cada ponto em cascata: (1) campo
`km` explícito; (2) senão, tenta extrair um número de "km" do texto livre do campo Local via regex (ex.:
"BR-153 - KM 100" → 100), cobrindo os Rotogramas já criados; (3) senão, distribui os pontos igualmente
entre origem e destino como último recurso — nenhum ponto fica de fora do gráfico. Pontos com Km
estimado (não veio do campo nem do texto) aparecem com o traço tracejado, tanto na tela quanto no PDF.

`_components/LinhaDoTempoRotograma.tsx` (novo): SVG desenhado à mão (sem lib de gráfico) — linha
horizontal com origem à esquerda (verde) e destino à direita (vermelho), riscos como hastes acima da
linha coloridas por categoria, paradas como hastes ciano abaixo, posicionadas proporcionalmente ao Km
resolvido. Integrado na página de detalhe (`[id]/page.tsx`), entre os cards de info e as listas de
risco/parada.

O mesmo cálculo de posição (`resolverLinhaDoTempo`) foi reaproveitado no PDF: `RotogramaPdf.tsx` ganhou
uma seção "🗺️ Linha do tempo da viagem" desenhada com os primitivos de SVG do próprio
`@react-pdf/renderer` (`Svg`, `Line`, `Circle`, `Text` com `x`/`y`) — biblioteca já usada no projeto, sem
dependência nova. Layout mais compacto que o da tela (rótulos menores) pra caber numa página A4 junto
com o resto do relatório.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos após corrigir aspas não escapadas no texto de
ajuda do novo campo Km). Regex de extração testada em Node contra os 3 formatos de texto já usados no
projeto ("BR-153 - KM 100", "BR-381 km 120 — Itatiaia/MG", "Posto Ipiranga — km 210") — todos resolvem
corretamente.

## Fase 17.1 — Botão "Gerar Rotograma" no resultado da Roteirização

Pedido do Daniel: trazer o Rotograma pra dentro da Roteirização também. Perguntei o formato via
AskUserQuestion — escolheu "Botão 'Gerar Rotograma' no resultado da rota".

Na aba Resumo da Roteirização (`FormRoteirizacao.tsx`), junto dos botões de exportação (PDF/GPX/Card),
adicionado um link "🛡️ Gerar Rotograma" que monta um JSON com origem, destino, placa e as paradas de
abastecimento sugeridas pelo otimizador (`resultado.paradas` — cada uma já tem `km`, `label`, `preco`,
`bandeira`) e navega pra `/rotograma/novo?prefill=<json>`.

Optei por passar os dados direto na query string em vez de reaproveitar o mecanismo de "Importar de uma
rota salva" (que já existia): `rotas_salvas` só grava os waypoints digitados pelo usuário, não as
paradas de abastecimento calculadas pelo otimizador — salvar a rota primeiro perderia justamente a
informação mais útil pro Rotograma (onde o motorista provavelmente vai parar, e em que km).

`novo/page.tsx` decodifica o `prefill` no server (com try/catch — se vier corrompido/manipulado,
ignora silenciosamente em vez de quebrar a página) e repassa pro `RotogramaForm`, que agora aceita um
prop opcional `prefill` para inicializar origem/destino/placa e a lista de paradas (cada uma já com
`km` preenchido, então a linha do tempo — Fase 17 anterior — funciona de cara, sem precisar estimar
nada). Um aviso no topo do formulário avisa que os dados vieram da Roteirização e podem ser ajustados.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos).

## Fase 18 — Assistente IA FNI

Pedido do Daniel: um assistente de IA onde o usuário consulte qualquer informação da sua operação de
frota em linguagem natural, com insights sobre a operação. Perguntei o desenho via AskUserQuestion antes
de começar (provedor de IA, forma de acesso aos dados, onde aparece na navegação, escopo inicial).
Respostas: Anthropic Claude API, "gerar SQL sob demanda" (mais flexível, exige camadas extras de
validação), página própria "Assistente FNI", e as 4 áreas de escopo inicial (abastecimentos/custos,
veículos/motoristas, manutenção preditiva, centros de custo/indicadores).

### Decisão de segurança: por que "SQL sob demanda" é seguro aqui

A opção mais arriscada das 4 apresentadas era deixar o modelo gerar SQL livremente — mas ela também é a
mais flexível (não fica limitada a um conjunto fixo de perguntas pré-programadas). Pra isso ser seguro,
a peça central é a função `ia_executar_select(p_sql text)` (migração `ia_executar_select`):

- **`SECURITY INVOKER`, não `SECURITY DEFINER`** — essa é a decisão que sustenta tudo o resto. A função
  roda com o papel do usuário logado (via o cliente Supabase autenticado da própria requisição), então
  toda consulta gerada pela IA passa pelas mesmas políticas RLS que já protegem o resto do produto. Não
  existe um SQL que a IA possa inventar que vaze dado de outra empresa — o Postgres bloqueia isso no
  nível de linha, independente do que a IA "decidiu" consultar.
- Validação adicional, em camadas, dentro da própria função (defesa em profundidade, não a proteção
  principal): só aceita 1 comando por chamada, só aceita `SELECT`/`WITH` no início, bloqueia por regex de
  palavra inteira uma lista de palavras-chave de escrita/DDL (mesmo escondidas dentro de um CTE), limita
  a 200 linhas de retorno e tem timeout de 8s.
- Testado manualmente contra: consulta válida, `DELETE` direto (bloqueado), `DELETE` escondido num CTE
  (bloqueado), múltiplos comandos com `;` (bloqueado), limite de 200 linhas (confirmado exato), e — o
  teste mais importante — isolamento entre empresas: simulando a sessão de um gestor com acesso a 2
  empresas, a mesma consulta que via 514 motoristas (as 2 empresas dele) nunca conseguiu ver dados de
  empresas de outros clientes.

### Arquitetura

- `src/lib/assistenteIA.ts` — a orquestração: system prompt com o schema das 5 tabelas do escopo inicial
  (`profrotas_abastecimentos`, `cadastro_veiculos`, `motoristas`, `manutencoes_realizadas`,
  `centros_custo`/`centros_custo_veiculos`) e as regras de segurança pro modelo; um loop agente (até 6
  idas-e-voltas) que deixa o Claude decidir se/quando chamar a ferramenta `consultar_banco`, executa cada
  SQL via `supabase.rpc("ia_executar_select", ...)` usando o cliente autenticado da requisição (RLS
  aplicado normalmente) e devolve o resultado pro modelo até ele ter uma resposta final em texto.
- `assistente/actions.ts` — server action `perguntarAssistenteAcao(pergunta, historico)`, valida sessão e
  tamanho da pergunta antes de chamar a lib.
- `assistente/page.tsx` + `_components/ChatAssistente.tsx` — página de chat simples (histórico só em
  memória no cliente, sem persistência no banco por enquanto), com perguntas sugeridas e um "detalhe"
  expansível mostrando quais consultas SQL foram executadas em cada resposta (transparência).
- Menu: item "🤖 Assistente FNI" adicionado no topo do menu lateral (`layout.tsx`), ao lado do Dashboard.

### Configuração necessária

O Daniel já tem assinatura da API Anthropic. Adicionei um placeholder `ANTHROPIC_API_KEY=` no
`.env.local` (com comentário explicando onde pegar a chave em
https://console.anthropic.com/settings/keys) — preciso que ele preencha o valor manualmente, já que eu
nunca insiro segredos reais nesses arquivos. Sem essa variável, a página `/assistente` mostra o erro
"ANTHROPIC_API_KEY não configurada" ao tentar fazer a primeira pergunta.

Modelo usado: `claude-sonnet-5` (constante `MODELO` em `assistenteIA.ts` — fácil de trocar se a Anthropic
lançar um modelo mais novo).

Validado com `npx tsc --noEmit -p .` e `npx eslint .` (limpos), `get_advisors` de segurança rodado
novamente após a migração (nenhum novo alerta introduzido pela função `ia_executar_select`), e uma
consulta realista de teste (join `manutencoes_realizadas` × `cadastro_veiculos`, ranking por custo)
confirmando que o RPC funciona corretamente também para consultas com JOIN/GROUP BY/ORDER BY, não só
`SELECT` simples.

## Fase 18.1 — Exportação da conversa do Assistente FNI em PDF

Pedido do Daniel: poder baixar a conversa com o Assistente FNI em PDF. Segue exatamente o mesmo padrão
já usado no Rotograma (`@react-pdf/renderer` + `PDFDownloadLink`, com um wrapper `next/dynamic({ ssr:
false })` porque a lib só funciona no client):

- `_components/AssistentePdf.tsx` — documento com um bloco por mensagem (rótulo "Você" / "Assistente
  FNI", cor de fundo diferente pra cada lado) e, quando a resposta envolveu consultas ao banco, uma
  caixa listando cada SQL executado e quantas linhas voltou — a mesma informação de transparência que já
  aparece no `<details>` do chat na tela.
- `_components/BotaoBaixarPdfAssistente.tsx` + `...Lazy.tsx` — botão "📄 Baixar conversa em PDF".
- `ChatAssistente.tsx` — botão aparece numa barra no topo do chat assim que existe pelo menos 1
  mensagem; recebe `usuarioEmail` (buscado em `page.tsx` via `supabase.auth.getUser()`) para exibir no
  cabeçalho do PDF.

Histórico continua só em memória no cliente (sem persistência no banco), então o PDF reflete exatamente
a conversa que está na tela no momento do clique.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos).

## Fase 8.1 — Importação de Centros de Custo em lote (XLSX)

Pedido do Daniel: mesmo mecanismo de importação em lote (baixar modelo, preencher, subir) que já existe
em Motoristas/Veículos/Abastecimentos, agora para Centros de Custo. Réplica direta do padrão de
`motoristas/importar` (mesmos 4 arquivos: `modelo/route.ts`, `actions.ts`, `_components/ImportForm.tsx`,
`page.tsx`), reaproveitando `gerarXlsxModelo`/`lerPlanilhaComoTexto` (`lib/xlsx.ts`) e `normalizarCNPJ`
(`lib/utils.ts`) sem nada novo na camada de lib.

Colunas do modelo: `nome` e `cnpj_cliente` obrigatórias (resolve o cliente pelo CNPJ, igual ao
importador de Motoristas); `codigo`, `responsavel` e `descricao` opcionais. Cada linha vira um insert em
`centros_custo` com `ativo: true` — não faz upsert/dedupe (se rodar a mesma planilha duas vezes, cria
centros duplicados; mesmo comportamento já aceito no importador de Motoristas).

Segurança: não precisou de nenhuma policy nova — o insert passa pelo cliente Supabase autenticado da
requisição, então a policy `centros_custo_membro` (RLS já existente desde a Fase 8) se aplica
normalmente, igual seria numa criação manual pela tela.

Link "Importar planilha" adicionado ao lado do "+ Novo Centro de Custo" em `/centros-custo` (só aparece
com um cliente selecionado, mesma condição do botão de criar).

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos).

## Fase 15.1 — Relatórios Personalizados: seleção de múltiplas métricas

Pedido do Daniel: em Relatórios Personalizados, poder selecionar mais de uma métrica ao mesmo tempo (antes
era um `<select>` de escolha única).

Troquei o `<select>` de métrica por um dropdown de checkboxes (`SeletorMetricas`, novo componente interno
em `RelatoriosPersonalizados.tsx`) — não usei `<select multiple>` nativo porque exige ctrl/cmd+clique
(nada óbvio pra quem não é técnico) e não mostra quantas opções já estão marcadas sem abrir a lista.
Fecha sozinho ao clicar fora, via `useEffect` + listener de `mousedown` no documento comparado contra um
`ref` do container.

O resultado (`resultado`, `useMemo`) passou de `{ chave, valor, qtdLinhas }` pra `{ chave, valores:
Record<metricaId, number>, qtdLinhas }`, calculando todas as métricas selecionadas por grupo de uma vez.
A ordenação (maior→menor) usa sempre a 1ª métrica selecionada.

Nos gráficos: com 1 métrica, mantém o visual original (uma cor por categoria, via `Cell`). Com 2+, cada
métrica vira uma série própria (uma `<Bar>`/`<Line>` por métrica, cor fixa por série, com `<Legend>`) —
o padrão usual de gráfico agrupado. Pizza sempre usa só a 1ª métrica selecionada (não faz sentido uma
pizza de "fatias de várias métricas diferentes" — mostro um aviso explicando isso quando há mais de uma
selecionada), mas a tabela e o CSV exportado sempre trazem todas as métricas escolhidas, uma coluna cada.

Validado com `npx tsc --noEmit -p .` e `npx eslint` (limpos).

## Fase 19 — Gestão de Chamados

Pedido do Daniel: desenhar uma tela nova de gestão de tickets/chamados, com indicadores, troca de
mensagens e anexos entre usuário e administrador da solução, e notificação visual quando um chamado é
atualizado. Antes de construir do zero, investiguei uma tabela `tickets`/`ticket_anexos` que já existia
no banco (criada por uma ferramenta externa anterior, com 5 chamados reais) — decidi reaproveitar e
evoluir essa estrutura em vez de descartá-la ou usá-la como estava (ela guardava comentários e anexos
como texto JSON dentro de uma única coluna, incluindo o conteúdo em base64 dos arquivos inline).

**Schema.** Criei `ticket_comentarios` (uma linha por mensagem da thread, com `autor_email`/`autor_tipo`
`usuario`/`admin`) e adicionei `autor_email` em `ticket_anexos`. As colunas antigas `tickets.comentarios`
e `tickets.anexos` viraram apenas histórico (comentário na própria coluna avisando "depreciado — não usar
em código novo") — migrei os 7 comentários e 2 anexos reais que existiam para as tabelas novas. Não migrei
o conteúdo base64 do anexo legado em si (só nome/tipo/tamanho): a sandbox onde rodo não tem acesso de rede
ao Supabase (só a MCP do Supabase tem), então mover o byte para o Storage exigiria a API HTTP de Storage,
que só a aplicação em produção consegue chamar. Pra 1 anexo de teste antigo, não valia o esforço — ele
aparece na tela como "anexo legado, indisponível para download".

**RLS e Storage.** `tickets`, `ticket_comentarios` e `ticket_anexos` seguem a mesma regra de acesso do
resto do app (`empresa_id` do usuário, ou e-mail do Daniel, ou perfil admin). Criei o bucket de Storage
`ticket-anexos` (privado) e políticas em `storage.objects` usando `(storage.foldername(name))[1]` como o
`ticket_id` — cada arquivo fica em `{ticket_id}/{timestamp}_{nome}`, e a política confere se aquele
ticket pertence à empresa do usuário antes de liberar leitura/escrita. Validei tudo simulando sessão de
um usuário não-admin: viu exatamente os 3 chamados da empresa dele, nem um a mais.

**Notificação sem realtime.** Em vez de websockets, usei duas colunas de timestamp em `tickets`:
`usuario_visto_em` e `admin_visto_em`. Um trigger (`tocar_ticket_ao_comentar`) atualiza
`tickets.atualizado_em` toda vez que entra um comentário novo (upload de anexo atualiza isso direto na
server action, sem trigger). Quem abre o chamado ou comenta tem seu próprio `_visto_em` atualizado pra
agora; a regra `temAtualizacaoNaoVista()` (`lib/chamados.ts`) compara `atualizado_em` contra o
`_visto_em` do papel de quem está olhando — se o chamado mudou depois da última vez que essa pessoa viu,
aparece destacado. Chamados fechados saem da contagem do badge (não faz sentido continuar sinalizando
depois que o assunto foi encerrado).

**Telas.**
- `/chamados` — indicadores (abertos, em análise, resolvidos, etc.) + listagem com filtro por
  status/tipo/prioridade/cliente; linhas com atualização não vista ficam destacadas com um ponto vermelho.
- `/chamados/novo` — abertura de chamado (tipo incidente/melhoria, título, descrição, anexo opcional).
- `/chamados/[id]` — detalhe com badges de status/prioridade, thread de mensagens em formato de chat
  (bolha própria de cada lado conforme o papel de quem está vendo), upload de novos anexos, e controles
  de status/prioridade só pro admin (usuário comum só tem o botão "Marcar como resolvido").
- Badge de contagem no menu lateral (🎫 Chamados), calculado em `layout.tsx` via
  `contarChamadosNaoVistosAcao()`.

**Bug corrigido depois do primeiro teste em tela:** a listagem usa um embed do PostgREST
(`tickets.select("...,empresas(nome)")`), que exige uma foreign key de verdade — a tabela `tickets`
nunca teve essa FK (só a coluna `empresa_id`, sem constraint). Adicionei
`tickets_empresa_id_fkey → empresas(id)` (nullable, então os 2 chamados legados sem empresa continuam
válidos) e o erro "Could not find a relationship between 'tickets' and 'empresas'" parou.

Validado com `npx tsc --noEmit -p .` e `npx eslint .` (projeto inteiro, limpos) e `get_advisors` de
segurança (nenhum alerta novo nas tabelas de chamados).
## Fase 20 — Planos & Assinatura (self-service, Stripe, painel interno)

Pedido do Daniel: iniciar o módulo de Planos & Assinatura do SaaS FNI pra potenciais clientes,
reaproveitando a infraestrutura de pagamento (Stripe) e mensageria (Resend) que já existia. Antes de
construir, levantei o que já estava pronto no Supabase (fora deste repositório Next.js) e o que faltava.

**O que já existia (infra, sem nenhuma tela):**
- `empresas` já tinha `plano`, `status`, `trial_ends_at`, `cancelado_em`, `stripe_customer_id`,
  `stripe_subscription_id`, `max_usuarios`, `max_veiculos`.
- Tabelas `stripe_events` (log idempotente de eventos) e `invoices` (histórico de cobrança).
- Edge Function `stripe-webhook` — trata `checkout.session.completed`,
  `invoice.payment_succeeded/failed`, `customer.subscription.updated/deleted`, com um mapa de 3 planos
  pagos (`basico`/`profissional`/`enterprise`) ligados a price_ids reais do Stripe.
- Edge Function `email-trials` — dispara e-mails via Resend nos dias D+3, D+7, D+12 do trial e suspende
  a empresa se o trial expira sem conversão.
- Nada disso tinha uma tela no Next.js: sem cadastro self-service, sem botão de checkout, sem "minha
  assinatura", sem painel de acompanhamento pro time interno.

**2 achados de segurança corrigidos antes de construir:**
1. `email-trials` tinha a API key da Resend hardcoded em texto puro no código-fonte. Movida pra
   `Deno.env.get("RESEND_API_KEY")` (secret de Edge Function) — a chave antiga precisa ser revogada e
   uma nova precisa ser configurada como secret no Supabase (ação pendente do Daniel, ver aviso no chat).
2. A policy `invoices_tenant_all` liberava `ALL` (não só leitura) pro tenant — um usuário comum
   conseguiria, em teoria, inserir/editar/apagar as próprias faturas via API. Trocada por
   `invoices_tenant_select`, só `SELECT`, só `authenticated` (faturas são escritas exclusivamente pelo
   webhook via `service_role`).

**Bug pré-existente também corrigido:** a tabela `empresas` nunca teve policy de `INSERT` pra
`authenticated` — confirmado por simulação que nem o admin (d.peruffo@gmail.com) conseguia criar um
cliente novo por `/clientes/novo` (o CRUD da Fase 1 estava quebrado nesse ponto). Adicionada
`empresas_insert_admin` (só admin/Daniel podem inserir).

**Cadastro self-service com trial (`/cadastro`, público, fora do grupo `(dashboard)`):**
Formulário de nome da empresa, CNPJ, nome do contato, e-mail, telefone e senha. A server action
(`criarContaTrial`) cria a conta via `supabase.auth.signUp()` (fluxo público padrão, respeita a
configuração de confirmação de e-mail do projeto) e, na sequência, bootstrap de `empresas` (status
`trial`, plano `gratuito`, `trial_ends_at` = hoje + `DIAS_TRIAL` = 14 dias, limites de
`LIMITES_PLANO.gratuito`), `usuarios_app` e `usuarios_empresas` — usando o cliente admin (service role),
porque um usuário recém-criado ainda não pertence a nenhuma empresa e a RLS dessas tabelas exige isso
pra `INSERT` (confirmado via simulação: um e-mail sem vínculo toma RLS violation ao tentar inserir
direto). Se a confirmação de e-mail estiver ativa, cai em `/cadastro/verifique-email`; senão, a sessão
já vem pronta do próprio `signUp()` e cai direto em `/dashboard` (que pede o MFA, como sempre).
`LIMITES_PLANO` (novo, em `lib/constants.ts`) espelha manualmente o mapa `PLANOS` do `stripe-webhook` —
não há uma tabela de referência única pros planos ainda (decisão: reaproveitar como estavam
configurados no Stripe, não remodelar nesta fase).

**Checkout e portal de pagamento (2 novas Edge Functions):**
`create-checkout-session` e `create-billing-portal-session`, ambas com `verify_jwt: true` e reaproveitando
o `STRIPE_SECRET_KEY` já configurado como secret do projeto (secrets de Edge Function são por projeto,
não por function). Cada uma recebe o JWT de quem chamou, confirma via `empresas_do_usuario()` que a
pessoa realmente pertence à `empresa_id` informada, e só depois fala com o Stripe — nunca confiam
cegamente no `empresa_id` que vem no corpo da requisição. `create-checkout-session` cria uma Stripe
Checkout Session (`mode: "subscription"`) com `metadata.empresa_id`/`metadata.plano` (o que o
`stripe-webhook` já espera pra ativar o plano em `checkout.session.completed`). `create-billing-portal-session`
abre o Billing Portal do Stripe pra quem já tem `stripe_customer_id`. As duas usam uma variável
`DASHBOARD_URL` (secret opcional, default `http://localhost:3000`) pros `success_url`/`return_url` — **precisa
ser configurada com a URL de produção real do painel antes de ir ao ar** (não é a mesma URL da landing
page `fxgestaodefrotasonline.com`, que é um site separado).

**Tela "Minha Assinatura" (`/assinatura`, dentro do dashboard):** plano atual, status, uso vs. limite
(usuários e veículos — `cadastro_veiculos` não tem `empresa_id`, o vínculo é por `cnpj_frota`, então a
contagem busca a empresa primeiro pra saber qual CNPJ filtrar), aviso de dias restantes de trial,
cards dos 3 planos pagos com botão "Assinar" (chama `create-checkout-session` via
`supabase.functions.invoke`, que já anexa o JWT da sessão automaticamente), botão "Gerenciar pagamento"
(chama `create-billing-portal-session`) e histórico de faturas. Usa `resolverEmpresaAtual` — mesmo
padrão de seletor de cliente já usado em `/centros-custo`, `/postos`, `/relatorios` — então o admin
também consegue abrir a assinatura de qualquer cliente.

**Painel interno de Assinaturas (`/assinaturas`, exclusivo perfil admin):** listagem de todos os
clientes com plano/status/trial/Stripe conectado, indicadores (total por status, MRR estimado a partir
de uma tabela de preços fixa só pra essa estimativa, taxa de conversão) e aviso de trials expirando em
até 3 dias. Checagem de acesso segue o mesmo padrão de `/inteligencia-rede` (`perfil_usuario_atual()`
como 2ª camada de defesa — RLS de `empresas` já restringe o `SELECT` geral ao admin).

**Menu:** "Minha Assinatura" em Visão Geral, "Assinaturas (todos os clientes)" em Administração; `/cadastro`
liberada como rota pública no middleware.

**Pendências que ficam por conta do Daniel** (não são coisas que dá pra fazer só com acesso ao banco):
revogar a chave da Resend exposta e cadastrar a nova como secret `RESEND_API_KEY`; configurar o secret
`DASHBOARD_URL` com a URL de produção real do painel; considerar ativar "Leaked Password Protection" no
Supabase Auth, já que agora existe um formulário público de criação de senha (`/cadastro`).

Validado com `npx tsc --noEmit -p .` e `npx eslint .` (projeto inteiro, limpos), `get_advisors` de
segurança (nenhum alerta novo) e simulação de sessão RLS (usuário sem empresa não insere em `empresas`
nem `invoices`; admin insere em `empresas` normalmente; tenant não escreve em `invoices`).

**Correções feitas em produção logo após o primeiro teste em tela** (o Daniel testou o botão "Assinar" e
achou 2 problemas reais):
1. **CORS bloqueando as 3 Edge Functions novas** — `supabase.functions.invoke()` dispara um preflight
   `OPTIONS` antes do `POST`/`GET` de verdade; nenhuma das 3 functions respondia a esse `OPTIONS` nem
   devolvia headers de CORS, então o navegador bloqueava a chamada inteira antes mesmo dela chegar no
   Stripe (erro genérico "Não foi possível iniciar o checkout"). Corrigido nas 3 (`create-checkout-session`,
   `create-billing-portal-session`, `planos-precos`) com um bloco `corsHeaders` padrão + tratamento de
   `OPTIONS`.
2. **Cards de plano sem preço** — os cards só mostravam os limites (usuários/veículos), sem valor
   nenhum. Criada uma 4ª Edge Function, `planos-precos` (`verify_jwt: false`, informação pública), que
   busca o preço de verdade de cada plano direto do Stripe (`stripe.prices.retrieve`) em vez de manter
   um valor hardcoded que pode desatualizar. `lib/planosPrecos.ts` (novo) busca essa function com cache
   de 5 min e formata o valor (`formatarPrecoPlano`). Usado tanto em `/assinatura` (cards) quanto em
   `/assinaturas` (cálculo do MRR estimado, que antes usava uma tabela de preços fixa no código).
3. **`STRIPE_SECRET_KEY` inválida** — ao testar `planos-precos`, o Stripe recusou a chave com "Invalid
   API Key provided: mk_...". O valor salvo no secret começava com `mk_` (não é um prefixo de Secret Key
   do Stripe — deveria ser `sk_test_...` ou `sk_live_...`), sinal de que foi colado o campo errado do
   painel do Stripe em algum momento anterior. O Daniel corrigiu o secret direto no Supabase (ação que só
   ele podia fazer) e o checkout passou a funcionar. Isso também explica por que esse problema nunca
   tinha aparecido antes: `stripe-webhook` só usa `stripe.webhooks.constructEventAsync` (verificação de
   assinatura, cálculo local/HMAC, não chama a API do Stripe de verdade) — as 3 functions desta fase são
   as primeiras a efetivamente autenticar contra a API do Stripe com essa chave.

**4. Cron de e-mails de trial quebrado há ~10 dias (achado ao responder uma dúvida do Daniel sobre o
fluxo de trial).** O job `pg_cron` `fni-email-trials` (roda todo dia às 9h UTC, chama a Edge Function
`email-trials`) estava com `status: failed` todos os dias desde 23/06, erro `schema "net" does not
exist` — a extensão `pg_net` (necessária pra `net.http_post` disparar chamadas HTTP de dentro do
Postgres) nunca tinha sido habilitada neste projeto. Além disso, o comando do job lia
`current_setting('app.supabase_anon_key', true)` pra montar o header `Authorization`, mas esse
parâmetro nunca tinha sido configurado (`null`) — mesmo com `pg_net` habilitado, a chamada continuaria
falhando por falta de autenticação (a function tem `verify_jwt: true`). Corrigido: `create extension
pg_net`, e o comando do job reescrito (`cron.alter_job`) pra levar a ANON_KEY direto no texto do
comando, já que `ALTER DATABASE ... SET` não é permitido pro role usado nas migrações. Testado
manualmente (`net.http_post` direto) — `status_code: 200`. Chave: **isso significa que nenhum e-mail de
trial (D+3, D+7, D+12, aviso de expiração) estava sendo enviado nos últimos ~10 dias** — nenhum e-mail
de trial se perdeu (a lógica só dispara nos dias exatos), mas o mecanismo estava mudo.
## Fase 20.1 — Bloqueio de acesso quando trial/assinatura expira

Pedido do Daniel, ao entender o fluxo de trial: até aqui, quando o trial vencia (ou um pagamento
falhava) a empresa virava `status = "suspenso"` no banco, mas isso era só uma etiqueta — ninguém era
de fato impedido de continuar usando o painel.

Implementado em `src/lib/supabase/middleware.ts` (não no layout do dashboard) justamente porque o
middleware roda ANTES de qualquer rota renderizar, então cobre o app inteiro de uma vez só — chamados,
dashboard, relatórios, tudo — sem precisar repetir a checagem em cada `page.tsx`. Regra: se o usuário
logado não é time interno (`perfil_usuario_atual() = "admin"` ou o e-mail do Daniel) e **todas** as
empresas que ele enxerga (`empresas_do_usuario`) estão com `status = "suspenso"`, qualquer navegação é
redirecionada pra `/assinatura?bloqueado=1` — exceto pra `/assinatura`, `/chamados` e `/mfa-setup`
(senão a pessoa nunca conseguiria pagar de novo ou pedir ajuda, e travaria antes até de cadastrar o MFA).
`/assinatura` mostra um banner vermelho explicando a situação quando chega com `?bloqueado=1`.

Usar `status = "suspenso"` (em vez de checar só trial) cobre os dois casos que já geram esse status
hoje: trial vencido sem conversão (`email-trials`) e falha de pagamento (`stripe-webhook`, evento
`invoice.payment_failed`) — mesma regra pros dois motivos.

Efeito colateral aceito conscientemente: toda navegação de um usuário não-admin agora faz 2 chamadas RPC
a mais no middleware (`perfil_usuario_atual` + `empresas_do_usuario`) além da checagem de sessão que já
existia. Consistente com o padrão já usado no layout do dashboard (checagem de MFA a cada request) — não
introduz nada estruturalmente novo, só mais uma consulta.

Validado com `npx tsc --noEmit -p .` e `npx eslint .` (limpos). Não dava pra testar o redirecionamento
de ponta a ponta sem forçar `status = "suspenso"` numa empresa real, então a validação foi por leitura de
código + tsc — recomendo o Daniel testar manualmente (mudar o status de uma empresa de teste pra
"suspenso" e confirmar o redirecionamento) antes de considerar essa parte 100% coberta.

## Fase 20.2 — Design system FNI nas telas de autenticação e no menu

Pedido do Daniel: as telas de login (incluindo o passo de código MFA) e de cadastro usavam um cartão
branco genérico sobre fundo escuro — sem a logo FNI e sem a "cara" da landing page
(fxgestaodefrotasonline.com). Ele mandou um print da landing e de um mockup de referência (cartão com
logo, tagline, 4 ícones de funcionalidades e o selo "ACESSO SEGURO") pra alinhar a paleta antes de mexer.

**Confirmação de paleta**: a paleta `frota-*` já configurada em `tailwind.config.ts` bateu com a landing
real (fundo `frota-950` quase idêntico ao azul-marinho da landing, `frota-500`/`frota-600` no mesmo tom
de ciano dos botões/destaques) — não precisou mudar nenhum hex, só aplicar de forma mais imersiva nessas
telas específicas.

**Componentes novos** (`src/components/AuthShell.tsx`, `src/components/AuthLogoHeader.tsx`):
- `AuthShell`: fundo cheio de tela em `bg-frota-950` com uma textura sutil de grade em ciano (replicando
  o padrão de fundo da landing) e um glow suave atrás do cabeçalho.
- `AuthLogoHeader`: logo grande num cartão claro (o `logo-fni.png` é um PNG transparente com traço em
  azul-marinho escuro — testado com Pillow, precisa de fundo claro atrás pra não ficar ilegível sobre o
  `frota-950`), título "Fleet Network Intelligence", badge de posicionamento, e o selo "Acesso seguro" no
  rodapé. Tem variante `full` (herói completo com os 4 ícones de funcionalidade, usado só no `/login`,
  que é a primeira impressão) e `compact` (mesma logo/selo, sem os ícones — usado em `/mfa-setup` e
  `/cadastro`, que já têm formulário/QR code ocupando espaço).
- `AuthCard`: substitui o `.card` branco padrão (mantido como está pro resto do dashboard) por um cartão
  "vidro fosco" escuro (`bg-frota-900/70` + `backdrop-blur`) só nessas 3 telas.

**Novas classes utilitárias em `globals.css`**: `.input-dark` e `.label-dark` — variante escura do
`.input`/label padrão, usada só dentro do `AuthCard` (o `.input` original continua branco/claro e não foi
tocado, pra não afetar o resto do app).

**Telas atualizadas**: `src/app/login/page.tsx`, `src/app/mfa-setup/page.tsx`, `src/app/cadastro/page.tsx`
e `src/app/cadastro/verifique-email/page.tsx` (incluída por ser parte do mesmo fluxo público, ainda que
não citada explicitamente). Lógica de nenhuma delas foi alterada — só o visual.

**Menu lateral do dashboard** (`src/app/(dashboard)/layout.tsx`): pedido em seguida pelo Daniel
("ajustar o menu também conforme essa paleta"). O bloco da logo era um retângulo branco sólido de ponta a
ponta, destoando do resto do sidebar escuro. Trocado por um cartão claro compacto (`rounded-xl`,
`bg-white/95`, borda sutil) só em volta da logo — mesma lógica de "fundo claro só onde a logo precisa" das
telas de auth — mais o selo "Ambiente seguro FNI" em ciano abaixo. O resto do menu (itens de navegação,
seções) já usava tokens compatíveis com a paleta e não foi alterado.

Ícones dos 4 badges de funcionalidade vêm do `lucide-react`, já uma dependência do projeto (usado nesse
padrão pela primeira vez nessas telas).

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos alterados (ambos limpos).

## Fase 21 — Avaliação da plataforma (estrelas + resposta do admin)

Pedido do Daniel: um mecanismo de avaliação da plataforma pelo cliente (estrelas + observações, com a
Logo FNI), e um painel pro admin acompanhar e responder.

**Descoberta importante**: a tabela `public.avaliacoes` já existia no banco, com 3 registros reais
(`user_email`, `estrelas`, `comentario`, `criado_em`) — aparentemente alimentada pelo app mobile Flutter,
que já tem seu próprio fluxo de avaliação. RLS estava ligado mas sem nenhuma policy, então nem o app web
nem qualquer usuário autenticado conseguia ler ou escrever ali (só service_role). Em vez de criar uma
tabela nova, reaproveitamos a existente: adicionamos as colunas que faltavam para o fluxo de resposta
(`resposta_admin`, `respondido_por`, `respondido_em`), a foreign key `avaliacoes_empresa_id_fkey` (pro
PostgREST conseguir fazer o embed com `empresas`, mesmo padrão já usado em `tickets`), e as 3 policies de
RLS:

- `avaliacoes_insert_proprio`: usuário só insere avaliação em nome do próprio e-mail, e só vinculada a uma
  empresa que ele realmente enxerga (`empresas_do_usuario`) ou sem empresa nenhuma (avaliação "geral").
- `avaliacoes_select`: usuário lê as próprias avaliações (pra ver a resposta do admin); admin lê todas.
- `avaliacoes_update_admin`: só admin escreve `resposta_admin`/`respondido_por`/`respondido_em` — testado
  via simulação de sessão (`set_config('request.jwt.claims', ...)`) confirmando que um usuário comum tenta
  atualizar e a linha simplesmente não muda (RLS filtra silenciosamente), enquanto o admin consegue.

**Tela do cliente** (`/avaliar`, menu "⭐ Avaliar Plataforma"): Logo FNI em destaque no topo (aqui funciona
direto sobre o `.card` branco do dashboard — sem precisar do tratamento de fundo escuro usado em
`/login`/`/mfa-setup`/`/cadastro`, porque o tema deste painel já é claro), seletor de estrelas clicável
(1 a 5, ícone `Star` do `lucide-react`), campo de observações opcional, e — se o cliente pertence a mais de
uma empresa — um seletor pra vincular a avaliação a um cliente específico (reaproveitando
`resolverEmpresaAtual`, já usado em `/assinatura` e `/postos`). Abaixo do formulário, a pessoa vê o
histórico das próprias avaliações e a resposta do admin, se já tiver sido dada.

**Painel do admin** (`/avaliacoes`, menu "Avaliações dos Clientes", com o mesmo guard de acesso de
`/inteligencia-rede` e `/assinaturas`): indicadores de nota média, total de avaliações e pendentes de
resposta; lista de todas as avaliações (nome do cliente via embed com `empresas`, e-mail, estrelas,
comentário, data) com uma caixa de resposta inline por avaliação (`RespostaAvaliacao`, componente client
com `useState`/`useTransition`, mesmo padrão do resto do app). Badge vermelho no item de menu mostra a
quantidade de avaliações sem resposta (`contarAvaliacoesPendentesAcao`, só retorna valor pra admin — mesmo
padrão do badge de Chamados).

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos) e `get_advisors` (nenhum alerta novo — os
avisos existentes são de outras ~12 tabelas do backend mobile/Flutter que já estavam sem policy antes desta
sessão e não fazem parte do escopo do app web).


## Fase 22 — Painel Financeiro do cliente + API de custos externos

Pedido do Daniel: com base em tudo que já existia no app (abastecimentos, manutenções, centros de custo),
um painel financeiro pro cliente. Depois de mapear o que já dava pra calcular com dados existentes,
apresentei a sugestão em blocos (indicadores prontos, planejamento de orçamento, custos fixos externos) e o
Daniel escolheu tudo junto na primeira versão. Em seguida pediu também APIs pra sistemas externos (ERP,
corretora de seguro, rastreador) lançarem os custos fixos direto, sem digitação manual.

**Descoberta importante (mesmo padrão da Fase 21)**: a tabela `public.api_keys` já existia no banco, vazia,
com RLS ligado mas zero policies, e já com as colunas certas pra autenticação de API (`hash_chave`,
`escopos` jsonb, `ativa`, `empresa_id`, `ultimo_uso`, `revogada_em`) — provavelmente preparada em alguma
fase de planejamento anterior e nunca conectada a nada. Reaproveitada em vez de criar uma tabela nova; só
adicionamos as policies de RLS e a foreign key `api_keys_empresa_id_fkey` que faltava (pra manter o arquivo
de tipos fiel ao banco e permitir embeds com `empresas`).

**Schema novo**: `orcamentos` (valor planejado por categoria/centro de custo/mês/ano) e `custos_fixos`
(seguro, IPVA, licenciamento, rastreamento, multa, outro — com campo `origem` distinguindo lançamento
`manual` de `api`). Ambas com RLS completo (select/insert/update/delete) no padrão moderno do projeto
(`empresas_do_usuario` + `perfil_usuario_atual() = 'admin'` + fallback do e-mail do Daniel, só pra
`authenticated`) — testado com simulação de sessão confirmando que inserir na própria empresa funciona e
inserir em empresa de outro cliente é bloqueado pela RLS.

**Duas RPCs novas**: `indicadores_financeiros` (totais do período: combustível, litros, km rodado,
manutenção, custos fixos, custo total, custo por km, orçamento planejado) e
`indicadores_financeiros_evolucao` (série mensal dos últimos meses, pro gráfico). Cuidado técnico
importante: o km rodado não pode ser um `max(hodômetro) - min(hodômetro)` direto quando há várias placas
misturadas — isso mistura hodômetros de veículos diferentes e dá um número sem sentido. As duas RPCs
agrupam por `veiculo_placa` primeiro, calculam a diferença por veículo, e só depois somam — mesmo padrão já
usado na `indicadores_centro_custo` existente. A fonte real de custo de combustível é
`profrotas_abastecimentos` (a tabela `frota_abastecimentos`, com nome parecido, está vazia — confirmado
antes de usar).

**Tela do cliente** (`/financeiro`, menu "💰 Painel Financeiro", visível pro admin também — diferente de
Assinatura/Avaliar, aqui não existe uma página equivalente separada pro admin, e ele pode precisar acessar
pra apoiar um cliente): 4 indicadores no topo (custo total, custo por km, orçamento planejado, saldo do mês
— vermelho se estourou, verde se dentro do previsto), 3 cartões por categoria, gráfico de evolução mensal
empilhado (combustível/manutenção/custos fixos, via `recharts`), tabela de orçamento planejado vs.
realizado por categoria, formulários pra lançar orçamento e custo fixo manualmente, e uma lista dos últimos
custos fixos lançados com selo diferenciando "Integração" (veio pela API) de lançamento manual. O
detalhamento por centro de custo já existe desde a Fase 8 no Dashboard, então o painel financeiro linka pra
lá em vez de duplicar.

**API de custos externos** (`POST /api/integracoes/custos-fixos`): Route Handler autenticado por chave de
API (Bearer token). A chave crua (`fni_cf_...`) só é mostrada uma vez, na hora de gerar — o banco guarda só
o hash SHA-256 (`hash_chave`), nunca o valor cru. No lançamento, a API re-calcula o hash do token recebido,
busca na tabela `api_keys` via `createAdminClient()` (service role, só nesse código de servidor), confere
se está ativa e com o escopo certo, insere o custo fixo já vinculado à empresa dona da chave (`origem:
"api"`) e atualiza `ultimo_uso`. Gestão de chaves ficou em `/integracoes` (mesma página das integrações
PróFrotas já existentes): formulário pra gerar chave por cliente, lista com revogação, e um exemplo de uso
com `curl` documentado na própria tela.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos em todo o projeto), RLS testado por simulação
de sessão para `orcamentos`, `custos_fixos` e `api_keys`, e `get_advisors` sem nenhum alerta novo — os
avisos existentes continuam sendo as mesmas ~12 tabelas do backend mobile sem policy e os avisos genéricos
de `search_path` em funções (agora incluindo as duas RPCs novas, mesmo padrão das funções já existentes,
não é uma categoria nova de problema).

## Fase 22.1 — Relatórios Personalizados ganha fonte "Custos Fixos"

Pergunta do Daniel: já que a tela de Relatórios Personalizados tinha um comentário explícito dizendo que
uma fonte financeira não existia como tabela no banco, e a Fase 22 acabou de criar `custos_fixos`, dava pra
adicionar essa fonte agora? Sim — segue exatamente o mesmo padrão de Abastecimentos e Manutenção.

Nova RPC `relatorio_custos_fixos_bruto(p_empresa_id, p_data_inicio, p_data_fim)`, com `search_path` fixado
(mesmo cuidado das RPCs já existentes de relatório bruto, evita o alerta `function_search_path_mutable`).
Na tela, "💰 Custos Fixos" vira uma terceira opção de fonte com 4 dimensões (período por mês, tipo de custo,
placa, origem — manual ou via integração) e 3 métricas (valor total, valor médio, nº de lançamentos),
reaproveitando os rótulos de `TIPO_CUSTO_FIXO_LABEL` já criados em `src/lib/financeiro.ts` na Fase 22.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos) e `get_advisors` sem nenhum alerta novo.

## Fase 23.2 — Editar/excluir orçamento e custo fixo direto na tabela

Pedido do Daniel: poder editar ou excluir um lançamento de orçamento ou custo fixo sem precisar apagar e
relançar do zero, com o restante do Painel Financeiro (indicadores, gráfico) se ajustando automaticamente
depois — igual já acontecia ao criar um lançamento novo.

- `financeiro/actions.ts` ganhou `atualizarOrcamentoAcao(id, valorPlanejado, observacoes)` e
  `atualizarCustoFixoAcao(id, campos)` — updates diretos por `id` (diferente de `salvarOrcamentoAcao`, que
  faz upsert por categoria/centro/mês/ano porque ainda não sabe se a linha existe). Ambas chamam
  `revalidatePath("/financeiro")`, mesmo padrão das actions de criar/excluir — é isso que faz os
  indicadores e o gráfico recarregarem sozinhos depois de editar ou excluir, sem precisar de lógica nova de
  refresh no cliente.
- Dois componentes novos com edição/exclusão inline: `_components/TabelaOrcamento.tsx` (permite editar só
  o valor planejado — categoria e centro de custo mudariam a identidade do orçamento, então pra isso o
  usuário lança um orçamento novo no formulário) e `_components/TabelaCustosFixos.tsx` (edita tipo, valor,
  competência, descrição e placa).
- Restrição pedida pelo Daniel: só dá pra editar/excluir custo fixo do **mês vigente** — lançamento de mês
  já fechado fica só leitura, com "Fora do mês vigente" no lugar dos botões. A checagem
  (`custoFixoEditavel` em `page.tsx`) reusa o parse manual de data sem fuso da Fase 23.1, pra não reabrir o
  mesmo bug de mês errado. Orçamento não tem essa restrição porque a query já traz só o mês/ano atuais.
- `financeiro/page.tsx` substituiu as duas tabelas antigas (só leitura) pelos componentes novos, passando
  `id` (que as queries de `orcamentos`/`custos_fixos` agora selecionam) e o `centro_custo_id` de cada custo
  fixo.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos).

**Correção**: a tela mostrou "nenhum dado encontrado" mesmo com custos fixos já lançados. Causa: a janela
padrão de Relatórios Personalizados olha só os últimos 365 dias (retroativa), certa pra abastecimento e
manutenção — que só existem depois de acontecer — mas custo fixo costuma ser lançado com competência
futura (vencimento de seguro/IPVA/licenciamento). Corrigido em `src/app/(dashboard)/relatorios/page.tsx`:
a fonte Custos Fixos passou a usar uma janela de -365 a +365 dias a partir de hoje, só pra ela; as outras
duas fontes continuam olhando só pro passado. Mensagem de "sem dados" também ajustada pra refletir isso.

## Fase 23 — Termo de Adesão eletrônico antes do checkout

Pedido do Daniel: antes de qualquer cliente ir pro checkout do Stripe ao escolher um plano, ele precisa
assinar eletronicamente um Termo de Adesão — e o aceite desse termo já vale como aceite dos Termos de Uso
gerais da plataforma. Depois do pagamento confirmado, o comprovante da adesão deve ser enviado por e-mail.
O texto oficial do termo foi fornecido pelo Daniel (`Termo_Adesao_FNI_Gestao_Frotas.docx`, versão 1.0, na
raiz do projeto).

**Descoberta importante (mesmo padrão das Fases 21/22)**: a tabela `public.termos_aceite` já existia no
banco, com RLS ligado mas zero policies, e já com as colunas certas pro fluxo completo: `hash_termo`,
`versao_termo`, `email`, `plano`, `ip`, `aceito_em`, `empresa_id`, `pagamento_confirmado`,
`stripe_session_id`, `email_enviado`. Reaproveitada em vez de criar uma tabela nova — só adicionamos a
foreign key `termos_aceite_empresa_id_fkey` (faltava) e uma policy de `select` (usuário lê o aceite da
própria empresa/grupo econômico, ou admin lê tudo). De propósito **não** existe policy de insert/update pra
`authenticated`: hash, versão e IP têm que ser calculados no servidor, nunca aceitos prontos do client, então
a escrita é sempre via Edge Function com service role.

Também descobrimos que `empresas.termo_aceito_em`/`termo_aceito_por` já existiam no schema desde o
`/cadastro` (Fase 20), mas nunca eram preenchidos por nenhum código — são populados agora, de brinde,
sempre que um Termo de Adesão é aceito.

**Texto do termo**: centralizado em `src/lib/termoAdesao.ts` (`TERMO_ADESAO_PARAGRAFOS`), usado tanto no
modal de aceite quanto no PDF gerado. O hash SHA-256 desse texto (`HASH_TERMO_ADESAO`) foi calculado uma
vez e está hardcoded — de forma idêntica — nas duas Edge Functions envolvidas (`create-checkout-session` e
`stripe-webhook`), porque Edge Functions do Supabase são deployadas separadamente e não importam arquivos
do Next.js. Se o texto do termo mudar no futuro, é preciso: mudar `VERSAO_TERMO_ADESAO`, recalcular o hash
e atualizar os 3 lugares (documentado em comentário em cada um).

**Fluxo do aceite** (`/assinatura`, componente `BotaoAssinarPlano` + `ModalTermoAdesao`): ao clicar em
"Assinar {plano}", abre um modal com o texto completo do termo (scrollável) e um checkbox — só habilita o
botão "Aceito os Termos de Adesão" depois de marcado. Ao confirmar:

1. Chama `create-checkout-session` já com `aceite_termo: true`. A function recusa (400) se esse campo não
   vier `true`. Com o aceite confirmado, ela grava uma linha em `termos_aceite` (hash e versão fixos no
   código do servidor, IP capturado do header `x-forwarded-for`), popula
   `empresas.termo_aceito_em/termo_aceito_por`, e só então cria a sessão do Stripe — com `termo_id` no
   `metadata` da sessão e da assinatura, pra o webhook conseguir linkar depois.
2. No navegador, gera um comprovante em PDF personalizado (`TermoAdesaoPdf`, via `@react-pdf/renderer`,
   mesmo padrão usado em Rotograma/Roteirização/Relatórios) com uma "capa" contendo razão social, CNPJ,
   e-mail, plano, data/hora, IP, versão e hash do termo — seguida do texto integral do termo.
3. Sobe esse PDF pro bucket privado `termos-adesao` (Storage), no caminho `{empresa_id}/{termo_id}.pdf`.
4. Só depois do upload confirmado, redireciona pro Stripe. Se o upload falhar, mostra erro e não redireciona
   — fica um checkout/termo órfão no Stripe sem cobrança nenhuma (inofensivo; o cliente tenta de novo).

**Bucket `termos-adesao`**: privado, com policies de `insert`/`select` restritas à pasta da própria empresa
(mesmo padrão de pasta-por-dono já usado em `ticket-anexos`) — sem `update`/`delete` pra `authenticated`
(comprovante é imutável depois de gerado).

**E-mail pós-pagamento** (`stripe-webhook`, case `checkout.session.completed`): depois de ativar o plano em
`empresas` (lógica que já existia), lê o `termo_id` do metadata da sessão, baixa o PDF do Storage com
service role, converte pra base64 e manda por e-mail via Resend — reaproveitando o helper `enviarEmail` já
usado em `email-trials`, estendido com suporte a `attachments` (não existia em nenhuma Edge Function do
projeto até agora). Atualiza `termos_aceite` com `pagamento_confirmado`, `stripe_session_id` e
`email_enviado`. Se o PDF não for encontrado no Storage por algum motivo, o e-mail ainda é enviado (sem
anexo) e o plano é ativado normalmente — o envio do comprovante nunca bloqueia a ativação do plano.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos), RLS testado por simulação de sessão —
inclusive um caso em que a princípio parecia um vazamento (usuário via linha de outra empresa), mas era o
comportamento correto: as duas empresas de teste pertencem ao mesmo Grupo Econômico (Fase 1), então
`empresas_do_usuario` legitimamente devolve as duas — refeito o teste com uma terceira empresa sem nenhum
vínculo, confirmando bloqueio de leitura/escrita cruzada tanto em `termos_aceite` quanto no bucket
`termos-adesao`. `get_advisors` sem nenhum alerta novo.

## Fase 23.1 — Correções no Painel Financeiro (fuso de datas e realizado por centro de custo)

Dois bugs reportados pelo Daniel depois de usar a tela:

**1) Meses errados no gráfico "Evolução mensal"**: a barra rotulada "mai. de 26" era, na verdade, dado de
junho, e "jun. de 26" era dado de julho (mês vigente). Causa: `mes` (e `competencia`, na tabela de custos
fixos) são colunas `date` do Postgres — chegam do Supabase como string pura `"2026-07-01"`, sem hora nem
fuso. `new Date("2026-07-01")` interpreta isso como meia-noite UTC; ao formatar de volta com
`toLocaleDateString` num fuso atrás de UTC (o caso de produção, `America/Sao_Paulo`, UTC-3), o horário vira
"30/06 21:00" e mostra o mês anterior. Corrigido com duas funções novas em `src/lib/financeiro.ts`
(`formatarDataSemFuso`, `formatarMesAnoSemFuso`) que parseiam a string `"AAAA-MM-DD"` na mão, sem nunca
passar por `Date`/fuso — usadas no gráfico e na coluna "Competência" da tabela de custos fixos. As outras
datas do app (`criado_em`, `trial_ends_at`, `periodo_inicio/fim` etc.) são `timestamp with time zone`, não
`date` — essas não têm esse problema e não foram tocadas.

**2) "Realizado" errado na tabela "Orçamento do mês por categoria" quando o orçamento é de um centro de
custo específico**: a tela tinha 6 orçamentos de combustível, um pra cada centro de custo (CONEN, GTE, MG,
REDE, SP, SUL), mas a tabela não mostrava qual centro era qual (parecia "Combustível" repetido 6 vezes) e
usava sempre o total de combustível da empresa inteira como "Realizado" — errado pra orçamento de um centro
específico. Corrigido em duas partes:

- Nova RPC `indicadores_financeiros_por_centro_custo(p_empresa_id, p_data_inicio, p_data_fim)`, mesmo
  padrão de junção por veículo→centro (via `centros_custo_veiculos`, com vigência por data) já usado em
  `indicadores_centro_custo` (Fase 8), estendida com `custos_fixos` (que já guarda `centro_custo_id`
  direto na linha, sem precisar de join por veículo).
- `financeiro/page.tsx`: nova coluna "Centro de custo" na tabela; `realizado` agora é calculado por
  `realizadoDoOrcamento()` — se o orçamento tem `centro_custo_id`, usa o indicador daquele centro
  específico (RPC nova); se não tem (orçamento "geral", pra frota inteira), usa o indicador da empresa
  inteira como antes.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos) e `get_advisors` sem nenhum alerta novo.

## Fase 23.2 — Editar/excluir orçamento e custo fixo direto na tabela

Pedido do Daniel: poder editar ou excluir um lançamento de orçamento ou custo fixo sem precisar apagar e
relançar do zero, com o restante do Painel Financeiro (indicadores, gráfico) se ajustando automaticamente
depois — igual já acontecia ao criar um lançamento novo.

- `financeiro/actions.ts` ganhou `atualizarOrcamentoAcao(id, valorPlanejado, observacoes)` e
  `atualizarCustoFixoAcao(id, campos)` — updates diretos por `id` (diferente de `salvarOrcamentoAcao`, que
  faz upsert por categoria/centro/mês/ano porque ainda não sabe se a linha existe). Ambas chamam
  `revalidatePath("/financeiro")`, mesmo padrão das actions de criar/excluir — é isso que faz os
  indicadores e o gráfico recarregarem sozinhos depois de editar ou excluir, sem precisar de lógica nova de
  refresh no cliente.
- Dois componentes novos com edição/exclusão inline: `_components/TabelaOrcamento.tsx` (permite editar só
  o valor planejado — categoria e centro de custo mudariam a identidade do orçamento, então pra isso o
  usuário lança um orçamento novo no formulário) e `_components/TabelaCustosFixos.tsx` (edita tipo, valor,
  competência, descrição e placa).
- Restrição pedida pelo Daniel: só dá pra editar/excluir custo fixo do **mês vigente** — lançamento de mês
  já fechado fica só leitura, com "Fora do mês vigente" no lugar dos botões. A checagem
  (`custoFixoEditavel` em `page.tsx`) reusa o parse manual de data sem fuso da Fase 23.1, pra não reabrir o
  mesmo bug de mês errado. Orçamento não tem essa restrição porque a query já traz só o mês/ano atuais.
- `financeiro/page.tsx` substituiu as duas tabelas antigas (só leitura) pelos componentes novos, passando
  `id` (que as queries de `orcamentos`/`custos_fixos` agora selecionam) e o `centro_custo_id` de cada custo
  fixo.

Validado com `npx tsc --noEmit` e `npx eslint` (ambos limpos).

## Fase 23.3 — Sincronizar preços dos planos após alteração no Stripe

Daniel atualizou o preço dos 3 planos no Stripe (Básico R$49, Profissional R$99, Enterprise R$129/mês —
antes eram R$149/R$349/R$899) e a tela "Minha Assinatura" continuava mostrando os valores antigos.

Como `Price` no Stripe é imutável (não dá pra editar o valor de um preço já criado — é preciso criar um
`Price` novo e apontar o produto pra ele, arquivando o antigo), a mudança feita no painel do Stripe não
tinha criado, de fato, um novo `Price` vinculado aos produtos — confirmado consultando a API do Stripe
direto (via `pg_net`, que já estava disponível no projeto) antes de mexer em qualquer coisa. Depois de
confirmar com o Daniel os 3 valores novos, foram criados os `Price` novos (mensal, BRL) via Stripe API,
definidos como `default_price` de cada produto, e os `Price` antigos foram desativados (assinantes já
existentes continuam no valor contratado — desativar um preço não afeta assinaturas em andamento, só
impede que ele seja usado em novos checkouts).

Os 3 `price_id` novos precisaram ser atualizados manualmente em três lugares que mantêm o mesmo mapa
plano→price (decisão original da Fase 20, documentada lá): `planos-precos/index.ts`,
`create-checkout-session/index.ts` (mapa direto) e `stripe-webhook/index.ts` (mapa invertido, usado no
evento `customer.subscription.updated`). Nenhum código do Next.js precisou mudar — `/assinatura` já busca
o preço ao vivo do Stripe via `buscarPrecosPlanos()` (Fase 20), com 5 min de cache.

## Fase 24 — Assistente de Onboarding

Pedido do Daniel: um assistente que orienta o usuário no primeiro acesso e que pode ser chamado a qualquer
momento, com informações contextuais em cada indicador, painel e botão não óbvio da plataforma. Depois de
alinhar o formato com ele (tour guiado + ícones de ajuda, sem IA — textos fixos, carregam instantâneo e sem
custo de API — cobrindo o sistema inteiro nesta rodada), a implementação ficou em duas camadas:

**Tour guiado de boas-vindas** — dispara sozinho no primeiro login (`usuarios_app.tour_onboarding_visto`, uma
coluna nova) e pode ser reaberto a qualquer momento pelo botão "🎓 Central de Ajuda" no rodapé do menu
lateral. Fica restrito a elementos da barra lateral (sempre visíveis, em qualquer tela) — `TourProvider` +
`TourOverlay` (`src/components/ajuda/`) desenham um "spotlight" ao redor do item atual (`box-shadow` gigante,
sem precisar de SVG mask) com um balão explicativo ao lado. Os passos ficam em `src/lib/ajuda/tourPassos.ts`.
Marcar o tour como visto passa pela RPC `marcar_tour_onboarding_visto()` (`SECURITY DEFINER`, só atualiza a
própria linha do usuário pelo e-mail do JWT — não existe policy de `UPDATE` aberta pro usuário comum em
`usuarios_app`, de propósito, então uma function bem restrita evita ter que abrir uma policy ampla só por
causa dessa flag).

**Ícones de ajuda contextual** — um `?` reutilizável (`src/components/ajuda/AjudaIcon.tsx`) ao lado de
indicadores, painéis e botões menos óbvios; ao clicar, mostra um popover com o que aquele número significa e
como é calculado. Todo o texto vive centralizado em `src/lib/ajuda/conteudo.ts` (dicionário chave → título +
explicação), referenciado pelas telas via `<AjudaIcon chave="dashboard.custo_por_km" />` — centralizar evita
duplicar texto pela JSX de cada página e deixa fácil rever/estender tudo de uma vez só. Aplicado em:
Dashboard e Financeiro (cobertura completa — todo indicador e painel); Centros de Custo, Manutenção
Preditiva, Postos (3 abas), Relatórios (5 abas — `AbasPainel` ganhou um `ajudaChave` opcional por aba),
Roteirização, Rotograma, Assinatura, Chamados, Avaliações e Inteligência de Rede; e cobertura leve (um ícone
de página, explicando o propósito da tela) em Veículos, Motoristas, Usuários, Clientes, Grupo Econômico,
Integrações e Assistente FNI. Novos indicadores/telas no futuro só precisam de uma entrada no dicionário +
um `<AjudaIcon chave="..." />` — o padrão já está montado.

Validado com `npx tsc --noEmit` e `npx eslint .` (projeto inteiro, ambos limpos) e `get_advisors` — a nova
RPC aparece no mesmo grupo de avisos que `perfil_usuario_atual`/`empresas_do_usuario` (SECURITY DEFINER
chamável por `anon`/`authenticated`), padrão já estabelecido no projeto pra functions auto-escopadas ao
próprio usuário; nenhum alerta novo além desse.

## Fase 25 — Hub de Integrações (ingestão de pagamentos + APIs de cadastro)

Pedido do Daniel: a FNI vai virar um hub de gestão de frotas recebendo dados de várias modalidades de
pagamento conectadas (cartão combustível, pedágio, manutenção de diferentes provedores) e, do lado dos
cadastros (veículos, motoristas, centros de custo, postos, usuários), expor APIs pra sistemas externos
consultarem. Depois de alinhar com ele (confirmado: sim é isso; direção da API de cadastro é FNI expondo
leitura, não consumindo de fora; todos os 5 cadastros de uma vez; construir o que der, não só planejar),
ficou pronto:

**Ingestão de pagamentos** — extensão do padrão já existente desde a Fase 22 (custos fixos via API). Criada
a tabela `abastecimentos_externos`, desacoplada de qualquer provedor específico (ao contrário de
`profrotas_abastecimentos`, que é moldada no formato de dado da PróFrotas) — cada provedor manda os campos
que tem (placa, data, litros, valor, posto, `transacao_externa_id` pra evitar duplicidade em reenvios: índice
único `(empresa_id, provedor, transacao_externa_id)`, e reenvio do mesmo evento responde 200 "já existia" em
vez de erro). `custos_fixos` ganhou o tipo `pedagio`; `manutencoes_realizadas` ganhou a coluna `origem`
(`manual` ou `api`) pra diferenciar lançamento manual de integração. As funções de indicadores financeiros
(`indicadores_financeiros` e `indicadores_financeiros_evolucao`) foram reescritas pra somar
`profrotas_abastecimentos` + `abastecimentos_externos` juntos (testado direto no banco antes e depois da
mudança, com dado real, pra garantir que o resultado não mudou) — a unificação dos provedores acontece nessa
camada, então o Dashboard/Financeiro não precisam saber de onde veio cada abastecimento.

**APIs de leitura dos cadastros** — 5 endpoints novos (`GET /api/cadastros/veiculos`, `/motoristas`,
`/centros-custo`, `/postos`, `/usuarios`), todos paginados (`limit`/`offset`, padrão 100, máximo 500) e
sempre filtrados pela empresa dona da chave — nunca pelo que o cliente pede na URL. O endpoint de usuários
exclui explicitamente `mfa_secret`/`mfa_habilitado` da resposta.

**Autenticação** — o padrão de chave de API (`Authorization: Bearer ...` → hash SHA-256 → busca em
`api_keys` → confere escopo → confere se está ativa) que já existia só pra custos fixos foi extraído pra um
helper único (`src/lib/apiAuth.ts`), reaproveitado pelos 8 endpoints (3 de ingestão + 5 de leitura). Cada
chave agora carrega uma lista de escopos granulares (`custos_fixos:write`, `abastecimentos:write`,
`manutencoes:write`, `veiculos:read`, `motoristas:read`, `centros_custo:read`, `postos:read`,
`usuarios:read`) em vez de dar acesso total — o catálogo de escopos (`CATALOGO_ESCOPOS` em
`src/lib/apiKeys.ts`) é a fonte única usada tanto na validação do servidor quanto no formulário de geração
de chave em `/integracoes`, que agora mostra checkboxes agrupados por categoria (Pagamentos / Cadastros) em
vez de gerar uma chave com acesso implícito a só uma coisa. A lista de chaves existentes passou a mostrar as
permissões de cada uma como badges.

Validado com `npx tsc --noEmit` e `npx eslint .` (projeto inteiro, ambos limpos) e `get_advisors` — nenhum
alerta novo associado às tabelas/functions desta fase (`abastecimentos_externos` tem RLS com policy própria,
igual ao resto do projeto; as duas RPCs reescritas já apareciam no aviso de `search_path` mutável antes da
mudança, não é uma regressão introduzida agora).

## Fase 25.1 — PróFrotas também é "só mais um provedor" (unificação completa dos indicadores)

Observação do Daniel depois da Fase 25: a PróFrotas, que já popula `profrotas_abastecimentos`, também é um
provedor de meio de pagamento — não faz sentido ela ficar "por fora" da unificação. Checando o projeto,
Fase 25 só tinha unificado 2 functions (`indicadores_financeiros` e `indicadores_financeiros_evolucao`);
outras 13 (ranking de veículos/motoristas, eficiência de combustível, consumo diário, padrão por dia da
semana, volume por posto, variação de preço com referência ANP, indicadores por centro de custo, Manutenção
Preditiva e o relatório bruto de abastecimentos, incluindo as duas de inteligência de rede que comparam preço
entre postos) ainda liam só `profrotas_abastecimentos` direto — qualquer cliente que passasse a usar cartão
combustível de outro provedor ficaria com ranking, score de manutenção preditiva e comparação de preço
incompletos, contando só uma parte do consumo real da frota.

Resolvido centralizando a normalização numa view única, `abastecimentos_unificado`, que junta as duas fontes
num formato comum (placa, motorista, data, hodômetro, posto, produto, litros, preço, valor) e vira a fonte de
dado das 15 functions de indicador/relatório que envolvem abastecimento — inclusive as 2 já feitas na Fase
25, reescritas pra usar a mesma view em vez de repetir o `union all` inline. Dois pontos que só a PróFrotas
tinha e o cartão de outro provedor não manda direto (UF e latitude/longitude do posto, usados na comparação
de preço por região e no mapa de postos mais visitados) são preenchidos por um cruzamento com o cadastro de
Postos Revendedores do próprio cliente (`postos_gf`) quando o CNPJ do posto bate — na ausência de cadastro,
ficam em branco, mesma limitação que já existia pra abastecimento sem UF/geolocalização informada.

Ponto de atenção de segurança: a view foi criada com `security_invoker = on` (mesma opção já usada nas
outras views do projeto, `resumo_tele_frota`/`resumo_cargas_pp`/`tele_alertas`) — sem isso, uma view no
Postgres roda com o privilégio de quem criou ela, não de quem consulta, e as políticas de RLS por empresa
deixariam de valer, vazando dado entre clientes. Confirmado com `get_advisors` que não abriu nenhum alerta
novo (e, como efeito colateral positivo, adicionar `search_path` fixo nas 10 functions que reescrevi e não
tinham isso configurado fez 10 avisos pré-existentes de "search_path mutável" desaparecerem da lista).

Validação: como `abastecimentos_externos` ainda estava vazia (nenhuma integração real usando ainda), toda
function reescrita foi comparada contra o cálculo direto na tabela antiga pra garantir resultado idêntico
(testado com duas empresas reais, uma com 148 lançamentos PróFrotas) — e, pra provar que a unificação
funciona de verdade, um lançamento de teste foi inserido em `abastecimentos_externos`, confirmado que
apareceu em `indicador_ranking_veiculos` e nos demais indicadores, e removido em seguida.

## Fase 25.2 — Tour de boas-vindas nascendo cortado fora da tela

Daniel reportou (com print) que o balão do passo 7/7 do tour ("Central de Ajuda") nascia quase todo fora da
tela, só um pedaço visível no rodapé.

Causa: o menu lateral cresceu bastante desde a Fase 24 (seções Cadastros/Operação/Administração ganharam mais
itens) e ficou mais alto que a tela em resoluções menores — a página inteira passou a rolar (não só o menu,
já que `<aside>` não tem `overflow-y`/altura fixa própria). O `TourOverlay` calculava a posição do balão a
partir de `getBoundingClientRect()` do alvo sem nunca rolar a página até ele — se o passo 1 (logo, topo do
menu) ou o passo 7 (Central de Ajuda, rodapé do menu) estivesse fora da área visível no momento em que o tour
abria, o balão nascia posicionado fora da tela.

Corrigido em `TourOverlay.tsx`: a cada passo, chama `el.scrollIntoView({ block: "center" })` antes de medir a
posição, e passou a recalcular também no evento `scroll` (não só `resize`) — cobre tanto a rolagem disparada
pelo próprio `scrollIntoView` quanto qualquer rolagem manual do usuário enquanto o tour está aberto. Também
adicionado um clamp defensivo na altura estimada do balão, pra ele nunca nascer com a borda cortada mesmo
num frame intermediário da rolagem (que é assíncrona).

## Fase 26 — Landing pública + preparação para deploy em produção (Railway + Cloudflare)

Pedido do Daniel: publicar o app em produção no domínio próprio `fxgestaodefrotasonline.com` (já registrado
na Cloudflare), hospedado no Railway, com a raiz do domínio abrindo uma landing de marketing e um botão
levando pro login/cadastro da plataforma.

**Landing portada de outro repositório** — Daniel já tinha uma landing pronta (design completo, com tour de
demonstração animado e i18n PT/EN) num repositório GitHub separado (`dperuffo/estudo-de-rede`, pasta
`landing/`), usada como referência de outro projeto (backend Python + app Flutter que também consomem o
mesmo banco Supabase). Como esse repo não estava clonado localmente, foi buscado via `git fetch` direto da
pasta de referência já presente no projeto (que tinha o `remote` configurado mas nunca tinha sido
efetivamente clonada) e os arquivos HTML foram extraídos com `git show <rev>:<caminho>` (sem precisar dar
`checkout`, que exigiria escrever no índice do git — relevante porque essa pasta de referência tinha ficado
com um `index.lock` travado de uma tentativa anterior que não dá pra apagar, mesma limitação de escrita
descrita abaixo).

A landing (`index.html`, ~800 linhas, CSS e JS inline, sem dependências externas além do Google Fonts) virou
a rota `/` do Next.js — `src/app/page.tsx` faz só o roteamento (usuário já logado pula direto pro
`/dashboard`, senão renderiza o conteúdo) e o HTML em si mora em `src/app/_landing/landingBody.ts`, injetado
via `dangerouslySetInnerHTML`. Decisão deliberada de não reescrever a página inteira em JSX: ela não tem
nenhuma interação que dependa de React (toda a troca de aba do demo e de idioma PT/EN é vanilla JS
autocontido), reescrever centenas de atributos `style=""` em objetos JSX seria trabalho enorme sem ganho real
e com risco alto de quebrar detalhe visual. O `<script>` embutido funciona normalmente porque a ressalva de
"`innerHTML` não executa `<script>`" vale só pra HTML setado via JS depois que a página já carregou — aqui o
HTML faz parte da resposta inicial do servidor (Server Component), que o navegador sempre parseia (e executa
scripts) normalmente, igual um HTML estático comum. As páginas `/termos`, `/privacidade`, `/sobre` (+
variantes `-en`) vieram do mesmo repositório e seguiram o mesmo padrão, uma por rota, com um script inline
que redireciona pra variante do idioma salvo em `localStorage` (mesmo mecanismo que a landing original já
usava).

Ajustes de conteúdo ao portar: os links que apontavam pra `https://app.fxgestaodefrotasonline.com` viraram
`/login` (Acessar Plataforma) ou `/cadastro` (todo CTA de "começar"), já que agora landing e app dividem o
mesmo domínio. Os links pra `termos.html`/`privacidade.html`/`sobre.html` viraram rotas limpas. Os preços da
seção de planos estavam desatualizados (Básico R$149, Profissional R$349, Enterprise "Sob consulta") —
atualizados pra bater com o Stripe real (Fase 23.3: R$49/R$99/R$129), inclusive no dicionário de i18n (o
script de troca de idioma reaplica os textos no carregamento, então só editar o HTML não bastava). O card
"Gratuito" foi mantido de propósito (Daniel confirmou) — ele reflete o plano `gratuito` real do trial
self-service (1 usuário, 10 veículos, ver `LIMITES_PLANO` em `src/lib/constants.ts`), não um valor
inventado.

**Middleware** — `/` virou rota pública (antes, um visitante anônimo era redirecionado direto pro `/login`
pelo middleware antes mesmo do `page.tsx` rodar); `/termos`, `/privacidade`, `/sobre` e as variantes `-en`
também. Comparação exata de path (não `startsWith`) pra `"/"` não engolir sem querer nenhuma outra rota.

**Preparação para Railway** — `railway.json` novo na raiz (build/start explícitos, Nixpacks detecta Next.js
automaticamente mas deixar explícito facilita reproduzir). O cron horário de sincronização PróFrotas
(`vercel.json`, que o Railway não lê) tem substituto documentado via `pg_cron` + `pg_net` (a extensão já
usada no projeto pra chamadas HTTP de dentro do Postgres) — aplicado depois que o domínio estiver no ar e o
`CRON_SECRET` definido, não antes, pra não criar um job agendado apontando pra uma URL que ainda não existe.
Guia completo passo a passo (GitHub, Railway, variáveis de ambiente, domínio customizado na Cloudflare,
configuração do Supabase Auth pro novo domínio, checklist final) em `DEPLOY.md`, na raiz do projeto.

**Limitação encontrada nesta fase**: tentei inicializar o repositório git direto na pasta do projeto pelo meu
ambiente sandbox e esbarrei numa trava de permissão — o processo do git escreve um arquivo de lock temporário
e não consegue apagá-lo depois (mesma restrição que já impede `rm`/`Edit`/`Write` direto nessa pasta montada,
contornada até agora só pra edição de arquivo com heredoc; não existe contorno equivalente pro ciclo de vida
de lock do git). O `.gitignore` foi validado (`git add -A` funcionou e listou exatamente os 303 arquivos de
código esperados, nada de `node_modules`/`.next`/segredos), mas o `git init` + primeiro commit + push
precisam ser rodados pelo próprio Daniel no Terminal do Mac dele — documentado passo a passo no `DEPLOY.md`.

Validado com `npx tsc --noEmit` e `npx eslint .` (projeto inteiro, ambos limpos). `next build` de produção
completo não coube no limite de tempo do sandbox usado pra essa validação (~45s por comando, insuficiente pra
esse projeto) — o build real vai rodar no próprio Railway durante o deploy, que é a confirmação definitiva.


## Fase 27 — Permissões por Perfil: trava de segurança (admin oculto para não-admins)

Achado real, reportado pelo Daniel: qualquer usuário autenticado (gestor_frota, analista, posto)
conseguia ver a tela `/permissoes` inteira, incluindo a coluna do Administrador — a leitura da
tabela `permissoes_perfil` estava com uma policy de SELECT totalmente aberta (`qual = true`). A
escrita já era protegida (só admin conseguia alterar), mas a visualização não.

Correção (via Supabase MCP, `project_id nedthbeekvwzcjrhsghp`):

- Criada `nivel_perfil(perfil text) returns int` — mapeia cada perfil pra um peso (admin=4,
  gestor_frota=3, analista=2, posto=1).
- Policies de SELECT e escrita da tabela `permissoes_perfil` passaram a exigir
  `nivel_perfil(perfil) <= nivel_perfil(perfil_usuario_atual())` — cada perfil só enxerga (e edita)
  perfis do próprio nível pra baixo, nunca acima. Um gestor_frota nunca mais vê nem altera a linha
  do Administrador.
- `src/app/(dashboard)/permissoes/page.tsx` — só desenha as colunas que o usuário logado tem
  direito de ver (reflexo em tela da mesma regra do banco), com aviso explicando a restrição pra
  quem não é admin.

## Fase 27.1 — Permissões por Perfil: escopo por cliente (empresa)

Extensão da Fase 27: além de travar por nível de perfil, as permissões passam a ser por cliente
(empresa) em vez de um único conjunto global pra todo o sistema — pedido do Daniel: um
gestor_frota só deve gerenciar permissões relevantes ao próprio cliente, nunca as de outra
empresa.

Modelo escolhido — **padrão + override**, em vez de duplicar linhas em toda empresa existente:

- `permissoes_perfil` ganhou a coluna `empresa_id uuid not null default '00000000-0000-0000-0000-000000000000'`
  (constante `EMPRESA_ID_GLOBAL` em `src/lib/constants.ts`). O valor sentinela representa o
  **padrão global** do sistema, gerenciado só pelo admin — todas as 104 linhas existentes
  migraram automaticamente pra esse valor (nenhum dado mudou de comportamento).
- Sentinela em vez de `NULL` foi escolha deliberada: `UNIQUE` com `NULL` permite múltiplas linhas
  "iguais" (Postgres trata `NULL` como distinto de si mesmo), o que quebraria o `upsert`
  (`ON CONFLICT`) do Supabase JS — ele não suporta index parcial como alvo de conflito. Com um
  valor fixo não nulo, um único `UNIQUE (funcionalidade, perfil, empresa_id)` resolve tudo de
  forma simples e compatível com upsert (testado ao vivo: insert de uma linha da empresa seed,
  sem colidir com a linha global equivalente, depois removida — ver regressão abaixo).
- Policies de SELECT/escrita: admin continua vendo/editando tudo; os demais perfis só enxergam e
  só escrevem em linhas onde `empresa_id` é o padrão global (somente leitura) ou é uma das
  empresas do próprio usuário (`empresas_do_usuario`, mesma função já usada em `veiculos`,
  `motoristas`, `centros_custo`) — nunca a linha global, que continua exclusiva do admin.
- `src/app/(dashboard)/permissoes/page.tsx` — passou a usar `resolverEmpresaAtual` (mesmo helper
  de `/postos` e do dashboard) pra descobrir a empresa do usuário (com seletor de cliente só
  quando ele está vinculado a mais de uma, ex.: grupo econômico). A matriz exibida mescla o
  padrão global com a customização da empresa selecionada (quando existir), com uma etiqueta
  "Personalizado" indicando que aquela célula tem override próprio. O admin continua editando
  exclusivamente o padrão global nesta tela (sem seletor de cliente pra ele).
- `src/app/(dashboard)/permissoes/actions.ts` e `_components/TogglePermissao.tsx` — passaram a
  receber/enviar `empresaId` explicitamente no upsert (`ON CONFLICT (funcionalidade,perfil,empresa_id)`).
- `src/types/database.types.ts` — campo `empresa_id` adicionado ao tipo de `permissoes_perfil`
  (ajuste manual, mais rápido que regenerar o arquivo inteiro pelo MCP nesse caso).

Regressão testada ao vivo: insert de uma linha `(aba_dashboard, analista, empresa seed)`, confirmado
que não colide com a linha global equivalente (upsert funcionou sem erro), depois removida — a
linha global ficou intacta o tempo todo.

Validado com `npx tsc --noEmit` e `npx eslint .`, ambos limpos, e `get_advisors` (security) sem
nenhum alerta novo relacionado a essa mudança.

## Fase 27.11 — Relatórios Personalizados: exportar em PDF

Pedido do Daniel: além do CSV, a tela "monte o seu relatório" (aba Relatórios Personalizados,
em `/relatorios`) passou a permitir exportar o resultado atual (fonte + dimensão + métrica(s)
escolhidas) em PDF, igual ao Relatório Executivo já fazia.

- `RelatorioPersonalizadoPdf.tsx` (novo) — documento `@react-pdf/renderer` com tabela dinâmica:
  1ª coluna é sempre a dimensão selecionada, as colunas seguintes são as métricas marcadas
  (já formatadas em texto pela tela — mesma formatação usada no CSV) e a última é o total de
  registros por grupo. Não tenta reproduzir o gráfico (recharts não renderiza dentro do
  `@react-pdf/renderer`) — só a tabela, mesmo escopo que já vale pro CSV.
- `BotaoBaixarPdfPersonalizado.tsx` + `BotaoBaixarPdfPersonalizadoLazy.tsx` (novos) — mesmo padrão
  de `BotaoBaixarPdfExecutivo(Lazy).tsx`: o botão real usa `PDFDownloadLink`, que só funciona no
  client (Canvas/Blob do navegador), então é carregado via `next/dynamic` com `ssr: false`.
- `RelatoriosPersonalizados.tsx` — ganhou a prop `nomeEmpresa` (repassada de `nomeEmpresaSelecionada`
  em `page.tsx`) e o botão "📄 Exportar PDF" ao lado do "⬇️ Exportar CSV", montando as colunas/linhas
  do PDF a partir do mesmo `resultado` já calculado pra tela e pro CSV — não há uma segunda consulta
  nem lógica de agregação duplicada.

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos tocados, ambos limpos.

## Fase 27.12 — Paginação nas telas com muitos registros

Pedido do Daniel: telas de listagem que podem crescer muito (Abastecimentos, Veículos,
Motoristas, Chamados) ganharam paginação em vez de mostrar a lista inteira numa página só.

- `src/components/Paginacao.tsx` (novo) — componente compartilhado (Server Component, sem
  estado/client): mostra "Mostrando X–Y de Z registros", botões Anterior/Próxima e os números de
  página (1 … atual-1, atual, atual+1 … última), sempre preservando os filtros já ativos na URL
  (busca, datas, cliente, status etc.). Junto vêm dois helpers: `calcularPaginacao` (decide a
  página/offset finais já dentro dos limites, a partir do total de registros) e `offsetDaPagina`
  (calcula só o offset, usado antes de saber o total — as consultas de contagem e de página rodam
  em paralelo).
- **Abastecimentos** e **Motoristas** — paginação de verdade no banco via `.range()`: a tabela só
  busca os ~30 registros da página atual. Como os KPIs de topo (litros/valor/custo médio em
  Abastecimentos; total/ativos/inativos em Motoristas) precisam refletir o resultado inteiro
  filtrado — não só a página visível — eles continuam vindo de consultas de contagem/agregação à
  parte (mesmo padrão que Motoristas já usava desde a Fase 27.5 pros totais gerais).
- **Veículos** e **Chamados** — paginação em memória: as duas telas já buscavam a lista inteira de
  uma vez (RPC sem range, no caso de Veículos; e a busca de Chamados é sobre uma base
  tipicamente pequena), então a mudança foi só fatiar o array já carregado na hora de renderizar a
  tabela, sem alterar as consultas existentes. Os indicadores de topo continuam somando sobre a
  lista inteira filtrada, só a tabela é que mostra 30 por vez.
- 30 registros por página em todas as quatro telas (`POR_PAGINA`, constante local em cada
  arquivo — mesmo valor, mas duplicada por página, seguindo a convenção já usada no projeto de
  não criar uma config global pra isso).

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos tocados, ambos limpos.

## Fase 27.13 — Tela de Privacidade / LGPD (revogação de consentimento e exclusão de dados)

Pedido do Daniel: ler as tabelas de LGPD já existentes no banco e criar uma tela com o mecanismo
de revogação de consentimento pelo usuário e o tratamento de dados conforme a LGPD.

- `lgpd_consents` e `lgpd_exclusoes` — igual a `termos_aceite` (Fase 23) e `manutencoes_realizadas`
  (Fase 8), já existiam no banco compartilhado com RLS **ligado mas sem nenhuma policy** (só
  `service_role` conseguia ler/escrever) e nenhuma tela usando elas. Adicionadas as policies
  (migração `rls_lgpd_consents_e_exclusoes`): cada usuário só enxerga e só cria registros com o
  próprio e-mail (do JWT); marcar uma exclusão como "executada" é ação exclusiva do admin.
- `src/app/(dashboard)/lgpd/page.tsx` (nova tela, rota `/lgpd`, menu "🔒 Privacidade (LGPD)", visível pra
  todos os perfis) — pra usuários comuns, mostra: **dados cadastrais** (nome, e-mail, CPF, telefone,
  cliente vinculado, MFA — direito de acesso, art. 18 I), **histórico de consentimento**
  (`lgpd_consents`, mais recente primeiro), **revogar consentimento** (botão que insere um novo
  registro em `lgpd_consents` com `tipo: "revogacao"` — art. 8º §5º) e **solicitar exclusão dos
  meus dados** (formulário que insere em `lgpd_exclusoes` com `status: "pendente"` — direito ao
  esquecimento, art. 18 VI). Pro admin (time interno FNI, que não é um cliente/tenant), a tela
  mostra em vez disso um painel com as solicitações de exclusão de **todos** os clientes, com botão
  "Marcar como executada".
- **Por que a exclusão não é automática**: uma solicitação de exclusão fica com `status: "pendente"`
  até um admin revisar e executar manualmente — não existe uma rotina que apague dados sozinha.
  Decisão deliberada: um SaaS multi-tenant de frotas tem obrigações contratuais e legais de retenção
  (nota fiscal, faturamento, prazo mínimo de guarda de log) que precisam ser conferidas antes de
  apagar qualquer coisa, e um clique indevido não pode apagar dados de um cliente inteiro sem
  revisão humana. `solicitarExclusaoDados` também bloqueia solicitações duplicadas (já existe uma
  pendente pro mesmo e-mail/empresa).
- `src/types/database.types.ts` — `lgpd_consents` e `lgpd_exclusoes` adicionadas manualmente ao tipo
  (mesma abordagem já usada antes nesse arquivo, mais rápida que regenerar tudo pelo MCP).
- Texto e direitos citados na tela seguem a Cláusula 10ª do Termo de Adesão
  (`src/lib/termoAdesao.ts`), que já prometia acesso, correção, eliminação, portabilidade e
  revogação — esta tela é o que efetivamente entrega esses mecanismos pro usuário.

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos novos/tocados, ambos limpos, e
`get_advisors` (security) confirmando que as duas tabelas saíram da lista de "RLS enabled, no
policy".

**Correção (mesma fase)**: o diretório inicial da tela era `src/app/(dashboard)/privacidade/`, o
que colidia com a página pública já existente em `src/app/privacidade/page.tsx` (Política de
Privacidade, linkada no rodapé da landing) — `(dashboard)` é um route group e não soma segmento
de URL, então as duas resolviam para `/privacidade` e o build falhava. Renomeado pra
`src/app/(dashboard)/lgpd/` (rota `/lgpd`); `revalidatePath`, o `href` no menu e a chave de ajuda
(`lgpd.pagina`) foram atualizados junto. A página pública de Política de Privacidade não foi
tocada.

## Fase 27.14 — Ícones sugestivos nos itens de menu sem ícone

Pedido do Daniel: colocar ícones sugestivos nas abas do menu lateral, só onde ainda não tinha
(Assistente FNI já usa a logo da FNI como ícone; Minha Assinatura, Avaliar Plataforma, Painel
Financeiro, Privacidade e Chamados já tinham emoji desde antes).

- `src/app/(dashboard)/layout.tsx` — emoji adicionado no início do `label` de cada item que
  ainda estava só com texto: Dashboard 📊; Clientes 🏢; Grupo Econômico 🔗; Usuários 👥;
  Motoristas 🪪; Veículos 🚗; Centros de Custo 🧾; Postos Revendedores ⛽; Abastecimentos 🛢️;
  Roteirização 🗺️; Rotograma 🛡️; Manutenção Preditiva 🔧; Relatórios 📈; Integrações 🔌;
  Permissões por Perfil 🔑; Inteligência de Rede 🌐; Assinaturas (todos os clientes) 💳 (mesmo
  ícone de "Minha Assinatura" — mesmo conceito, visão admin); Avaliações dos Clientes ⭐ (mesmo
  ícone de "Avaliar Plataforma", pelo mesmo motivo).
- Só o `label` de cada item mudou (usado apenas no menu lateral — os `<h1>` de cada página são
  strings independentes, não derivadas desse array) — nenhuma rota, ordem ou lógica de exibição
  foi alterada.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.15 — Alinhamento dos ícones no menu "Visão Geral"

Pedido do Daniel: o texto de "Assistente FNI" estava desalinhado em relação aos outros itens do
menu (Dashboard, Painel Financeiro, Privacidade, Chamados) — a logo da FNI usada como ícone desse
item é bem mais larga que um emoji, então o texto começava mais à direita que os demais.

- `src/app/(dashboard)/layout.tsx` — `menuVisaoGeral` passou a separar `icone`/`label` em vez de
  emoji embutido na string (só esta lista; Cadastros/Operação/Administração não têm esse problema,
  porque não misturam imagem com emoji). No render, todo item (incluindo a logo da Assistente FNI
  e o 🎫 de Chamados, que é renderizado à parte) usa a mesma coluna de largura fixa (`w-6`) antes
  do texto — é essa largura fixa, não o tamanho do ícone em si, que garante que o texto de todo
  mundo comece exatamente no mesmo x. A logo ficou um pouco menor (24×9, hoje ainda reconhecível)
  pra caber bem centralizada nessa coluna.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.16 — Link de confirmação de cadastro caía num erro enganoso de "login com Google"

Achado real: um cliente novo se cadastrou (e-mail/senha), recebeu o e-mail de confirmação, clicou
no link e caiu direto numa tela de erro dizendo "Não foi possível concluir o login com Google.
Verifique se as chaves do Supabase em .env.local estão corretas" — mensagem completamente errada,
já que ele nunca usou Google.

**Causa raiz**: o link de confirmação de cadastro (e o de "esqueci minha senha") apontava pro mesmo
`/auth/callback` que o login com Google usa, que troca um `code` por sessão via
`exchangeCodeForSession` — método PKCE que exige um cookie `code_verifier` salvo no MESMO navegador
que iniciou o pedido. Cliente comum normalmente abre o e-mail de confirmação em outro
navegador/aba/dispositivo (cadastrou no notebook, confirmou pelo Gmail no celular) — o cookie não
existe aí, a troca falha, e o app mostrava o erro genérico de OAuth por engano (as duas coisas
caíam no mesmo `erro=oauth`).

- `src/app/auth/confirm/route.ts` (nova rota) — usa `verifyOtp({ type, token_hash })` em vez de
  `exchangeCodeForSession`. Esse método não depende de cookie nenhum, funciona em qualquer
  navegador/dispositivo — é o padrão recomendado pela própria Supabase pra link de e-mail
  (cadastro/recuperação), reservando o fluxo PKCE de `/auth/callback` só pro OAuth do Google (onde
  o navegador nunca troca, então não tem esse problema).
- `src/lib/supabase/middleware.ts` — `/auth/confirm` adicionada à lista de rotas públicas.
- `src/app/login/page.tsx` — mensagem de erro `erro=oauth` reescrita (sem mencionar `.env.local`,
  que expunha detalhe de implementação pro cliente final) e criado um código novo,
  `erro=confirmacao` ("link expirou ou já foi utilizado"), específico pra falha de
  `/auth/confirm` — antes as duas situações usavam o mesmo texto sobre Google.
- `src/app/esqueci-senha/actions.ts` — `redirectTo` do `resetPasswordForEmail` trocado de
  `/auth/callback?next=/redefinir-senha` pra `/auth/confirm?type=recovery&next=/redefinir-senha`
  (mesmo problema de cross-device se aplica à recuperação de senha).

**Ação manual pendente do Daniel** (Supabase Dashboard → Authentication → Email Templates — não dá
pra editar isso por SQL/MCP): em cada um dos dois templates abaixo, trocar o link
`{{ .ConfirmationURL }}` pelo link explícito indicado. Sem essa troca, o Supabase continua mandando
o link antigo (que ainda passa por `/auth/callback` e tem o bug de cross-device) — o código novo
só entra em uso depois dessa configuração.

- **Confirm signup**: trocar `href="{{ .ConfirmationURL }}"` por
  `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard"`.
- **Reset Password**: trocar `href="{{ .ConfirmationURL }}"` por
  `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha"`.

`/auth/callback` não foi alterado nem removido — continua sendo o caminho correto pro login com
Google (`signInWithOAuth`), que não sofre desse problema.

**Templates com a marca FNI** (pedido do Daniel, mesma fase): os e-mails de "Confirm signup" e
"Reset Password" vinham no template genérico em inglês do Supabase, sem logo nem cor nenhuma da
FNI. `email-templates/confirm-signup.html` e `email-templates/reset-password.html` (novos, na raiz
do repo — não fazem parte do build do Next, são só HTML pra colar no Dashboard) já têm o link
correto de `/auth/confirm` acima embutido, header com a logo (`https://fxgestaodefrotasonline.com/logo-fni.png`
— arquivo estático público, fora do middleware de auth) e a paleta navy/cyan da landing page
(`#04112e`/`#00b4d8`, mesma de `landingBody.ts`, e não a paleta `frota` do dashboard interno — essa
troca é a peça pública/cliente final, então usa a identidade da landing). Basta colar o conteúdo de
cada arquivo no campo de corpo do template correspondente no Dashboard (Subject sugerido: "Confirme
seu e-mail — FNI Gestão de Frotas" e "Redefinir sua senha — FNI Gestão de Frotas").

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.17 — Roteirização utilizável para cliente novo (fallback pra base pública ANP)

Achado real (mesmo cliente novo da Fase 27.16): depois de conseguir entrar, ao tentar usar
Roteirização (planejamento de rota com veículo), o sistema informava "Nenhum posto da rede tem
preço registrado... cadastre preços em Postos Revendedores" — travando a feature por completo.
Investigando: `postos_gf` (a tabela de "postos da rede" de cada cliente) tinha apenas 2.971
linhas, **todas de uma única empresa** (a conta demo/seed) — ou seja, nenhum outro cliente,
incluindo qualquer cliente novo, tinha um único posto próprio cadastrado. Pedido do Daniel: um
cliente novo deveria conseguir rotear usando postos e preços públicos da ANP, sem precisar
primeiro importar a própria rede de relacionamento.

- `src/app/(dashboard)/roteirizacao/actions.ts` (`calcularRoteirizacaoAcao`) — quando a busca em
  `postos_gf` (rede própria do cliente) não encontra NENHUM candidato com preço registrado pro
  combustível escolhido nesse corredor de 5 km, cai automaticamente pra `anp_postos` (base pública
  da ANP, ~35 mil postos com coordenadas, sem `empresa_id` — não é dado de nenhum cliente
  específico) + a estimativa oficial de preço da ANP, resolvida em cascata (município → estado →
  Brasil) da mesma forma que `resolverPrecosVigentes` já faz pra um posto só — só que aqui em lote
  (3 consultas fixas no total, não uma por posto candidato, pra não virar uma consulta por posto
  quando há dezenas/centenas deles no corredor). Cobertura real verificada: nível método só ~7% dos
  municípios, mas nível estado cobre 26-27 dos 27 estados+DF pra quase todos os produtos (GNV é
  exceção, só existe em 17), e nível Brasil sempre tem 1 linha por produto — então a cascata quase
  sempre resolve um preço.
- `ResultadoRoteirizacao` ganhou o campo `usouFallbackAnp: boolean`.
- `FormRoteirizacao.tsx` — quando `usouFallbackAnp` é true, mostra um aviso azul (informativo, não
  de erro — o resultado é válido) explicando que os preços vieram da estimativa ANP, não de um
  preço negociado, e convida a cadastrar os postos do relacionamento em Postos Revendedores pra
  ficar mais preciso da próxima vez. O aviso âmbar de "nenhum candidato encontrado" só aparece
  agora se nem a rede própria NEM a base ANP tiverem candidato — cenário residual.
- Escopo desta correção: só o modo "Roteirização" (planejamento com veículo), que foi o relatado.
  Os modos "Por Rota" e "Por UF/Município" (`calcularRotaEPostosAcao`,
  `buscarPostosPorUfAcao`/`buscarPostoPorTermoAcao`) têm a mesma limitação de dependerem só de
  `postos_gf` e não foram alterados nesta fase.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos, e consulta direta às tabelas
`anp_postos`/`anp_precos_referencia` confirmando cobertura de dados e RLS de leitura pública
(`using (true)`, já existente, não alterado).

## Fase 27.18 — Erro genérico de servidor ao abrir chamado com anexo

Achado real (screenshot: "Application error: a server-side exception has occurred", digest
2760074794), reportado pelo mesmo cliente novo das Fases 27.16/27.17, ao abrir um chamado.

**Causa raiz**: `criarChamadoAcao` (`src/app/(dashboard)/chamados/actions.ts`) já insere o ticket
com sucesso primeiro; só DEPOIS, se um anexo foi selecionado, chama `enviarAnexo` (upload no
Storage + insert em `ticket_anexos`) — mas essa chamada não tinha nenhum `try/catch`. Qualquer
falha nessa etapa opcional (rede, tamanho/tipo de arquivo, o que for) subia como exceção não
tratada e derrubava a Server Action inteira com o erro genérico do Next.js — mesmo o chamado já
tendo sido criado e commitado no banco. O cliente ficava numa tela de erro sem saber se o chamado
existia ou não.

- `criarChamadoAcao` — envio do anexo agora é *best-effort*: envolvido em `try/catch`; se falhar,
  loga o motivo real no servidor e segue o fluxo normalmente (o chamado já existe, isso não muda),
  só acrescentando `?anexoErro=1` no redirect final.
- `src/app/(dashboard)/chamados/[id]/page.tsx` — lê esse parâmetro e mostra um aviso âmbar
  explicando que o chamado foi aberto normalmente mas o anexo não foi salvo, convidando a tentar de
  novo ali mesmo (a tela já tem upload de anexo avulso via `ThreadChamado`/`enviarAnexoAcao`, não
  precisou de nada novo pra isso).
- Verificado também: bucket `ticket-anexos` não tem `file_size_limit`/`allowed_mime_types`
  configurados (sem restrição própria) e as políticas de RLS do Storage pra esse bucket exigem que
  o ticket já exista com o `empresa_id` do usuário — consistente com a policy de `tickets`, sem
  contradição encontrada aí. Não foi possível confirmar a causa exata da falha pontual (sem acesso
  a log de produção), mas o bug real e corrigido é a ausência de tratamento de erro — reproduzível
  com qualquer falha de upload, não só a que esse cliente teve.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.19 — Botão de mostrar/ocultar senha nos campos de senha

Pedido do Daniel: colocar o ícone de "olho" nos campos de senha pra dar pra ver o que foi digitado.

- `src/components/InputSenha.tsx` (novo) — substitui o `<input type="password">` puro por um campo
  com botão de olho (`Eye`/`EyeOff` do `lucide-react`, já usado em `AuthLogoHeader.tsx`) que alterna
  o `type` entre `password` e `text`. Botão com `tabIndex={-1}` pra não interromper a navegação por
  Tab entre os campos do formulário.
- Aplicado nos 5 campos de senha que existem no app — todos em telas de autenticação:
  `login/page.tsx` (senha), `cadastro/page.tsx` (senha e confirmar senha) e
  `redefinir-senha/page.tsx` (nova senha e confirmar nova senha).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.20 — Notificar admin quando um cliente acessa a plataforma (mesmo trial/gratuito)

Pedido do Daniel: "quero que o admin seja notificado quando um cliente entrar na plataforma, mesmo
em período trial/gratuito", depois esclarecido: a notificação deve aparecer como um badge na aba
"Clientes" do menu (mesmo padrão visual já usado em Chamados e Avaliações), não por e-mail.

Investigação inicial: existiam duas tabelas candidatas no banco compartilhado — `logs_acesso` (403
linhas, escritas até 2026-07-02) e `security_logs` (eventos MFA_OK/MFA_FAIL) — mas nenhuma das duas
é escrita por este app (Next.js): são alimentadas pelo sistema Streamlit legado que compartilha o
mesmo banco Supabase (`grep -rn` em `src/` não encontrou nenhuma referência a nenhuma das duas).
Reaproveitar uma tabela escrita por outro sistema, sem controle sobre o formato/consistência dos
dados, seria frágil — por isso optei por uma tabela nova, exclusiva deste app.

- Migração `criar_acessos_clientes` — nova tabela `acessos_clientes` (id, empresa_id FK pra
  `empresas`, user_email, criado_em default `now()`, admin_visto_em nullable — mesmo padrão de
  "visto" já usado em `tickets.admin_visto_em`/`avaliacoes.resposta_admin`). RLS habilitado com 3
  policies: `acessos_clientes_insert_proprio` (insert restrito à própria empresa via
  `empresas_do_usuario`), `acessos_clientes_select_admin` e `acessos_clientes_update_admin` (só
  admin ou o e-mail do Daniel).
- `src/types/database.types.ts` — bloco `acessos_clientes` adicionado manualmente (mesmo estilo já
  usado para `lgpd_consents`/`lgpd_exclusoes`/`termos_aceite`), com Relationships apontando pra
  `empresas`.
- `src/lib/acessosClientes.ts` (novo) — `registrarAcessoCliente(supabase, email)`: resolve o perfil
  do usuário e as empresas dele (`empresas_do_usuario`), e se não for time interno FNI (perfil admin
  ou o e-mail do Daniel) insere uma linha em `acessos_clientes` por empresa vinculada. É
  propositalmente best-effort — qualquer erro (RLS, RPC fora do ar etc.) só é logado no servidor e
  nunca interrompe o login, mesmo raciocínio já aplicado ao envio de anexo na abertura de chamado
  (Fase 27.18).
- Chamada nos dois pontos de entrada de sessão: `src/app/auth/callback/route.ts` (login Google, logo
  após `exchangeCodeForSession` ter sucesso) e `src/app/login/actions.ts`'s `entrarComSenha` (login
  e-mail/senha, logo após `signInWithPassword` ter sucesso).
- `src/app/(dashboard)/clientes/actions.ts` — `contarAcessosClientesNaoVistosAcao()` (conta linhas
  com `admin_visto_em is null`, só retorna algo pra admin — mesmo padrão de
  `contarAvaliacoesPendentesAcao`) e `marcarAcessosClientesVistosAcao()` (marca todas como vistas,
  chamada quando o admin abre `/clientes`).
- `src/app/(dashboard)/layout.tsx` — badge vermelho na aba "Clientes" do menu "Cadastros" quando
  `acessosClientesNaoVistos > 0` — precisou reestruturar o render de `menuCadastros` (que só tinha
  `<Link>{label}</Link>` sem suporte a badge) pro mesmo formato já usado em `menuAdministracao`
  (que já suporta o badge de `/avaliacoes`).
- `src/app/(dashboard)/clientes/page.tsx` — painel "Últimos acessos" (admin-only), lista os 20
  logins mais recentes de clientes (empresa, e-mail, data/hora) abaixo da tabela de clientes. Marca
  tudo como visto (zera o badge) assim que a página é aberta, chamando
  `marcarAcessosClientesVistosAcao()` em paralelo com o carregamento da lista.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.21 — Corrigir bounding box da Roteirização em rotas longas

Depois da Fase 27.17 (fallback ANP pra cliente sem postos próprios), o Daniel reportou que um
cliente novo, mesmo com o fallback ativo (o aviso azul "sua empresa ainda não tem postos próprios"
aparecia normalmente), continuava sem conseguir uma roteirização utilizável — o mapa mostrava a rota
traçada, mas nenhuma parada de abastecimento era sugerida. A hipótese inicial do Daniel foi que o
mecanismo de "Ativar +" da tela `/postos` → "Explorar universo ANP" (que copia um posto ANP pra
`postos_gf` do cliente) estivesse de alguma forma bloqueando o fallback.

Investigação confirmou que essa hipótese **não** era a causa: "Ativar +" só grava em `postos_gf` (a
rede própria do cliente) e não tem nenhuma relação com o fallback ANP, que consulta `anp_postos`
diretamente, sem depender de nenhum vínculo prévio com a empresa — por isso não é a causa e não
precisou de nenhuma mudança para "vir ativo" pra clientes novos (já funcionava assim).

A causa raiz real: `calcularRoteirizacaoAcao` (`roteirizacao/actions.ts`) montava **um único
bounding box**, a partir do menor/maior lat/lon de toda a rota, tanto pra consultar `postos_gf`
quanto (no fallback) `anp_postos` — com `.limit(3000)` e **sem `.order()`**. Numa rota curta isso é
inofensivo, mas na rota de teste do Daniel (norte do Pará até a divisa Tocantins/Bahia, mais de
1.500 km cruzando vários estados) o box vira um retângulo enorme cobrindo boa parte do Brasil — e
sem ordenação por proximidade, o `.limit(3000)` descarta arbitrariamente uma fatia de até 3.000
linhas dentre milhares de candidatos possíveis, sem nenhuma garantia de que os postos realmente
próximos ao corredor da rota (o filtro de `desvioKm <= 5km`, aplicado depois, em memória) estejam
nessa fatia. Resultado: candidatos reais e próximos da rota podiam simplesmente não vir na consulta.

Correção — `src/lib/geo.ts`, nova função `construirBoundingBoxesDaRota(rota, distanciasAcumuladasKm,
margemGraus, passoKm=150, maxSegmentos=20)`: em vez de um box único, divide a polyline da rota em
pedaços de até 150 km (capado a no máximo 20 pedaços, mesmo em rotas gigantes) e devolve um
bounding box por pedaço — cada um naturalmente pequeno, sem risco de esbarrar no limit. Em
`roteirizacao/actions.ts`, tanto a consulta de `postos_gf` quanto a de `anp_postos` (fallback) agora
disparam uma consulta por box (`Promise.all`) e mesclam/deduplicam os resultados por `cnpj` (pedaços
vizinhos podem se sobrepor e retornar o mesmo posto mais de uma vez). Pra rotas curtas o
comportamento não muda (um pedaço só, igual ao box único de antes); pra rotas longas, cada pedaço
fica pequeno o bastante pra nunca perder candidatos reais por causa do limit.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.22 — Crash genérico ao anexar arquivo em chamado (voltou depois da Fase 27.18) + error boundary no dashboard

O Daniel reportou que o crash genérico ("Application error: a server-side exception has occurred...
Digest: 682703709") ao anexar um arquivo num chamado tinha voltado, mesmo depois da Fase 27.18 já
ter corrigido um crash parecido.

Investigação: a Fase 27.18 protegeu só o CONTEÚDO da Server Action — tanto `criarChamadoAcao`
quanto `enviarAnexoAcao` (`chamados/actions.ts`) já tinham (e continuam tendo) try/catch em volta
do upload em si. O problema é anterior a isso, no transporte: quando o arquivo passa do limite de
corpo configurado pras Server Actions (`bodySizeLimit: "25mb"` em `next.config.mjs`) — ou de
qualquer limite imposto por um proxy no meio do caminho —, a própria chamada de rede da Server
Action falha ANTES de a função no servidor chegar a rodar. Essa falha de transporte não é um "erro"
normal devolvido pela action (que o try/catch interno trataria); ela escapa como exceção não tratada
dentro do `startTransition` no componente cliente (`ChamadoForm.tsx`/`ThreadChamado.tsx`), que não
tinha nenhum try/catch em volta da chamada — e, como o app não tinha NENHUM error boundary
(`error.tsx`) em lugar nenhum, o Next só sabia mostrar a página de erro genérica, sem contexto e sem
caminho de volta.

Correção em duas frentes:

- `src/lib/chamados.ts` — nova constante `TAMANHO_MAX_ANEXO_BYTES` (20 MB, com folga em relação ao
  limite real de 25 MB, já que o corpo multipart tem overhead de outros campos do formulário).
- `ChamadoForm.tsx` (abertura de chamado) e `ThreadChamado.tsx` (anexo numa resposta) — validam o
  tamanho do arquivo ANTES de chamar a Server Action, mostrando uma mensagem amigável se passar do
  limite (evita a falha de transporte na maioria dos casos reais); e agora envolvem a própria
  chamada (`await criarChamadoAcao(...)` / `await enviarAnexoAcao(...)`) em try/catch no cliente —
  defesa em profundidade pra qualquer outra falha de rede (proxy, timeout) virar uma mensagem
  amigável em vez de derrubar a página.
- `src/app/(dashboard)/error.tsx` (novo) — primeiro error boundary do app. Intercepta qualquer erro
  não tratado em qualquer página dentro do dashboard e mostra uma tela com explicação simples,
  código do erro (digest, útil se o cliente abrir um chamado sobre isso) e dois caminhos: "Tentar
  novamente" (`reset()`, sem recarregar a página) ou "Voltar ao Dashboard". O menu lateral continua
  visível normalmente, porque o erro só derruba o conteúdo da página — `(dashboard)/layout.tsx`
  (onde vive o menu) fica fora do que quebrou.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.23 — Previsão de consumo sensível demais a um único dia fora do padrão

Pedido do Daniel: revisar o cálculo da "Previsão de consumo" no Dashboard (indicador 2), que soma o
litros já realizado no mês com uma projeção dos dias restantes.

A soma em si (realizado + projetado = total do mês) já estava correta. O problema encontrado foi na
calibração da projeção: `calcularPrevisaoConsumo` (`src/lib/previsaoConsumo.ts`) calculava a
"taxa-base" diária dividindo o total já realizado no mês pela soma dos fatores de sazonalidade (por
dia da semana) desses mesmos dias — e aplicava essa taxa-base igual pra todos os dias restantes do
mês. Isso funciona bem com uma amostra razoável de dias reais, mas no início do mês (poucos dias
reais) fica extremamente sensível a UM dia fora do padrão.

Caso real encontrado (empresa "Frotas & Frotas Ltda", só 3 dias decorridos de julho/2026): um
abastecimento no dia 2 (quinta-feira) somou 376 L, mais de 6x a média histórica daquela
quinta-feira (~60 L, calculada sobre os últimos 90 dias). Como esse dia sozinho domina a soma dos 3
dias reais, a taxa-base calibrada saiu ~50% mais alta do que sairia sem esse dia — e, como a
taxa-base é aplicada nos 28 dias restantes do mês inteiro, a projeção do mês inteiro (e o "Total
estimado do mês") ficou inflada por causa de um único evento pontual.

Correção — `src/lib/previsaoConsumo.ts`: a taxa-base agora é uma mistura (shrinkage) entre a taxa
calibrada só com os dias já reais (`baselineReal`, cálculo antigo) e a média histórica geral (a
mesma base de 90 dias já usada pelos fatores de sazonalidade), com peso crescente pros dias reais
conforme mais dias do mês se acumulam: `peso = diaAtual / (diaAtual + K)`, com `K = 5` (constante
de suavização, documentada e fácil de recalibrar no código se necessário). Na prática: no dia 1-2 do
mês a projeção confia bastante no histórico; por volta do dia 5 real e histórico pesam quase igual;
depois de ~15-20 dias reais, a projeção já reflete quase só a tendência real do mês — sem nunca
ignorar completamente o histórico, o que amortece qualquer dia isolado fora do padrão. No caso real
acima, a projeção do mês caiu de 4.630 L para ~2.494 L (total do mês de 5.293 L para ~3.156 L) —
uma estimativa mais alinhada ao padrão histórico da empresa.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos, e com um teste manual reproduzindo os
números reais do caso encontrado (script descartável, não faz parte do repositório).

## Fase 27.24 — Anexo de chamado ainda falhando (agora sem derrubar a página) + diagnóstico melhor

Depois da Fase 27.22 (que evitou o crash de página inteira), o Daniel testou anexar um arquivo
("olho na senha.png") numa resposta de chamado e recebeu a mensagem amigável "Não foi possível
enviar o anexo. Verifique sua conexão e tente novamente." — ou seja, o crash não voltou (a correção
anterior funcionou), mas o anexo continuava não sendo enviado, e ele confirmou que não era problema
de conexão.

Essa mensagem só aparece quando a própria chamada de rede da Server Action falha (não quando o
Supabase devolve um erro tratável — esse caso já tem sua própria mensagem específica, vinda direto
de `enviarAnexoAcao`). Isso apontava pra uma falha "silenciosa" no transporte, sem detalhe do motivo
real (só logado no console do navegador, que eu não tenho acesso).

Duas correções:

- `src/app/(dashboard)/chamados/actions.ts` — nova função `sanitizarNomeParaStorage`: o nome
  original do arquivo (com espaços, acentos, parênteses etc. — muito comum em screenshots, como
  "olho na senha.png") ia direto pro CAMINHO do objeto no Supabase Storage
  (`${ticketId}/${timestamp}_${nome}`). Esse tipo de caractere no caminho é uma causa plausível de
  falha silenciosa na chamada de upload. Agora o caminho no Storage usa uma versão sanitizada
  (sem acentos, só `a-z A-Z 0-9 . _ -`), enquanto o nome original continua intacto na coluna `nome`
  de `ticket_anexos` — o que aparece pro usuário pra visualizar/baixar não muda.
- `ChamadoForm.tsx` e `ThreadChamado.tsx` — o catch de "defesa em profundidade" da Fase 27.22 agora
  mostra o motivo real do erro (ex.: "Failed to fetch") junto da mensagem, em vez de um texto
  genérico fixo — da próxima vez que algo assim acontecer, a mensagem na tela já basta pra
  diagnosticar, sem precisar pedir print do console do navegador.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.25 — Anexo continuava falhando (crash mascarado de produção) — proteção completa das actions de chamado

Depois da Fase 27.24 (sanitização do nome do arquivo), o anexo continuava falhando — agora com a
mensagem "An error occurred in the Server Components render. The specific message is omitted in
production builds...", o texto genérico que o Next usa em produção pra esconder o erro real. O
Daniel confirmou que não era problema de conexão.

Investigação: consultei os logs do Storage do Supabase (`get_logs`, serviço `storage`) das últimas
24h e não encontrei NENHUM registro de tentativa de upload correspondente a esse anexo — ou seja, a
falha acontecia ANTES da chamada de upload em si, não durante ou depois dela. Isso apontou pra
`resolverPapelAtual` (`chamados/actions.ts`) — chamada por `enviarAnexoAcao`, `comentarAcao` e
`marcarVistoAcao`, faz duas chamadas de rede (`auth.getUser()` e `rpc("perfil_usuario_atual")`) sem
nenhuma proteção. Qualquer falha ali (ex.: uma forma de token/sessão problemática que o cliente
Supabase não devolve como `{error}` normal) escapava sem tratamento, e como isso acontece antes do
`try/catch` que já existia dentro de `enviarAnexoAcao` (que só envolvia o upload em si), a exceção
subia sem ser capturada.

Correção — endurecimento em profundidade, não um ponto único:

- `resolverPapelAtual` agora tem seu próprio try/catch interno — se `getUser()` ou o `rpc()` falhar
  por qualquer motivo, devolve um resultado seguro (`{ email: "", papel: "usuario" }`) em vez de
  propagar a exceção. Como é usada em várias actions e na página do chamado, protege todo mundo de
  uma vez.
- `enviarAnexoAcao` e `comentarAcao` — o try/catch, que antes só envolvia uma parte do corpo (só o
  upload, ou nada), agora envolve a função inteira (criar client, resolver papel, gravar no banco,
  revalidar), convertendo qualquer falha em qualquer etapa numa mensagem normal (`{ erro: ... }`)
  em vez de deixar escapar.
- `ChamadoForm.tsx`/`ThreadChamado.tsx` — a mensagem de erro mostrada agora inclui também o
  "digest" do erro, quando presente (é o único dado que o Next expõe pra um erro mascarado em
  produção) — útil pra correlacionar com os logs do Railway numa próxima ocorrência.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.26 — Crash não diagnosticado em /chamados/novo (medida temporária de diagnóstico)

Um cliente novo (perfil não-admin, 1 empresa vinculada) trava consistentemente em `/chamados/novo`
com o erro genérico mascarado de produção do Next — reproduzível depois de reload, com outro
usuário, e através de vários deploys com código bem diferente entre si (o "digest" do erro se
manteve o mesmo em todas as tentativas, o que sugere que o problema está numa parte do código que
não mudou hoje — `chamados/novo/page.tsx` e `src/lib/empresaAtual.ts` não foram tocados em nenhuma
das Fases anteriores). Verifiquei os logs do Supabase (storage, auth, postgres) das últimas 24h e
não encontrei nenhum registro de erro correspondente, e os dados da cliente de teste (empresa,
vínculo, perfil, fator MFA verificado) estão todos normais via consulta SQL direta — nada aponta
pra uma causa no banco/RLS.

Como a mensagem mascarada da Next não estava ajudando a diagnosticar (e não tenho acesso aos logs
de runtime do Railway), `chamados/novo/page.tsx` agora envolve a busca de dados em try/catch e
mostra o erro REAL (mensagem + stack) numa tela amigável em vez de deixar escapar pro crash
genérico. **Isso é uma medida temporária de diagnóstico, não a correção do bug** — assim que a
próxima ocorrência acontecer, a mensagem vai trazer a causa real, e aí sim dá pra corrigir de
verdade e reverter esse try/catch pra voltar a usar o error boundary padrão (`(dashboard)/error.tsx`
da Fase 27.22).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.27 — Anexo na resposta do chamado: assinatura da Server Action mudada (ticketId embutido no FormData)

Depois de 27.22/27.24/27.25 sem sucesso, o Daniel colou o corpo bruto da resposta de rede da Server
Action (aba Network do navegador):
```
0:{"a":"$@1","f":"","b":"xRb0e2zGmKQ0ZVkPWsDR1"}
1:E{"digest":"4260541496"}
```
Isso confirma que o SERVIDOR recebeu a requisição e devolveu, dentro do protocolo de resposta do
Next (RSC), um objeto de erro (`E{"digest":...}`) — ou seja, a falha acontece dentro da camada do
Next que decodifica/despacha a Server Action, não numa falha de rede/timeout como se pensava antes.

A pista concreta: `enviarAnexoAcao` tinha assinatura `(ticketId: string, formData: FormData)` — dois
argumentos, um deles carregando um `File` — e continuava travando mesmo com TODO o corpo da função
protegido por try/catch (Fase 27.25) e zero rastro de execução (nenhum log no Storage). Isso só faz
sentido se o problema for anterior ao nosso código rodar. Comparando com o fluxo que SEMPRE funcionou
(`criarChamadoAcao(_prev, formData)`, que usa o mesmo `enviarAnexo()` por baixo): lá o primeiro
argumento é sempre `undefined` (padrão de action state), nunca uma string populada.

Correção — `enviarAnexoAcao` agora recebe um único argumento (`formData: FormData`), com o
`ticketId` embutido como campo oculto (`<input type="hidden" name="ticket_id" />`) dentro do próprio
formulário de anexo em `ThreadChamado.tsx`, replicando exatamente o padrão de argumento único que já
funciona em `criarChamadoAcao`.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Ainda precisa de confirmação do
Daniel/cliente testando de novo pra saber se essa era de fato a causa.

## Fase 27.28 — Anexo na resposta do chamado: confirmado que 27.27 não resolveu; nova suspeita (re-render implícito de Server Action) + diagnóstico em `/chamados/[id]`

Daniel confirmou no dia seguinte, após o deploy da Fase 27.27, que o erro persiste ao anexar arquivo
numa resposta de chamado — mesma mensagem mascarada, digest novo (`1836595261`, diferente do
`4260541496` anterior). Os logs de Storage/Postgres do Supabase continuam sem NENHUM registro,
inclusive checando o horário exato informado ("08:47 de 04/07/2026").

Isso descarta (ou pelo menos torna muito improvável) que o problema esteja dentro do corpo de
`enviarAnexoAcao` em si — a função inteira já está protegida por try/catch desde a Fase 27.25, e um
try/catch completo não deixa escapar uma exceção JS como um erro mascarado do Next; ele vira um
retorno normal `{ erro: "..." }`. O fato de a resposta trazer um nó de erro (`E{"digest":...}`) no
protocolo RSC, e não um valor de retorno normal, indica que a exceção não-tratada está acontecendo em
outro lugar do ciclo de vida da requisição.

Nova suspeita: o Next.js, sempre que uma Server Action atualiza cookies (o que acontece
silenciosamente sempre que o Supabase renova o token de sessão dentro de `getUser()`/chamadas RPC),
**re-renderiza automaticamente a rota atual** como parte da própria resposta da action — isso é
documentado e serve pra manter o cache do client em dia. Ou seja: mesmo que `enviarAnexoAcao` termine
sem lançar nada, o Next pode tentar re-renderizar `/chamados/[id]/page.tsx` (a página de onde a ação
foi disparada) por trás dos panos pra montar a resposta — e se ESSA renderização quebrar, o erro
aparece encaixado na resposta da action, não seria fácil de distinguir do erro genérico do
try/catch.

Essa página tinha dois pontos frágeis que nunca tinham sido blindados, porque a suspeita até agora
sempre recaía sobre a própria action:
- Uma ESCRITA no banco (marcar o chamado como "visto") direto no corpo do Server Component, sem
  try/catch — um padrão incomum, já que renderização geralmente deveria ser livre de efeitos
  colaterais, e mais arriscado ainda se essa mesma renderização pode ser disparada mais de uma vez
  (nesse cenário de re-render implícito).
- Um loop de `createSignedUrl` (um por anexo) sem proteção — qualquer anexo com objeto ausente ou
  corrompido no Storage derrubaria a tela inteira.

Correção nesta fase, em `chamados/[id]/page.tsx`:
1. A escrita de "visto" e o loop de `createSignedUrl` agora estão isolados em try/catch próprios —
   uma falha ali vira um log e segue em frente, nunca derruba a tela.
2. A função inteira ganhou a mesma camada de diagnóstico da Fase 27.26: se mesmo assim algo quebrar,
   a tela mostra o erro real (mensagem + stack) em vez do genérico mascarado do Next — com cuidado
   pra deixar o fluxo interno do `notFound()` passar direto (ele lança `NEXT_NOT_FOUND`
   propositalmente, não é um erro de verdade).

**Isso ainda não é a confirmação da causa raiz** — é a mesma estratégia que já funcionou pra dar
visibilidade em `/chamados/novo` (Fase 27.26): tornar o próximo erro visível, já que os logs do
Supabase não ajudam e a mensagem de produção do Next é mascarada. Se a causa for de fato o re-render
implícito quebrando em algum desses dois pontos agora blindados, o problema já deve estar resolvido;
se for outra coisa, a próxima tentativa de anexar um arquivo numa resposta de chamado deve finalmente
mostrar o erro real na tela (ou, se o erro insistir em não aparecer nem aqui, é sinal de que o
re-render implícito acontece numa página diferente da que imaginávamos, e o próximo passo seria
aplicar o mesmo diagnóstico em `/chamados` (a listagem) também).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.29 — Causa raiz encontrada: `(dashboard)/layout.tsx` sem proteção nenhuma, envolve toda página e não é coberto por error.tsx

Confirmado pelo Daniel: mesmo depois da Fase 27.28, o erro AINDA aparece com o texto genérico e
mascarado do Next (não a tela de diagnóstico customizada que criamos). Isso foi a peça decisiva:
como tanto `enviarAnexoAcao` (Fase 27.25) quanto `chamados/[id]/page.tsx` (Fase 27.28) já estavam
100% protegidos por try/catch, um erro que ainda escapa como o genérico mascarado do Next SÓ pode
estar acontecendo em algum lugar de fora dessas duas blindagens.

Isso levou de volta a uma limitação do Next já documentada nesta mesma investigação (Fase 27.22):
um `error.tsx` NÃO cobre erros lançados no `layout.tsx` do MESMO segmento — só em páginas/
componentes filhos. E `(dashboard)/layout.tsx` — que roda em TODA página do dashboard — nunca teve
nenhuma proteção: nem nas 3 contagens de badge (`contarChamadosNaoVistosAcao`,
`contarAvaliacoesPendentesAcao`, `contarAcessosClientesNaoVistosAcao`), nem na busca do perfil do
usuário (`usuarios_app`).

Isso também explica, finalmente, a assimetria que persistia desde a Fase 27.22: abrir um chamado
NOVO sempre funcionou porque termina em `redirect()` — uma navegação nova, que não precisa
re-renderizar a tela atual. Responder ou anexar um arquivo numa resposta NÃO redireciona — então o
Next precisa re-renderizar a rota atual (e o layout que a envolve) por trás dos panos, como parte da
própria resposta da Server Action, pra manter o cache do cliente atualizado. Se qualquer coisa
falhar nessa re-renderização do layout (uma instabilidade de rede, uma RPC lenta, qualquer coisa),
o resultado é exatamente o erro genérico mascarado — sem nunca passar pelas blindagens da action ou
da página, porque o problema nunca esteve ali.

Correção: as 3 chamadas de contagem de badge agora rodam em paralelo (`Promise.all`) com
`.catch()` individual — uma falha em qualquer uma delas vira `0` (o badge correspondente some) em
vez de derrubar o dashboard inteiro. A busca do perfil do usuário também ganhou try/catch — sem
perfil, a tela cai de volta pro e-mail puro (só perde o cargo exibido, não quebra).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Como esse layout é compartilhado por
TODA a aplicação, essa correção tem chance real de resolver definitivamente o problema (e não seria
surpresa se também explicasse o crash não relacionado de `/chamados/novo`, já que aquela tela
também está dentro do mesmo layout).

## Fase 27.30 — CAUSA RAIZ CONFIRMADA: Node.js 20 no Railway sem `File` global (SDK do Supabase quebra ao fazer upload)

Depois de 4 rodadas de correção sem sucesso (27.22, 27.24, 27.25, 27.27, 27.28, 27.29), o Daniel
conseguiu abrir os logs do Railway (aba "Logs" do serviço) no momento exato de uma nova tentativa, e
o log trouxe o erro REAL, sem mascaramento:

```
⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of
    @supabase/supabase-js. Please upgrade to Node.js 22 or later.
(node:15) ExperimentalWarning: buffer.File is an experimental feature and might change at any time
 ⨯ ReferenceError: File is not defined
    at l (.next/server/chunks/7545.js:1:17432)
    at async m (.next/server/app/(dashboard)/chamados/[id]/page.js:1:16356) {
  digest: '1836595261'
}
```

Isso explica por que o código do erro (`1836595261`) nunca mudava, mesmo depois de 3 correções
reais em arquivos diferentes (`enviarAnexoAcao`, a página do chamado, o layout do dashboard): o
problema NUNCA esteve no nosso código. É o próprio SDK (`@supabase/supabase-js`), ao montar a
requisição de upload pro Storage, que referencia a classe global `File` — e no Node.js 20 (versão
que o Railway estava usando, já que `package.json` não tinha nenhum `engines` declarado, então o
Nixpacks escolheu um padrão antigo) essa classe só existe de forma experimental
(`buffer.File`), não como global padrão do runtime — daí o `ReferenceError: File is not defined`,
lançado de dentro da própria biblioteca, fora de qualquer try/catch nosso.

Isso também finalmente explica a assimetria observada desde o início: abrir um chamado NOVO com
anexo tem sua própria falha silenciosa e antiga (Fase 27.18, o `anexoFalhou` best-effort) que
mascarava o mesmo erro sem o usuário perceber — o chamado era criado, só o anexo falhava
silenciosamente. Responder/anexar num chamado existente não tem esse "abafador", então o mesmo erro
aparecia cru, mascarado pela proteção padrão de produção do Next.

Correção definitiva, em duas camadas:
1. `package.json` ganhou `"engines": { "node": "22.x" }` — Node 22 tem `File` como global estável,
   resolvendo o problema na raiz. O Railway (builder Nixpacks) lê esse campo pra escolher a versão
   do Node a provisionar no próximo deploy. `@types/node` também foi atualizado de `^20` pra `^22`
   pra manter a tipagem consistente com o runtime real.
2. `src/instrumentation.ts` (novo arquivo, hook padrão do Next 15 que roda uma vez na inicialização
   do servidor): garante `globalThis.File` mesmo que, por qualquer motivo, o ambiente ainda suba com
   uma versão mais antiga do Node — segunda camada de segurança, não depende só do Railway respeitar
   o `engines`.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Esta é a primeira correção, das 6
tentativas, apoiada em evidência direta do log real do servidor (não em suspeita) — alta confiança
de que resolve definitivamente o problema do anexo em resposta de chamado.

## Fase 27.31 — Botão "Filtrar" perdia o cliente selecionado (Abastecimentos, Veículos, Motoristas)

Achado real: essas 3 telas têm DOIS `<form>` HTML separados — um só com o seletor "Cliente", e
outro com a busca (texto/data). Cada `<form>` só envia os PRÓPRIOS campos ao ser submetido, mesmo
estando na mesma página. Como o form de busca não incluía o cliente selecionado, clicar em
"Filtrar" (ou até só apertar Enter no campo de busca) derrubava o `?empresa=` da URL, e a tela caía
de volta na mensagem pedindo pra selecionar um cliente — mesmo já tendo um selecionado.

Outras telas com padrão parecido (Postos, Centros de Custo, Manutenção Preditiva) não tinham esse
problema porque usam um ÚNICO form com todos os campos juntos (cliente + busca).

Correção: um campo oculto `<input type="hidden" name="empresa" value={empresaParam} />` foi
adicionado ao form de busca dessas 3 telas, garantindo que o cliente selecionado viaje junto com o
filtro de busca.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.32 — Cabeçalho do PDF de Relatórios Personalizados: usuário, cargo, data/hora, dimensão e métricas

Pedido do Daniel: o PDF exportado de "Relatórios Personalizados" precisava trazer no cabeçalho quem
emitiu (usuário e cargo), quando (data e hora), e qual combinação de dimensão/métricas gerou aquele
resultado — importante pra um relatório que pode circular fora da plataforma (impresso, anexado a
e-mail) sem perder esse contexto.

Achado ao revisar o componente: o próprio título do relatório (ex.: "Valor Total, Preço Médio por
Combustível" — já continha a combinação de métricas + dimensão) nunca era exibido no PDF gerado, só
existia como string interna; e a data de emissão só aparecia discreta no rodapé.

Mudanças:
- `relatorios/page.tsx` agora busca nome e perfil (`usuarios_app`) de quem está logado — mesmo
  padrão já usado no layout do dashboard (Fase 27.15) — e resolve o rótulo do cargo via
  `PERFIL_LABEL`.
- Esses dados (nome + cargo) e os campos estruturados de fonte/dimensão/métricas passam por
  `RelatoriosPersonalizados` → `BotaoBaixarPdfPersonalizadoLazy` → `BotaoBaixarPdfPersonalizado` até
  o documento (`RelatorioPersonalizadoPdf`).
- O PDF ganhou uma caixa de emissão no topo, logo abaixo do título do relatório, com: Emitido por
  (nome — cargo), Data e hora, Fonte, Dimensão, Métricas e o resumo do resultado (grupos
  encontrados). O rodapé com "Gerado em..." continua, como reforço.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.33 — PDF de Relatórios Personalizados agora traz o gráfico da consulta

Pedido do Daniel: o PDF exportado só trazia a tabela de resultados, nunca o gráfico visto na tela.

Como o gráfico é desenhado pelo Recharts (SVG no navegador) e o `@react-pdf/renderer` roda seu
próprio motor de layout (não consegue renderizar componentes React/Recharts dentro do PDF), a saída
encontrada foi CAPTURAR o gráfico já desenhado na tela como imagem, no momento do clique em
"Exportar PDF":

1. `RelatoriosPersonalizados.tsx` — o container do gráfico ganhou uma ref; `capturarGraficoComoImagem()`
   localiza o `<svg>` gerado pelo Recharts, clona, serializa via `XMLSerializer`, desenha num
   `<canvas>` em memória (escala 2x pra não sair borrado) e converte pra PNG (data URL). Quando o
   tipo de gráfico é "Tabela", não há `<svg>` — a função devolve `null` e o PDF sai só com a tabela,
   como antes.
2. Como a captura é assíncrona, o botão de exportar deixou de usar `PDFDownloadLink` (que monta o
   documento de forma síncrona) — `BotaoBaixarPdfPersonalizado.tsx` agora é um botão comum que, ao
   clicar, aguarda a captura, gera o PDF via `pdf(...).toBlob()` e dispara o download manualmente
   (mesmo padrão já usado pro CSV).
3. `RelatorioPersonalizadoPdf.tsx` ganhou a prop `imagemGraficoUrl`; quando presente, mostra a
   imagem numa moldura logo antes da tabela.

Observação registrada em comentário no código: a legenda do Recharts (aparece com 2+ métricas
selecionadas) é desenhada em HTML fora do `<svg>`, então não entra nessa captura — os nomes das
métricas continuam visíveis na tabela do PDF logo abaixo do gráfico.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.34 — Roteirização: aba "Por Rota" removida da navegação; aba de planejamento renomeada para "Roteirizador Inteligente"

Pedido do Daniel: retirar a consulta "Por Rota" da visão de todos os perfis (admin e clientes), e
renomear a aba de planejamento de rota otimizada (que dividia o nome "Roteirização" com a seção
inteira no menu lateral, o que confundia) para "Roteirizador Inteligente".

- `AbasRoteirizacao.tsx`: a aba "Por Rota" (`/roteirizacao/rota`) saiu da lista de abas exibidas,
  pra todos os perfis. A aba antes chamada "Roteirização" (`/roteirizacao/planejar`) passou a se
  chamar "Roteirizador Inteligente".
- A página `/roteirizacao/rota` em si NÃO foi apagada (só ficou fora da navegação): consultas desse
  tipo salvas antes desta mudança continuam acessíveis a partir de "Rotas Salvas", que ainda tem
  link direto pra ela. O tipo `AbaRoteirizacaoAtiva` continua aceitando `"rota"` por causa disso.
- `salvas/page.tsx`: rótulo de exibição do tipo "roteirizacao" atualizado de "🧭 Roteirização" para
  "🧭 Roteirizador Inteligente", pra ficar consistente com o novo nome da aba.
- `planejar/page.tsx`: título da página (`<h1>`) atualizado de "Roteirização" para "Roteirizador
  Inteligente".

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.35 — Onboarding de cliente novo: card "Primeiros passos" no Dashboard + avisos sobre ANP em Roteirização/Postos

Pedido do Daniel: cliente novo não estava entendendo por onde começar — achava que precisava
carregar os postos do seu relacionamento, cadastrar veículos e motoristas ANTES de conseguir usar a
plataforma, quando na verdade Roteirização e consulta de Postos já funcionam com a base pública de
preços ANP (por UF/município), sem cadastro nenhum. Só veículos e motoristas são de fato
necessários pra operar (abastecimentos, manutenção, centro de custo).

Solução escolhida (das opções apresentadas): checklist no Dashboard + avisos nas telas.

1. **`dashboard/_components/PrimeirosPassos.tsx`** (novo componente): card exibido no topo do
   Dashboard, só quando há um cliente selecionado, com uma lista de 3 passos — cadastrar veículos,
   cadastrar motoristas (ambos com link direto pra tela de cadastro) e carregar postos revendedores
   (marcado explicitamente como **opcional**, com o aviso de que a consulta já funciona com dados
   ANP). Cada passo mostra ✅/⬜ e a contagem atual. O card inteiro some sozinho assim que veículos E
   motoristas já estiverem cadastrados — não incomoda quem já está operando. Postos não entra nessa
   condição de saída (é opcional, pode ficar marcado como pendente indefinidamente sem problema).
2. **`dashboard/page.tsx`**: nova consulta (`postos_gf` contando por `empresa_id`) alimentando o
   card; renderizado logo abaixo do seletor de cliente/período.
3. **Avisos informativos** (não são erro, cor azul/neutra) adicionados no topo de:
   - `/roteirizacao` (aba "Por UF/Município")
   - `/roteirizacao/planejar` (aba "Roteirizador Inteligente")
   - `/postos` (só na visão "Rede do cliente", onde o cliente ainda não tem nada carregado)

   Todos deixando claro que a consulta já funciona com a base pública ANP, e que carregar a rede
   própria é opcional.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.36 — Alocação em massa de veículos e motoristas em Centro de Custo

Pedido do Daniel (com print de uma frota grande): alocar veículo por veículo num centro de custo
(um `<select>` + um clique em "Alocar" por vez) é inviável quando o cliente tem centenas de
veículos. Pediu uma solução facilitada pra grandes volumes — e o mesmo tratamento pra motoristas.

**`SeletorAlocacaoEmMassa.tsx`** (novo, genérico — usado tanto por veículos quanto motoristas):
duas listas lado a lado (Disponíveis / Alocados), cada uma com busca própria (frotas grandes tornam
as DUAS listas longas, não só a de disponíveis) e checkboxes de seleção múltipla, mais "selecionar
todos os filtrados". Um único botão aloca todos os marcados de uma vez; o mesmo vale pra remover.
Item individual na lista de alocados também mantém um "Remover" rápido, pra ajustes pontuais sem
precisar marcar checkbox.

**Ações de servidor em lote** (`centros-custo/actions.ts`):
- `alocarVeiculosEmLoteAcao` / `desalocarVeiculosEmLoteAcao`: recebem uma lista de placas,
  reaproveitam o helper `alocarVeiculoCentroCusto` (preserva o histórico por veículo) via
  `Promise.all` — o ganho é menos cliques pro usuário, não menos chamadas ao banco (o histórico
  continua sendo por veículo).
- `alocarMotoristasEmLoteAcao` / `desalocarMotoristasEmLoteAcao`: motoristas NÃO têm tabela de
  histórico de alocação (só a coluna `centro_custo_id` em `motoristas`) — por isso é um único
  `UPDATE ... WHERE id IN (...)`, sem loop.

**Motoristas em Centro de Custo é funcionalidade nova**: antes só dava pra vincular motorista a
centro de custo editando o motorista individualmente. Agora `centros-custo/[id]/page.tsx` também
busca os motoristas da empresa (com o nome do centro de custo atual via join, já que
`motoristas` não tem coluna de cache pra isso) e renderiza `AlocarMotoristaForm.tsx`, mesma UX dos
veículos, logo abaixo.

`AlocarVeiculoForm.tsx` foi reescrito por cima do novo seletor genérico, mantendo o histórico de
alocações (accordion "Ver histórico") como já existia.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.37 — Roteirizador Inteligente: seletor de placa trazia veículos de TODOS os clientes

Achado real (reportado pelo Daniel): mesmo com um cliente selecionado, o seletor de veículo do
Roteirizador Inteligente (`/roteirizacao/planejar`) mostrava placas de fora daquele cliente.
Investigando: a consulta de veículos dessa tela nunca teve NENHUM filtro por empresa — buscava
todos os veículos `ativo = true` do banco inteiro, de qualquer cliente da plataforma, não só do
grupo econômico do cliente selecionado.

Corrigido pra usar a RPC `veiculos_da_empresa` (mesmo padrão já usado em `/veiculos` e no
Dashboard, que resolve corretamente a normalização de CNPJ entre `cadastro_veiculos.cnpj_frota` e
`empresas.cnpj`), filtrando pela empresa selecionada — e só busca alguma coisa quando há de fato um
cliente selecionado (sem cliente, a tela já nem mostra o formulário).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.38 — Limite de 1000 linhas do Supabase/PostgREST na busca de frota por empresa

Achado real (reportado pelo Daniel): a frota de teste "Transportes de Cargas Testes Ltda" tem
2357 veículos. Ao selecionar todos os registros sem centro de custo e alocá-los em massa para
"Matriz - SP" (Fase 27.36), só 1000 foram movidos. Confirmado via SQL direto no banco: empresa com
2357 veículos, 1357 ainda sem centro de custo no momento do relato, e exatamente 1000 alocados em
"Matriz - SP".

Causa raiz: o Supabase/PostgREST aplica um limite PADRÃO de 1000 linhas por resposta
(configuração `db-max-rows` da API), silenciosamente, em QUALQUER consulta ou chamada de RPC que
devolve um conjunto de linhas sem paginação explícita (`.range()`/`.limit()`) — sem erro nenhum, a
resposta vem cortada em 1000. Isso incluía a RPC `veiculos_da_empresa`, usada em vários pontos do
sistema pra listar a frota inteira de um cliente. Ou seja: qualquer cliente com mais de 1000
veículos ativos era afetado não só na alocação de centro de custo, mas em TODOS os lugares que
listam a frota completa.

Corrigido criando `src/lib/veiculos.ts` com `buscarTodosVeiculosDaEmpresa(supabase, empresaId)`,
que pagina a RPC em lotes de 1000 via `.range()` num loop, até um lote vir com menos de 1000
linhas (sinal de que acabou). Substituído em todo lugar que buscava a frota completa de uma
empresa via `veiculos_da_empresa` ou consulta direta em `cadastro_veiculos` por CNPJ:

- `dashboard/page.tsx` (contagem de veículos do Dashboard/checklist "Primeiros passos")
- `veiculos/page.tsx` (listagem de Veículos)
- `rotograma/actions.ts` (select de placa no formulário de Rotograma)
- `roteirizacao/planejar/page.tsx` (seletor de placa do Roteirizador Inteligente)
- `centros-custo/[id]/page.tsx` (lista de Disponíveis/Alocados na alocação em massa — o local
  onde o Daniel reportou o problema; esta era a única consulta direta em `cadastro_veiculos`, as
  demais já usavam a RPC)
- `app/api/cadastros/veiculos/route.ts` (API de integração de frota, Hub de Integrações Fase 25)

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos alterados, ambos limpos.

## Fase 27.39 — Limpeza da tela Permissões e furo Frota/Posto

Achado real (reportado pelo Daniel): a tela `/permissoes` trazia 26 "funcionalidades" cadastradas
em `permissoes_perfil`, importadas do sistema anterior em Streamlit. Comparando com as rotas e
recursos que realmente existem neste app, 11 delas não correspondem a nada daqui: `aba_acordos`,
`aba_analise_cliente`, `aba_comece_seu_dia`, `aba_configuracoes`, `aba_documentacao`,
`aba_recomendador`, `aba_telemetria`, `aba_variacao_precos`, `func_editar_acordos`,
`func_ver_telem_todos` e `func_ver_todos_cnpj` (este último citado pelo Daniel como exemplo).
Removidas as 44 linhas correspondentes (padrão global + as customizações por empresa que existiam
para `aba_configuracoes` e `func_ver_todos_cnpj`). Restaram as 15 funcionalidades que de fato
mapeiam pra abas/ações deste app (`aba_dashboard`, `aba_financeiro`, `aba_roteirizacao`, etc.).

Segundo achado, mais sério: o Daniel pediu pra também impedir que o perfil Posto fique visível/
editável pro lado Frota (só usuários Posto — ou o admin — deveriam mexer nas permissões de Posto).
Investigando, o problema já existia em DUAS camadas:

- **RLS do banco**: a policy de `permissoes_perfil` usava só `nivel_perfil(perfil) <=
  nivel_perfil(perfil_usuario_atual())`, com a escala `admin=4, gestor_frota=3, analista=2,
  posto=1`. Como é uma comparação numérica única, um gestor_frota (3) ou analista (2) passava na
  checagem pra qualquer linha com `perfil='posto'` (1 <= 3 e 1 <= 2) — ou seja, o lado Frota
  conseguia ver E EDITAR as permissões do Posto, mesmo sem nenhuma tela permitir isso
  explicitamente (dava pra fazer via API direto). Corrigido com uma migração (`alter policy`) que
  isola `perfil='posto'` numa cláusula própria: só é visível/editável por quem é `admin` ou o
  próprio `posto`, nunca mais por `nivel_perfil` sozinho.
- **Tela `/permissoes`**: o cálculo de `perfisVisiveis` fazia `PERFIS.slice(meuIndice)`, tratando
  "posto" como só mais um degrau abaixo de "analista" na mesma hierarquia — por isso a coluna
  "Posto" aparecia (e era editável) pra quem logava como Gestor de Frota ou Analista. Corrigido
  separando a "trilha Frota" (`gestor_frota`, `analista`) da trilha Posto: agora quem é do lado
  Frota nunca vê a coluna Posto, e quem é Posto só vê a própria coluna.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.40 — Performance: RLS reavaliando auth.jwt() por linha + falta de loading.tsx

Investigando a lentidão de navegação reportada pelo Daniel, rodei o advisor de performance do
Supabase e achei o maior contribuinte: praticamente toda tabela multi-tenant do sistema (~40
tabelas, ~70 policies) tinha RLS que chama `auth.jwt()` DIRETO no corpo da policy, sem envolver
num `select`. O Postgres reavalia essa chamada LINHA A LINHA da tabela em vez de computar uma vez
só por consulta — e como toda tela do app faz pelo menos uma consulta numa tabela protegida por
RLS, isso pesa em qualquer lista (veículos, abastecimentos, motoristas etc.), mais ainda em
clientes com frota grande (2000+ veículos).

Duas correções, ambas SEM MUDAR nenhuma regra de acesso (só a forma de avaliar):

- `perfil_usuario_atual()` — chamada em quase toda policy do tipo "... OU admin" — fazia
  `auth.jwt() ->> 'email'` sem `select`; corrigida direto na função (um só lugar, beneficia toda
  policy que a chama).
- As ~70 policies restantes que chamavam `auth.jwt()`/`auth.uid()` direto no corpo (geralmente como
  argumento de `empresas_do_usuario(...)` ou em comparação direta de e-mail) foram corrigidas em
  lote por um script que gera e aplica `ALTER POLICY` automaticamente — troca só
  `auth.jwt()` por `(select auth.jwt())`, mesmo resultado lógico. Validado depois: `d.peruffo@gmail.com`
  continua enxergando as mesmas 4 empresas e 2386 veículos de antes, RLS intacta.

Também corrigidas 11 chaves estrangeiras sem índice (`unindexed_foreign_keys` no advisor),
incluindo `cadastro_veiculos.centro_custo_id` e `motoristas.centro_custo_id` — exatamente as
colunas usadas na alocação em massa por centro de custo (Fase 27.36), que antes fazia varredura
completa da tabela a cada filtro/JOIN por essas colunas.

Do lado do Next.js: nenhuma tela do dashboard tinha um `loading.tsx`. Sem esse arquivo, ao clicar
num link do menu a tela ANTERIOR fica congelada (sem nenhum feedback visual) até a página de
destino terminar de buscar os dados dela — dá sensação de trava mesmo quando a consulta em si é
rápida. Criado `src/app/(dashboard)/loading.tsx` com um esqueleto simples, que aparece
instantaneamente na troca de tela e é substituído pelo conteúdo real assim que a página termina de
carregar (limitação do Next: isso cobre a página, não o próprio `layout.tsx` — que faz suas
próprias checagens de autenticação/MFA em toda navegação e não pode ser coberto por um Suspense do
mesmo segmento).

Fica como próximo passo (não feito agora, por prudência): o advisor também aponta ~9 tabelas com
"multiple_permissive_policies" (mais de uma policy permissiva pro mesmo papel/ação, todas avaliadas
e somadas por OR a cada consulta) — dá pra consolidar, mas exige revisar cada par com calma pra não
mudar acesso sem querer, então não entrou nesta fase.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. RLS validada por consulta direta
(mesmo resultado antes/depois da otimização).

## Fase 27.41 — Limite de veículos do plano nunca era verificado (bloqueio + upgrade)

Pergunta do Daniel: quando um cliente novo integra via API e traz os abastecimentos do ERP dele,
isso não deveria automaticamente exigir um plano pago se a frota for maior que o limite do
gratuito (10 veículos)? Investigando, confirmei que a resposta era não — e por dois motivos:

1. **O limite nunca era verificado em lugar nenhum.** `empresas.max_veiculos` só era exibido como
   "X / Y" na tela de Minha Assinatura, sem bloquear nada em nenhum outro lugar do sistema — nem no
   cadastro manual, nem na importação de planilha, nem na integração por API. Prova real: a empresa
   de teste tem 2357 veículos cadastrados e segue no plano gratuito (limite 10) — e não é a única:
   "Frotas & Frotas Ltda" também está com 29 veículos no plano gratuito, mesmo limite.
2. **A integração PróFrotas nunca cadastra o veículo.** Ela só grava os abastecimentos em
   `profrotas_abastecimentos`, guardando a placa como texto solto — nunca cria uma linha em
   `cadastro_veiculos`. Ou seja, mesmo que o limite fosse checado contra `cadastro_veiculos`, a
   integração jamais apareceria nessa contagem.

Corrigido com o Daniel definindo as regras (contagem = veículos cadastrados + placas distintas
vistas na integração; reação = bloquear e pedir upgrade):

- `contar_veiculos_reais_empresa(empresa_id)` (RPC) — conta placas distintas normalizadas somando
  `cadastro_veiculos` (por CNPJ) e as placas vistas em `profrotas_abastecimentos` +
  `abastecimentos_externos`, mesmo sem cadastro formal do veículo.
- `src/lib/limitePlano.ts` (`verificarLimiteFrota`) — compara essa contagem com
  `empresas.max_veiculos` (mantido em dia pelo webhook do Stripe a cada upgrade/downgrade;
  `-1` = ilimitado, plano enterprise).
- Bloqueio aplicado em **dois pontos de entrada da integração**: `sincronizarAgoraAcao`
  (integracoes/actions.ts, sync manual) e o cron `sync-profrotas` (sync automático agendado) — se a
  frota real já estiver acima do limite, o sync nem roda; no cron, só aquele cliente é pulado, sem
  derrubar os demais.
- Tela `/integracoes` agora mostra um aviso "⚠️ Limite excedido" com link direto pra Minha
  Assinatura pra cada cliente já acima do limite, mesmo antes de clicar em "Sincronizar agora".

Também corrigido um problema adjacente encontrado na Edge Function `stripe-webhook`: ao cancelar
uma assinatura (`customer.subscription.deleted`), o plano voltava pra "gratuito" mas
`max_usuarios`/`max_veiculos` ficavam parados no valor do plano anterior (ex.: 200 veículos de um
Profissional cancelado) — sem esse reset, o novo bloqueio nunca pegaria um cliente cancelado acima
do limite real do gratuito. Deploy feito (`stripe-webhook` v10).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Contagem real testada nas 4 empresas
do banco: enterprise (ilimitado, ok), duas gratuito dentro do limite (ok), duas gratuito acima do
limite (bloqueadas, como esperado).

## Fase 27.42 — Bypass de limite de frota para clientes de teste (admin)

Pedido do Daniel: "Frotas & Frotas Ltda" é cliente de teste dele mesmo (admin) e ficou bloqueada
pela Fase 27.41 (29 veículos, plano gratuito, limite 10) — ele precisa continuar testando suas
evoluções sem esse bloqueio.

Em vez de inflar o plano/`max_veiculos` dela (o que mascararia o comportamento real do plano
gratuito nos próprios testes), criada uma flag dedicada:

- `empresas.bypass_limite_frota` (boolean, default `false`) — quando `true`,
  `verificarLimiteFrota` (Fase 27.41) libera a sincronização mesmo com a frota acima do limite, sem
  tocar em plano/max_veiculos/contagem exibida em Minha Assinatura.
- Checkbox "Ignorar limite de veículos do plano" em `/clientes/[id]`, visível e editável **só para
  admin** — checagem repetida nos dois lados (a tela só mostra o campo pra admin, e
  `atualizarCliente` só grava o valor recebido se quem chamou é admin, mesmo que o campo seja
  forjado no FormData).
- Ativado imediatamente para "Frotas & Frotas Ltda", a pedido do Daniel.

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Confirmado no banco: a flag está
`true` pra essa empresa e `verificarLimiteFrota` já retorna liberado antes de qualquer comparação de
limite.

## Fase 27.43 — Contador de veículos errado em Minha Assinatura

Achado real (reportado pelo Daniel, com print): a tela Minha Assinatura mostrava "Veículos: 2 / 10"
pra "Frotas & Frotas Ltda", mas essa empresa tem 29 veículos reais (confirmado na Fase 27.41/27.42).

Causa raiz: o indicador contava com `.eq("cnpj_frota", empresa.cnpj)` — comparação direta de texto,
sem normalização. Confirmado no banco: só 2 dos 29 veículos têm `cnpj_frota` gravado com a MESMA
pontuação de `empresas.cnpj` (`25.265.787/0001-44`); os outros 27 estão gravados só com dígitos ou
com outra formatação, e ficavam de fora da contagem. Mesmo bug de fundo já corrigido em `/veiculos`
e no Dashboard (Fase 27.5/14) — cadastro_veiculos não tem `empresa_id`, e comparar `cnpj_frota` cru
com `empresas.cnpj` falha sempre que a pontuação não bate.

Corrigido trocando a contagem pela RPC `contar_veiculos_reais_empresa` (a mesma criada na Fase
27.41 pro bloqueio de limite) — resolve a normalização E deixa o número exibido aqui consistente
com o que de fato é usado pra decidir se a frota estourou o limite do plano (antes, o indicador e o
bloqueio podiam mostrar números bem diferentes pro mesmo cliente).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.44 — Crash em produção: revalidatePath("/clientes") durante o próprio render

Achado real (erro em produção, log completo do Daniel): a tela `/clientes` estava derrubando com
`Error: Route /clientes used "revalidatePath /clientes" during render which is unsupported`.

Causa raiz: `clientes/page.tsx` chama `marcarAcessosClientesVistosAcao()` direto dentro do
`Promise.all` da própria página (pra marcar os acessos de cliente como vistos assim que o admin
abre a tela — Fase 24/25) — e essa função fazia `revalidatePath("/clientes")` no final. Isso tenta
revalidar a MESMA rota que está sendo renderizada NAQUELE EXATO MOMENTO, o que o Next.js passou a
proibir com um erro fatal (antes era silenciosamente ignorado ou tolerado, dependendo da versão).

Corrigido removendo o `revalidatePath` de dentro de `marcarAcessosClientesVistosAcao` — ele não
fazia falta: a própria renderização em curso já busca os dados atualizados, revalidar a rota depois
de já renderizá-la não tinha efeito útil aqui (diferente de quando `revalidatePath` é chamado a
partir de uma Server Action de verdade, disparada por um clique/form, que é o uso correto — os
outros usos em `criarCliente`/`atualizarCliente`/`alternarAtivoCliente` continuam intactos).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.45 — Login com Google sem passar pelo domínio do Supabase

Pedido do Daniel: na tela de consentimento do Google, o texto "Continuar para
nedthbeekvwzcjrhsghp.supabase.co" aparecia em vez de fxgestaodefrotasonline.com. Causa: o login
usava `supabase.auth.signInWithOAuth`, que redireciona pro fluxo hospedado do Supabase (GoTrue) —
e o `redirect_uri` registrado no Google Cloud pra esse fluxo é o domínio do próprio projeto
Supabase, não o domínio do app. Corrigir isso por dentro do app não era possível; as opções reais
eram (a) comprar o add-on de Custom Domain do Supabase, (b) reescrever o login usando o Google
Identity Services (GIS) direto no domínio do app, sem custo, ou (c) deixar como está. Daniel
escolheu a opção (b).

Implementado em `src/app/login/page.tsx` + `src/app/login/actions.ts`:

- O app carrega o script do Google Identity Services (`accounts.google.com/gsi/client`) e renderiza
  o botão oficial do Google direto na origem do app (fxgestaodefrotasonline.com) — o popup de conta
  que o Google abre passa a mostrar esse domínio, não mais o do Supabase.
- Ao escolher a conta, o Google devolve um ID token pro navegador (não sai do domínio do app). Esse
  token é enviado a uma nova Server Action, `entrarComGoogle`, que valida o token com
  `supabase.auth.signInWithIdToken({ provider: "google", token, nonce })` — o Supabase confere a
  assinatura do token direto com o Google por trás, sem precisar do redirect antigo.
- Nonce anti-replay: gerado no client (`crypto.randomUUID` x2), só o hash SHA-256 dele vai pro
  Google; o valor cru é conferido pelo Supabase contra o hash embutido no ID token.
- Fallback automático: se a env var `NEXT_PUBLIC_GOOGLE_CLIENT_ID` não estiver configurada, ou o
  script do Google falhar/demorar mais de 6s pra carregar, a tela cai sozinha no botão antigo
  (`signInWithOAuth` via redirect do Supabase) — o login nunca fica quebrado por causa disso.
- `registrarAcessoCliente` (badge de "últimos acessos" em /clientes) continua sendo chamado,
  agora dentro de `entrarComGoogle`, mesmo padrão já usado em `entrarComSenha`.

**Pendente de configuração fora do código (o Daniel precisa fazer, não tenho acesso aos painéis):**

1. Em `.env.local` (e nas env vars de produção, ex. Railway/Vercel), definir
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` com o MESMO Client ID que já está em Authentication > Providers >
   Google no painel do Supabase (não é segredo — só o Client Secret é sensível).
2. No Google Cloud Console (APIs & Services > Credentials), abrir esse mesmo OAuth Client e
   adicionar `https://fxgestaodefrotasonline.com` em "Authorized JavaScript origins" (e o domínio
   de testes/preview, se usar algum). O redirect URI do Supabase que já existe lá não precisa mudar
   nem ser removido — essa é só uma adição.

Sem o passo 1, o app continua funcionando normalmente com o botão antigo. Validado com
`npx tsc --noEmit` e `npx eslint`, ambos limpos.

## Fase 27.46 — Detecção de anomalias em abastecimentos

Primeira funcionalidade da frente "hub de meios de pagamento": detectar fraude/erro de lançamento
em abastecimentos usando dados que a plataforma já ingere, sem depender de nenhuma integração nova.

Quatro regras, gravadas em `anomalias_abastecimento` (tabela nova, com RLS por empresa — cliente vê
só a própria frota, admin vê todas, mesmo padrão de `tickets`/`profrotas_abastecimentos`):

1. **Volume acima do tanque** — litros abastecidos maior que a capacidade cadastrada do veículo
   (campo `tanque` de `cadastro_veiculos`), com 15% de margem de calibração. Severidade crítica.
2. **Postos distantes no mesmo dia** — duas paradas da mesma placa, próximas no tempo, a uma
   distância que exigiria uma velocidade média acima de 100 km/h. Só funciona pra abastecimentos do
   ProFrotas (só lá temos latitude/longitude do posto). Severidade crítica.
3. **Hodômetro retrocedendo ou parado** — km menor que o abastecimento anterior da mesma placa, ou
   igual após mais de 2 dias — indício de adulteração ou troca de veículo não registrada. Severidade
   atenção.
4. **Preço fora da média regional** — valor por litro que destoa (mais de 2 desvios-padrão) da média
   do município, usando a referência da ANP (`anp_precos_referencia`). Só ProFrotas, que tem
   município/UF do posto; a normalização de nome de combustível (ex.: "Diesel S-10 Aditivado" →
   "OLEO DIESEL S10") e o mapeamento UF→nome do estado (a base da ANP usa nome por extenso, o
   ProFrotas usa sigla) são feitos dentro da função. Severidade atenção. Como a base ANP não é
   atualizada com frequência garantida, a regra usa sempre o snapshot mais recente disponível por
   município/produto, sem exigir data exata — é uma referência aproximada, não uma auditoria fina.

A detecção roda via `detectar_anomalias_abastecimento(p_empresa_id)`, uma função SQL idempotente
(reexecutar não duplica achado, graças a uma chave única) chamada sob demanda pelo botão "Detectar
agora" na nova tela `/anomalias`. `p_empresa_id = null` (rodar pra todas as empresas de uma vez) só é
aceito se quem chama for admin — checado dentro da própria função (`security definer`), não só na
tela. Automatizar via cron (rodar sozinho após cada sincronização) fica como próximo passo natural.

Tela `/anomalias`: KPIs de pendentes/críticas, filtro por tipo e status (pendente/revisada/todas),
paginação, e marcar/desmarcar cada achado como revisado (ação por item — cada anomalia merece um
olhar, não um "marcar tudo"). Badge de contagem no menu (Operação), mesmo padrão de Clientes/Chamados.

Não é exclusiva do time FNI: qualquer cliente vê as anomalias da própria frota (é tão útil pro
gestor de frota auditar os próprios motoristas quanto pro time interno auditar clientes).

Validado com `npx tsc --noEmit` e `npx eslint`, ambos limpos. Testado manualmente rodando a função
direto no banco contra dados reais (Frotas & Frotas Ltda): 23 achados de preço regional, 0 nos
outros 3 tipos — consistente com a fase de investigação (tanque/hodômetro/geo presentes nos dados,
mas sem casos reais de violação nesse cliente de teste).

## Fase 27.47 — Placa duplicada no ranking de veículos do Dashboard

Achado real (print do Daniel): o ranking "Top veículos por gasto" no Dashboard mostrava a mesma
placa duas vezes — uma linha com marca/modelo preenchidos, outra em branco — com gasto/litros/
abastecimentos idênticos nas duas.

Causa raiz: `indicador_ranking_veiculos` (função SQL só de leitura) fazia
`left join cadastro_veiculos v on v.placa = a.placa`, sem normalizar a placa e sem restringir por
empresa. Conferido direto no banco: a placa `SSZ2C51` tem duas linhas em `cadastro_veiculos` — uma
do CNPJ real da Frotas & Frotas (com marca/modelo) e outra de um CNPJ que não corresponde a nenhuma
empresa cadastrada (registro órfão), sem marca/modelo. Sem a restrição por empresa nem uma trava
contra múltiplas linhas por placa, o `LEFT JOIN` casava com as duas e duplicava a placa no
resultado (mesmo problema de fundo, uma variação nova: aqui não era formatação de CNPJ/placa
divergente entre os dois lados, e sim a ausência total de filtro por empresa combinada com dado
duplicado já existente na tabela).

Corrigido replicando o padrão já usado (corretamente) em `indicador_eficiencia_veiculos`: normaliza
placa e `cnpj_frota`, restringe ao CNPJ da própria empresa, e agrega com `max(marca)`/`max(modelo)`
— assim, mesmo que ainda exista mais de uma linha cadastrada pra mesma placa dentro da mesma
empresa, o resultado nunca duplica a linha do ranking. Testado direto no banco contra os dados reais
do print (Frotas & Frotas Ltda): `SSZ2C51` e `SUT8I32` agora aparecem uma única vez cada, com
marca/modelo corretos.

Fix só de banco (função SQL), sem mudança de código da aplicação.

## Fase 27.48 — Módulo Planos de Viagem (custo, receita e margem por viagem)

Segunda funcionalidade da frente "hub de meios de pagamento": orçamento de custo (combustível,
pedágios, diárias, manutenção) e receita de cada viagem planejada, com margem/lucro calculado —
primeira vez que o app rastreia receita, não só despesa. Baseado num mockup que o Daniel trouxe;
por decisão dele, construído completo (não em MVP enxuto) e seguindo o design system já existente
no app (não as cores do mockup).

Novo módulo `/planos-viagem`, com duas tabelas novas (RLS por empresa, mesmo padrão de
`tickets`/`anomalias_abastecimento`):

- `planos_viagem` — cabeçalho (nome, status, placa, motorista, datas), vínculo **opcional** com
  Rotograma OU com uma rota salva da Roteirização (o cliente escolhe qual, ou nenhuma — decisão do
  Daniel), centro de custo, e todos os campos de custo/receita.
- `planos_viagem_pedagios` — lista dinâmica de praças de pedágio por plano (RLS via `EXISTS` no
  plano pai, mesmo padrão de `ticket_anexos`).

Cálculos (recalculados no servidor a cada salvamento — nunca confia no total que veio do client):
combustível estimado (km ÷ consumo × preço), diárias (nº dias × soma de refeição/pernoite/banho/
lavagem), manutenção estimada (km × custo/km), pedágios (soma das praças), custo total estimado
(soma de tudo acima), e margem = receita − custo (estimada e, se preenchido, real).

Combustível real: botão "Revisar" chama a nova RPC `combustivel_real_periodo`, que soma litros/valor
dos abastecimentos de verdade (view `abastecimentos_unificado`, já usada em outros indicadores) da
placa do plano, entre a data de saída e o retorno previsto — mostra o gasto real sem precisar
lançar nada manualmente, se o veículo já tiver abastecimentos sincronizados/lançados nesse período.

Tela de listagem com KPIs (planos, orçamento total, custo médio por km, margem estimada), filtro por
status/placa/cliente, tabela com margem colorida (verde/vermelho), e "Desempenho por Veículo"
agrupado — tudo no estilo visual já usado no resto do app. Cross-link em Painel Financeiro.

Duas adaptações deliberadas em relação ao mockup original: (1) a escolha de cliente acontece na
tela de listagem (mesmo padrão de Abastecimentos/Anomalias), não dentro de um modal de criação —
este app usa páginas dedicadas de cadastro, não modais; (2) sem paginação server-side na listagem
(limite de 500 registros mais recentes) — volume esperado de planos de viagem é muito menor que
Abastecimentos, não precisa da mesma infraestrutura de paginação.

Testado direto no banco: inserido um plano de teste + pedágio, RPC `combustivel_real_periodo`
confirmada batendo com os dados reais de abastecimento da placa, joins com `motoristas`/`empresas`
confirmados, registro de teste removido em seguida. Validado com `npx tsc --noEmit` e `npx eslint`,
ambos limpos.

## Fase 27.49 — Anomalias e Planos de Viagem na matriz de Permissões por Perfil

Pedido do Daniel: as duas telas novas (Anomalias, Fase 27.46; Planos de Viagem, Fase 27.48)
precisavam aparecer na tela `/permissoes` como qualquer outra aba, pra dar pra liberar/bloquear por
perfil.

A tela de Permissões não tem uma lista fixa de abas no código — ela deriva tudo do que já existe em
`permissoes_perfil` (ver `PermissoesPage`), então bastou inserir o padrão global (`empresa_id`
sentinela) pras duas novas funcionalidades: `aba_anomalias` e `aba_planos_viagem`. Mesmo critério já
usado pra abas operacionais equivalentes (`aba_frotas`/`aba_financeiro`/`aba_rotograma`):
admin/gestor_frota/analista liberado por padrão, posto (perfil da trilha Revenda, separado da
hierarquia Frota) bloqueado — nem detecção de fraude em abastecimento nem planejamento de viagem diz
respeito a esse perfil.

Fix só de dado no banco (migration de `insert`), sem mudança de código da aplicação — a tela já lê a
lista dinamicamente.

## Fase 27.50 — Negociação com Postos Revendedores (posto vira tenant próprio)

Terceira funcionalidade da frente "hub de meios de pagamento" (depois de Anomalias e Planos de
Viagem): postos revendedores passam a negociar fornecimento de combustível (vigência, combustível,
volume mínimo mensal, preço por litro) diretamente com os clientes de frota, com aprovação,
contraproposta e aceite/recusa dos dois lados.

Decisão de arquitetura mais importante desta fase: **o posto revendedor ganha conta própria na
plataforma** (não é só um registro que o cliente cadastra em `/postos`). Até aqui, `perfil = "posto"`
existia como valor válido desde o início do projeto mas nunca tinha sido usado de verdade (0 usuários
com `segmento = "Revenda"` em produção) — não existia menu, tela, nem forma de um posto logar e fazer
algo. Esta fase constrói essa trilha pela primeira vez, pensando em evoluir mais funcionalidades para
o lado Revenda no futuro (pedido explícito do Daniel), não só a Negociação.

**Banco (migração `negociacoes_postos`):**

- `empresas.segmento` (`"Frota"` ou `"Revenda"`, default `"Frota"`) — o posto é uma linha de
  `empresas` como qualquer cliente de frota, só que com `segmento = "Revenda"`. Reaproveita 100% da
  infraestrutura de tenant já existente (login, RLS, `usuarios_empresas`, seletor de empresa) — não
  foi preciso inventar um sistema de conta separado.
- `negociacoes_postos` — cabeçalho da negociação: `empresa_cliente_id`, `empresa_posto_id` (pode
  ficar nulo se o posto ainda não tiver conta cadastrada com aquele CNPJ), `posto_cnpj`, `origem`
  (`cliente`/`posto`/`api`), `status` (`pendente_posto`/`pendente_cliente`/`aceita`/`recusada`/
  `cancelada`), `rodada_atual`.
- `negociacoes_postos_rodadas` — histórico completo de propostas/contrapropostas (nunca sobrescreve,
  só insere rodada nova): combustível, vigência, volume mínimo, preço, decisão por rodada.
- RLS padrão do projeto nos dois lados: visível pra quem pertence à `empresa_cliente_id` OU à
  `empresa_posto_id` (`empresas_do_usuario`), mais admin/service role.

**Máquina de estados centralizada** em `src/lib/negociacoesPostos.ts` (`criarNegociacao`,
`adicionarContraproposta`, `decidirNegociacao`, `cancelarNegociacao`) — usada tanto pela API pública
quanto pelas Server Actions da tela, pra nunca duplicar/divergir a lógica de transição de status
entre os dois lugares que criam/alteram negociações.

**API pública, dentro do Hub de Integrações** (pedido explícito do Daniel: "a API deve estar dentro
do menu de integração"): reaproveita 100% o Hub já existente (Fase 25) — `api_keys`, escopos,
`autenticarRequisicaoApi()` — só com dois escopos novos, `negociacoes:write` e `negociacoes:read`,
adicionados ao catálogo central em `src/lib/apiKeys.ts` (nenhuma tabela de chave nova precisou ser
criada). É o POSTO quem gera essa chave, na própria tela de Integrações dele:

- `POST /api/integracoes/negociacoes` — cria uma proposta nova (`cliente_cnpj` no corpo).
- `POST /api/integracoes/negociacoes/[id]/rodadas` — envia contraproposta (nova rodada).
- `POST /api/integracoes/negociacoes/[id]/decisao` — aceita ou recusa a proposta pendente.
- `GET /api/integracoes/negociacoes` — lista o andamento das negociações do posto, paginado.

A tela `/integracoes` agora se adapta: um usuário posto vê só a seção do Hub (com a permissão
"Negociação com Postos" pra marcar), sem o painel de sync ProFrotas (Frota-only).

**Tela `/negociacoes`** — CRUD completo dos dois lados, uma única tela que se comporta diferente
conforme o segmento da empresa selecionada (não o perfil do usuário, pra funcionar também com admin
trocando de empresa no seletor): o **cliente** cria propostas pra um posto (CNPJ), acompanha status,
aceita/recusa/contrapropõe; o **posto** (quando acessa pela UI, além da API) faz o mesmo do lado
dele. Detalhe de uma negociação mostra o histórico completo de rodadas e, quando é a vez de quem
está olhando responder, um formulário de decisão (aceitar / contrapropor com novos valores /
recusar).

**Notificação** — badge no menu (`contarNegociacoesPendentesAcao`, mesmo padrão de Chamados/Clientes/
Anomalias, contando pendências nos dois papéis possíveis do usuário) **e** e-mail via nova Edge
Function `negociacao-email` (Resend, mesmo padrão/secret já usado em `email-trials`): dispara pro
lado que precisa responder numa proposta/contraproposta nova, e pros dois lados quando a negociação
é aceita ou recusada — decisão do Daniel foi por e-mail com link (não formulário de resposta direto
no e-mail).

Menu (`layout.tsx`): perfil `"posto"` agora vê uma trilha própria e enxuta (`Negociações`,
`Integrações`, `Usuários`), separada do menu de Frota — primeira vez que o app bifurca o menu inteiro
por segmento, não só esconde um item pontual. `aba_negociacoes` adicionada à matriz de Permissões
(liberada pra todos os perfis de negócio, diferente de Anomalias/Planos de Viagem que são
Frota-only).

Limitação conhecida (documentada, não resolvida nesta fase): se um cliente cria uma negociação com o
CNPJ de um posto que ainda não tem conta na FNI, `empresa_posto_id` fica nulo — quando esse posto se
cadastrar depois, a negociação não é vinculada retroativamente de forma automática. Fica como
melhoria futura.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos) em todos os arquivos novos/alterados.

## Fase 27.51 — Ajustes pós-teste da Negociação (nome da contraparte + tela de Integrações do posto)

Achados reais do Daniel testando com um usuário posto de verdade (conta criada manualmente pra teste,
`segmento = "Revenda"`).

**1) Nome do cliente/posto em branco na lista.** A coluna "Cliente"/"Posto" de `/negociacoes` vinha
de um JOIN do PostgREST pra `empresas` (`cliente:empresas!...fkey(nome)`), e esse join respeita a RLS
de `empresas` — que só libera enxergar uma empresa pra quem é membro dela. Um usuário posto nunca é
membro da empresa do cliente (tenants diferentes), então o nome do "outro lado" sempre voltava nulo,
mesmo a negociação em si sendo visível (a RLS de `negociacoes_postos` já libera os dois lados).
Corrigido denormalizando `cliente_nome`/`posto_nome` direto na tabela, "fotografados" no momento da
criação da negociação via nova RPC `nome_empresa_publico` (SECURITY DEFINER, mesmo espírito de
`empresa_id_do_cnpj` — devolve só o nome, sem checar RLS). Todas as leituras (`/negociacoes`,
`/negociacoes/[id]`, `GET /api/integracoes/negociacoes`) passaram a ler essas colunas em vez de fazer
o join. Registros já existentes foram atualizados via `update ... from empresas` (bypass de RLS,
rodado direto no banco).

**2) Tela de Integrações confusa pro posto.** Dois ajustes:

- A categoria de escopo mostrada nos checkboxes de "Gerar chave de API" dizia "Negociação com
  Postos" — só faz sentido do ponto de vista do cliente. Quem sempre gera essa chave é o POSTO (só
  ele tem motivo pra habilitar `negociacoes:write`/`negociacoes:read`), então renomeado pra
  "Negociação com Cliente" em `src/lib/apiKeys.ts` (`CATALOGO_ESCOPOS`).
- A seção "Como usar as APIs do Hub" mostrava os 4 exemplos de `curl` (custos fixos, abastecimentos,
  manutenções, cadastros) pra todo mundo, mesmo sendo 100% irrelevantes pro posto. Agora esses 4
  blocos só aparecem pra quem não é posto (`!ehPosto`); o bloco de negociação continua visível pros
  dois lados.

Nenhuma mudança de schema além da denormalização (coluna nova + RPC). Validado com `npx tsc --noEmit`
e `npx eslint` (limpos).

## Fase 27.52 — Badge de Negociações nunca aparecia + título fixo na visão do posto

Dois achados reais reportados pelo Daniel testando ao vivo.

**1) Bolinha de notificação nunca aparecia, nem pro cliente nem pro posto.** Causa raiz:
`contarNegociacoesPendentesAcao` fazia um SELECT explícito em `usuarios_empresas` pra montar a lista
de `empresa_id` do usuário antes de contar — mas um usuário ADMIN normalmente só tem vínculo direto
com a própria empresa "de casa", e enxerga as DEMAIS empresas só pela regra "perfil admin" da RLS
(não por linha em `usuarios_empresas`). Resultado: pra admin (o próprio Daniel testando), a lista de
empresas nunca incluía a empresa do cliente/posto sendo testado, e a contagem sempre vinha zero,
mesmo com negociação pendente de verdade no banco.

Corrigido pra seguir o mesmo padrão já usado em `contarAnomaliasNaoRevisadasAcao`/
`contarChamadosNaoVistosAcao`: confiar inteiramente na RLS de `negociacoes_postos` pra decidir quais
linhas aquela pessoa pode ver, sem nenhum SELECT prévio em `usuarios_empresas`. Pra saber SE é a vez
daquele usuário responder, usa só o perfil: perfil "posto" só participa de uma negociação como
`empresa_posto_id`; qualquer perfil de negócio do lado Frota (`gestor_frota`/`analista`) só participa
como `empresa_cliente_id`. Pra admin (que não é parte em nenhuma negociação), a bolinha mostra o
total de negociações em aberto no sistema — mesmo espírito de monitoramento das demais bolinhas
administrativas.

**2) Título da tela fixo.** `/negociacoes` sempre mostrava o título "Negociação com Postos
Revendedores", inclusive pro próprio posto olhando a própria tela — não fazia sentido pra ele. Agora
o título também muda conforme o segmento (`souPosto`): "Negociação com Clientes" pro posto,
"Negociação com Postos Revendedores" pro cliente (o subtítulo logo abaixo já fazia essa distinção
desde a Fase 27.50; só o `<h1>` tinha ficado de fora).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.53 — Tela de Integrações do posto: só a categoria e o exemplo de Negociação

Dois vazamentos de UI que sobraram da Fase 27.51 (que já tinha escondido a maior parte do Hub pro
posto): a lista de checkboxes "Permissões desta chave" ainda mostrava as categorias Pagamentos e
Cadastros inteiras (irrelevantes pro posto, que só tem motivo pra marcar Negociação com Cliente), e o
bloco de exemplo `curl` "Consultar cadastros (escopos *:read)" continuava visível pra todo mundo.

Corrigido: `FormularioNovaChaveCustosFixos` ganhou uma prop opcional `apenasCategorias` — quando
informada, só as categorias da lista aparecem nos checkboxes; `/integracoes` passa
`apenasCategorias={["Negociação com Cliente"]}` só quando `ehPosto`. O bloco de "Consultar cadastros"
também passou a ficar dentro do `{!ehPosto && (...)}`, junto dos outros três que já tinham sido
escondidos.

## Fase 27.54 — Aba "Vigentes" em Negociações (pedido do Daniel)

Depois de aceita, uma negociação nem sempre está "em vigor" — a vigência pode ainda não ter começado
ou já ter terminado. Pedido do Daniel: uma aba dentro de `/negociacoes` (nos dois lados, cliente e
posto) mostrando só as negociações aceitas cuja vigência está em curso **hoje**.

Os termos da rodada vencedora (vigência, combustível, volume mínimo, preço) viviam só em
`negociacoes_postos_rodadas`, por rodada — sem estar "fotografados" em lugar nenhum do cabeçalho.
Adicionadas 5 colunas em `negociacoes_postos` (`vigencia_inicio`, `vigencia_fim`, `combustivel`,
`volume_minimo_mensal`, `preco_unitario`), preenchidas em `decidirNegociacao`
(`src/lib/negociacoesPostos.ts`) no momento em que a decisão é "aceita" — copiando os valores da
rodada que acabou de ser aceita. Backfill rodado pras 2 negociações já aceitas antes desta fase.

Na tela: nova pill "Vigentes" (ao lado de "Todos" e dos status reais) que filtra
`status = 'aceita' AND vigencia_inicio <= hoje AND vigencia_fim >= hoje` — não é um status de verdade
no banco, é um filtro derivado (constante `FILTRO_VIGENTE` só na página, não em
`STATUS_NEGOCIACAO`). Novo indicador "Vigentes agora" no topo (contagem sempre correta,
independente da aba selecionada — consulta separada, não reaproveita a lista filtrada). Nova coluna
"Vigência" na tabela, com um selo verde "Vigente" ao lado do status quando a linha está em vigor
hoje.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.55 — Robô de abastecimentos de teste (ciclo Otto, preço ANP, direto na tela existente)

Pedido do Daniel: sem integração real do lado do posto ainda, um robô deveria popular abastecimentos
de teste para os 2 clientes de frota reais desta instalação — Frotas & Frotas Ltda e Transportes de
Cargas Testes Ltda — usando os veículos e motoristas já cadastrados de cada um, só com combustíveis do
ciclo Otto (gasolina e etanol, nas variações vendidas no posto — a frota de teste é 100% Flex) e preço
variando em torno da média nacional da ANP.

A primeira versão criou uma tabela e uma tela próprias (`abastecimentos_postos` /
`/abastecimentos-postos`), ligadas a uma negociação vigente com posto. Depois de testar, o pedido
mudou: nada de tela separada — os abastecimentos do robô deveriam aparecer junto com os demais
(integração PróFrotas, importação em planilha, lançamento manual) na tela `/abastecimentos` que já
existe, e precisavam continuar editáveis do mesmo jeito. A tabela e a tela próprias foram removidas; o
robô passou a gravar direto em `profrotas_abastecimentos` — a mesma tabela usada por todas as outras
origens (ver `src/app/(dashboard)/abastecimentos/actions.ts`) — então o registro abre no mesmo
formulário de edição, sem tratamento especial. A rota `/abastecimentos-postos` ficou só como um
redirect para `/abastecimentos` (não excluída, pra não deixar um link antigo quebrado).

O robô é a função SQL `gerar_abastecimentos_postos_robo()` (SECURITY DEFINER): para cada um dos 2
clientes, sorteia entre 5 e 8 (`veículo`, `motorista`) reais daquele cliente por execução — sem
depender de negociação vigente (usa o nome do posto negociado quando existe uma, senão "Posto Teste
Ltda" genérico) — sorteia um combustível do ciclo Otto, busca o preço médio mais recente da ANP
(`anp_precos_referencia`, nível Brasil, mesmo de-para `PRODUTO_PARA_CATEGORIA_ANP` de
`src/lib/constants.ts`: Gasolina Comum/Aditivada/Alta Octanagem → GASOLINA COMUM/ADITIVADA, Etanol
Comum/Aditivado → ETANOL HIDRATADO), aplica uma variação de ±3% (mais um adicional pras variantes
"Alta Octanagem"/"Aditivado" premium) e um volume proporcional ao tanque do veículo (30–70% da
capacidade). Grava usando o mesmo identificador negativo do lançamento manual
(`nextval_identificador_manual()`), com `sync_key` prefixado `robo-` — é assim que o formulário de
edição reconhece e rotula a origem como "robô de teste (simulado)" em vez de "lançamento manual".
Agendado via `pg_cron` (job `robo_abastecimentos_postos`) de hora em hora — cadência reduzida das 6h
iniciais a pedido do Daniel, pra ter dados frescos com mais frequência nos testes.

Sem tabela nem permissão dedicadas: nada de `abastecimentos_postos` nem `aba_abastecimentos_postos`
(ambas removidas). O robô é só uma fonte a mais de dados na tela `/abastecimentos` já existente.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.56 — Dashboard do posto + hodômetro progressivo no robô

Duas melhorias pontuais depois de testar a Fase 27.55.

**Dashboard do posto.** Achado real: todo usuário cai em `/dashboard` depois do login, mas essa página
sempre foi 100% voltada pra Frota (veículos, motoristas, previsão de consumo) — um usuário posto nunca
tinha nada relevante ali, e o item nem aparecia no `menuPosto`. `dashboard/page.tsx` agora resolve o
segmento da empresa selecionada (mesmo padrão de `/negociacoes`) logo no início e, se for "Revenda",
desvia pro novo componente `DashboardPosto` antes de rodar qualquer consulta de Frota. O dashboard do
posto mostra: negociações aguardando resposta, negociações vigentes agora, clientes com negociação
aceita, volume mínimo mensal contratado, e duas tabelas (vigentes / aguardando resposta) — tudo lido
de `negociacoes_postos`, que o posto já enxerga integralmente via RLS (nenhuma política nova
precisou ser criada). Item "🏠 Dashboard" adicionado no topo do `menuPosto`.

**Hodômetro progressivo no robô.** Os abastecimentos simulados vinham sem hodômetro. Agora
`gerar_abastecimentos_postos_robo()` busca o hodômetro do último abastecimento já registrado daquele
veículo (por placa + `cnpj_frota`, em `profrotas_abastecimentos`, criado_em decrescente — não
`data_abastecimento`, que é sorteada dentro da janela e não garante ordem real) e soma
`volume_litros × autonomia` (km/L do veículo, coluna `cadastro_veiculos.autonomia`) pra chegar no novo
hodômetro. Sem histórico, sorteia um hodômetro inicial (8.000–180.000 km) só na primeira vez — os
próprios registros do robô já carregam esse estado dali em diante, sem precisar de tabela extra.

**Cadência de volta pra 6 em 6 horas** (tinha sido reduzida pra 1h a pedido anterior do Daniel; ele
pediu pra voltar). Job `robo_abastecimentos_postos` reagendado (`0 */6 * * *`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.57 — Preços de combustíveis do posto

Pedido do Daniel: uma tela de preços, pros dois lados — o posto cadastra o próprio preço por
combustível, o cliente de frota vê os preços dos postos com quem já negocia.

Nova tabela `precos_postos` (`empresa_posto_id`, `combustivel`, `preco`, `atualizado_em`,
`atualizado_por`) — um preço "vigente" por combustível por posto (sem histórico por ora; `unique
(empresa_posto_id, combustivel)` garante o upsert). RLS separada por operação, diferente do padrão
"tenant_all" de uma coisa só usado em outras tabelas: leitura liberada pro próprio posto OU qualquer
cliente que tenha ALGUMA negociação com aquele posto (pendente, aceita, recusada ou cancelada — ajuda
a avaliar mesmo antes de fechar), via `exists (select 1 from negociacoes_postos ...)` (mesmo padrão
de `negociacoes_postos_rodadas`); escrita (insert/update/delete) restrita só ao próprio posto — se
fosse uma política "for all" só com a condição de leitura, um cliente em negociação também conseguiria
editar o preço do posto, o que seria um problema real de permissão.

Tela `/precos-postos`, compartilhada (mesmo espírito de `/negociacoes`): visão do posto mostra um
formulário com um campo de preço por combustível de `PRODUTOS_POSTO` (11 produtos, deixa em branco o
que não vende) e salva com upsert (`salvarPrecosPostoAcao`); visão do cliente lista, por posto com quem
tem negociação, os preços que ele publicou (sem filtro adicional no código — a RLS já faz o recorte
certo). Item de menu novo em `menuPosto` ("💲 Meus Preços") e em `menuOperacao` ("💲 Preços dos Postos
Parceiros"). Permissão `aba_precos_postos` (todos os 4 perfis, mesmo padrão de `aba_negociacoes`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.58 — Abastecimentos na visão do posto ("o que eu forneci")

Pedido do Daniel: a tela `/abastecimentos` (hoje só do ponto de vista do cliente — "o que eu
consumi") também precisava existir pro posto, mostrando o que ele forneceu.

Faltava uma amarração: `profrotas_abastecimentos.pv_cnpj` nunca era preenchido pelo robô (só
`pv_razao_social`, texto solto) — sem o CNPJ não dava pra filtrar por tenant nem escrever uma política
de RLS. `gerar_abastecimentos_postos_robo()` passou a gravar `pv_cnpj` também (o CNPJ do posto
negociado, quando existe uma negociação vigente; senão o CNPJ fixo do "Posto Teste Ltda"); backfill
rodado nos 36 registros já gerados antes desta fase. Nova política `profrotas_abastecimentos_leitura_posto`:
libera SELECT pra quem for dono (via `empresas_do_usuario`) de uma empresa cujo CNPJ normalizado bate
com o `pv_cnpj` da linha — mexe só na leitura, a escrita continua restrita a quem já escrevia.

`abastecimentos/page.tsx` ganhou o mesmo branch por segmento já usado em `/dashboard`,
`/negociacoes` e `/precos-postos`: resolve o segmento da empresa selecionada logo no início e, se for
"Revenda", desvia pro novo componente `AbastecimentosPosto` (KPIs de volume/receita/preço médio,
filtro por combustível, tabela com cliente/placa/motorista) — sem seletor de cliente, já que o posto
sempre é uma única empresa. Item de menu "🛢️ Abastecimentos" adicionado no `menuPosto`.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.59 — Robô usa o preço que o próprio posto publicou

Ajuste pontual: agora que existe `precos_postos` (Fase 27.57), o robô de abastecimentos simulados
devia usar esse preço em vez de ignorá-lo e cair sempre na média da ANP.

`gerar_abastecimentos_postos_robo()` passou a consultar `precos_postos` pelo combustível exato
sorteado, pro posto em uso (negociado ou o "Posto Teste Ltda" padrão) — se o posto publicou preço
daquele produto, usa ele como base (± 1%, variação pequena porque é um preço que o posto já fixou);
só cai pra estimativa da média nacional da ANP (± 3%, com os adicionais de "Alta Octanagem"/"Aditivado")
quando o posto não tem esse combustível específico cadastrado em `precos_postos`. Testado: com os 3
preços semeados no Posto Teste Ltda (Gasolina Comum, Gasolina Aditivada, Etanol Comum), os novos
abastecimentos saíram bem próximos do valor publicado; "Gasolina Alta Octanagem" (sem preço próprio
cadastrado) continuou vindo da estimativa ANP, como esperado.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos) — mudança é só SQL, sem arquivo TypeScript
alterado nesta fase.

## Fase 27.60 — Indicadores de desempenho no Dashboard do posto

Pedido do Daniel: o dashboard do posto (Fase 27.56) tinha só indicadores de negociação — faltava
desempenho de venda de verdade (por combustível, volume, preço médio, venda diária, ticket médio).

Fonte: os mesmos abastecimentos fornecidos já usados em `AbastecimentosPosto` (Fase 27.58) —
`profrotas_abastecimentos` filtrado por `pv_cnpj`, últimos 30 dias. `DashboardPosto.tsx` ganhou:
5 indicadores no topo (abastecimentos, volume transacionado, receita total, preço médio praticado,
ticket médio); uma tabela "Desempenho por combustível" (volume, preço médio, receita e % do volume
total, ordenada do mais vendido pro menos); e um gráfico "Venda diária por combustível" dos últimos 14
dias (1 linha por combustível) — reaproveitando `GraficoEvolutivoPostos`, o mesmo componente
multi-série já usado no dashboard de Frota pra comparar postos ao longo do tempo (o componente é
genérico o bastante: só espera `{diaLabel, [série]: valor}`, então funcionou sem nenhuma mudança nele).
Os indicadores de negociação continuam na tela, agora numa seção "Negociações" abaixo do desempenho de
vendas.

**Correção (mesma fase, reportada pelo Daniel):** o gráfico "Venda diária" vinha sempre zerado. Causa:
a janela de dias ia de "hoje − 14" até "hoje − 14 + 13" — ou seja, terminava ONTEM, nunca incluindo o
dia de hoje (onde o robô acabou de gerar os abastecimentos mais recentes). Corrigido pra terminar hoje
(inclusive) e começar 13 dias atrás.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.61 — Robô: 1 abastecimento por veículo por dia

Ajuste pedido pelo Daniel: em vez de sortear 5-8 veículos aleatórios por execução (o que deixava boa
parte da frota sem nenhum abastecimento em vários dias, e um mesmo veículo podendo repetir no mesmo
dia), o robô passa a cobrir TODO veículo ativo de cada cliente, no máximo 1 abastecimento por dia
por veículo.

`gerar_abastecimentos_postos_robo()` trocou o sorteio por um `for ... loop` sobre todo veículo ativo
do cliente que ainda **não** tem um abastecimento do robô (`sync_key like 'robo-%'`) com
`data_abastecimento::date = current_date`. Como o job continua rodando a cada 6h (4x/dia), na prática
a primeira execução do dia cobre a frota inteira (testado: 2.347 registros inseridos de uma vez,
cobrindo os ~2.385 veículos ativos dos 2 clientes) e as 3 execuções seguintes do mesmo dia não geram
nada de novo (testado: chamada imediatamente em seguida devolveu 0) — cada veículo, exatamente 1 vez
por dia. O horário do abastecimento também passou a ser sorteado dentro do dia inteiro (não só na
janela de 6h da execução), já que a lógica não é mais "gerar N agora" e sim "cobrir quem falta hoje".

Validado com `select gerar_abastecimentos_postos_robo();` chamado duas vezes seguidas (2347, depois 0).

## Fase 27.63 — Robô: garantia de 1 abastecimento/veículo/dia no nível do banco

Daniel reportou que ainda via mais de 1 abastecimento do robô por veículo no mesmo dia. Investigação
achou 26 linhas extras espalhadas em 14 veículos de um dos clientes, todas geradas hoje — causa real:
chamadas manuais de teste da função (feitas durante a Fase 27.61) caíram na mesma transação/mesmo
instante (`criado_em` idêntico entre linhas do mesmo veículo), e o `not exists` da versão anterior,
sozinho, não é à prova de reentrância/corrida — só evita duplicata se a linha anterior já estiver
commitada e visível na hora da checagem.

Corrigido com uma constraint de banco de verdade em vez de confiar só na consulta: nova coluna
`profrotas_abastecimentos.robo_dia_referencia` (date, gravada pelo próprio robô a cada insert como
`current_date` — evitando um índice sobre `data_abastecimento::date`, que não é `IMMUTABLE` e não
serve de índice) e um índice único parcial `uq_profrotas_abastecimentos_robo_um_por_dia` em
`(cnpj_frota, veiculo_placa, robo_dia_referencia) where sync_key like 'robo-%'`. O insert do robô
passou a usar `on conflict (...) where sync_key like 'robo-%' do nothing`, e a seleção de veículos
ganhou `distinct on (placa)` como defesa extra contra placa duplicada em `cadastro_veiculos`. As 26
linhas extras existentes foram removidas (mantida a mais antiga de cada veículo/dia) antes de criar o
índice.

Validado: `select gerar_abastecimentos_postos_robo();` chamado logo após a migração devolveu 0 (dia já
coberto) e uma nova checagem de duplicatas por `(cnpj_frota, robo_dia_referencia, veiculo_placa)`
não retornou nenhuma linha.

## Fase 27.62 — Auditoria: data/hora e usuário nas telas de Preços e Negociações

Pedido do Daniel: nas telas de Preços (ambas as visões) e Negociação (ambas as visões), mostrar a
data/hora da última atualização e quem fez (nome e e-mail).

`precos_postos` já tinha `atualizado_em`/`atualizado_por` (Fase 27.57) — faltava só exibir.
`negociacoes_postos` não tinha usuário nenhum registrado nas mutações; ganhou a coluna
`atualizado_por` (texto, e-mail de quem agiu), com backfill a partir de `criado_por` pras linhas já
existentes. As 4 funções de `src/lib/negociacoesPostos.ts` que mudam o cabeçalho da negociação
(`criarNegociacao`, `adicionarContraproposta`, `decidirNegociacao`, `cancelarNegociacao`) passaram a
gravar `atualizado_por` a cada chamada — `cancelarNegociacao` ganhou um 3º parâmetro
(`canceladoPor: string | null`) só pra isso; `negociacoes/actions.ts` resolve
`supabase.auth.getUser()` em cada Server Action e repassa o e-mail pras funções da lib.

Como nenhuma das duas tabelas guarda o nome de quem atualizou (só o e-mail, que é a chave de junção
universal com `usuarios_app` — sem FK entre elas, mesmo padrão de `dashboard/layout.tsx`), toda tela
resolve o nome à parte com uma consulta `usuarios_app.select("nome, email").in("email", [...])` e cai
pro e-mail puro quando não há `nome` cadastrado ou a linha não existe.

Nova função utilitária `formatarDataHoraBr` em `src/lib/utils.ts` — ao contrário de `formatarDataBr`
(que evita `new Date()` de propósito, por lidar com colunas `date` puras), esta usa `new Date()` com
`timeZone: "America/Sao_Paulo"` porque `atualizado_em` é `timestamptz`, um instante de verdade, não
uma data solta.

Telas ajustadas: `/negociacoes` (lista) ganhou a coluna "Atualizado por" (nome + e-mail) ao lado de
"Atualizado em" (agora com hora); `/negociacoes/[id]` (detalhe) ganhou a mesma informação abaixo do
status, no cabeçalho; `/precos-postos` do lado do posto (`FormularioPrecosPosto.tsx`) ganhou uma
legenda "Atualizado em ... por ..." abaixo de cada campo de preço; `/precos-postos` do lado do cliente
(`PainelCliente`) ganhou a coluna "Atualizado por" na tabela por posto.

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos tocados (limpos).

## Fase 27.64 — Painel Financeiro do Posto (contas a receber e a pagar)

Pedido do Daniel: uma tela financeira pro posto, com indicadores financeiros e contas a pagar/receber
de clientes por período (dia, semana, quinzena, mês). Antes de programar, pesquisei ideias de outras
soluções (ERPs, ferramentas de cobrança) e mapeei o que já existia (`/financeiro`, hoje só do lado da
Frota — custos e orçamento, sem contas a receber) — depois confirmei com o Daniel 3 decisões de
modelagem que não tinham resposta óbvia no sistema atual: como as faturas são geradas (agrupadas por
cliente, conforme a vigência de cada negociação, não um ciclo universal fixo), como são disparadas
(automaticamente por robô/cron, mesmo espírito do robô de abastecimentos) e o prazo de vencimento
(configurável por negociação, não fixo pro sistema todo). As despesas do posto (contas a pagar) ficaram
com lançamento manual, mesmo padrão de `custos_fixos` (Frota).

**Modelo de dados:** `negociacoes_postos` ganhou `ciclo_faturamento_dias` e `prazo_vencimento_dias`
(default 30, mas configurável por negociação). Nova tabela `faturas_postos` — 1 linha por período
fechado de cada negociação (`negociacao_id`, `periodo_inicio`, `periodo_fim`, `vencimento`,
`valor_total`, `volume_total`, `quantidade_abastecimentos`, `status` aberta/paga/cancelada,
`cliente_nome` denormalizado — mesmo achado da Fase 27.51, join contra `empresas` falharia em silêncio
pro lado de fora da negociação); `unique(negociacao_id, periodo_inicio, periodo_fim)` evita fatura
duplicada do mesmo período. `profrotas_abastecimentos` ganhou `fatura_posto_id` (FK nullable) — quando
um abastecimento é coberto por uma fatura, o vínculo é gravado, e a próxima geração de fatura só
considera abastecimentos com `fatura_posto_id is null` (evita faturar o mesmo registro 2 vezes). Nova
tabela `despesas_postos` (contas a pagar) — `tipo` (combustível/distribuidora, salários, manutenção,
impostos, aluguel, energia, outro — lista confirmada com o Daniel), `valor`, `competencia`,
`vencimento`, `recorrente`, `status`, lançamento manual do próprio posto.

**RLS:** `faturas_postos` segue o padrão dual-tenant já usado em `precos_postos`/`negociacoes_postos`
— leitura liberada tanto pro posto (dono) quanto pro cliente da fatura (precisa ver o que deve);
escrita (marcar paga/cancelada) só pro posto. `despesas_postos` é single-tenant simples (só o posto,
igual `custos_fixos`), já que é despesa própria, sem contraparte.

**Robô `gerar_faturas_postos_robo()`** (novo, `pg_cron` diário às 03:00 UTC, job `faturas_postos_robo`):
pra cada negociação `aceita`, mantém um "cursor" (`max(periodo_fim)` das faturas já geradas, ou
`vigencia_inicio` se ainda não há nenhuma) e fecha, em sequência, todo período de `ciclo_faturamento_dias`
que já tenha decorrido totalmente (não fatura hoje nem o futuro), somando os abastecimentos fornecidos
naquela janela (`profrotas_abastecimentos` por `pv_cnpj`/`cnpj_frota`, ainda sem fatura) — vencimento =
fim do período + `prazo_vencimento_dias`. Testado idempotente: rodou, gerou 6 faturas; rodou de novo,
gerou 0.

**Dado de demonstração:** como a lógica "1 abastecimento/veículo/dia" (Fase 27.61) só passou a valer
nesta sessão, só havia abastecimento real pro dia de hoje — nenhum período fechado teria nada pra
faturar. Semeei um histórico sintético de 44 dias pros 2 clientes de teste (claramente marcado
`sync_key = 'seed-fase-27.64-...'`, mesmo espírito do seed de `precos_postos` da Fase 27.57) e ajustei
o ciclo dessas 2 negociações pra quinzenal (15 dias) — só pra existir uma tela populada pra mostrar;
o comportamento do robô em produção (ciclo/vencimento configurados por negociação real) não muda.

**Tela `/financeiro-posto`** (exclusiva do segmento Revenda — quem acessa sendo Frota vê um aviso
com link pro `/financeiro` de custos/orçamento): seletor de período (Hoje/7 dias/15 dias/Mês
atual/Personalizado, por URL); 6 indicadores (a receber em aberto, vencido/inadimplência, recebido no
período, a pagar em aberto, pago no período, saldo previsto do período); gráfico de fluxo de caixa
previsto (barras "a receber" x "a pagar" por dia de vencimento, componente novo
`GraficoFluxoCaixaPosto.tsx`, já que o `GraficoEvolutivoPostos` existente tem o tooltip fixo em litros);
aging list das contas a receber vencidas (0-15/16-30/31-60/60+ dias, padrão citado nas ferramentas de
cobrança pesquisadas); tabela de contas a receber (cliente, período, vencimento, valor, status, ação
"marcar como paga"/"cancelar"); formulário de lançar despesa + tabela de contas a pagar (mesmas ações).
Status "vencida" não é um valor gravado no banco — é derivado (`aberta` + vencimento no passado), mesmo
espírito do filtro "Vigente" em `/negociacoes` (Fase 27.54).

Novos arquivos: `src/lib/financeiroPostos.ts` (tipos, rótulos, seletor de período, aging);
`src/app/(dashboard)/financeiro-posto/{page,actions}.tsx` e `_components/{GraficoFluxoCaixaPosto,
FormularioDespesaPosto, BotaoAcaoFinanceiraPosto}.tsx`. Menu do posto ganhou "💰 Financeiro" e a
permissão `aba_financeiro_posto` (mesmo padrão de `aba_precos_postos`).

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos tocados (limpos).

## Fase 27.65 — Filtros em Abastecimentos (visão posto) + solicitação de ajuste com aprovação

Pedido do Daniel, em duas partes: (A) filtro de cliente/data inicial/data final/campo livre na tela
de Abastecimentos, pro posto conseguir pesquisar; (B) um mecanismo pra cliente ou posto solicitarem
ajuste num abastecimento — a outra parte precisa aprovar ou recusar antes da mudança valer, com
notificação (bolinha vermelha) pros dois lados.

**Parte A — filtros e paginação na visão do posto.** `AbastecimentosPosto.tsx` (visão do posto dentro
de `/abastecimentos`, Fase 27.58) só tinha a pill de combustível e um `.limit(500)` sem paginação —
diferente da visão Frota, que já tinha filtro completo desde a Fase 27.8/27.31 e paginação desde a
Fase 27.12. Ganhou: seletor de cliente (lista só quem já abasteceu naquele posto, não a lista genérica
de negociações), campo livre (`q`, ilike em placa/motorista/razão social do cliente), data
inicial/final (`de`/`ate`, gte/lte em `data_abastecimento`) e paginação com o componente `Paginacao`
já existente. Os filtros combinam com a pill de combustível (todos viram query string na URL) e os 4
indicadores do topo (abastecimentos, volume, receita, preço médio) recalculam com base neles.

**Parte B — solicitação de ajuste com aprovação.** Diferente da edição direta que já existia
(`AbastecimentoForm.tsx`), aqui uma das partes propõe uma correção e a outra decide — mesmo espírito
das rodadas de negociação (Fase 27.50), mas com uma diferença importante: negociação só "fotografa"
os termos aceitos no cabeçalho; aqui, aceitar precisa de fato **aplicar** a mudança na linha real de
`profrotas_abastecimentos`. Isso só é possível com uma função `SECURITY DEFINER`
(`decidir_ajuste_abastecimento`), porque a RLS de `profrotas_abastecimentos` só libera update pro
cliente dono da linha — o posto, que também pode aprovar, não teria permissão de escrita naquela
tabela por conta própria.

Esse mecanismo só existe quando o abastecimento tem uma **contraparte identificável**: o cliente
precisa ser uma empresa cadastrada (`empresa_id`, já é FK) *e* o posto também (resolvido comparando o
`pv_cnpj`, que é só texto solto vindo da integração, contra as empresas com `segmento = 'Revenda'`).
Sem isso — posto avulso, não integrado à FNI — a edição continua exatamente como sempre foi, sem
aprovação (não tem "outro lado" pra notificar).

**Modelo de dados:** `ajustes_abastecimentos` (cabeçalho: abastecimento, empresa cliente, empresa
posto, origem, `status` pendente_cliente/pendente_posto/aceito/recusado/cancelado, rodada atual) +
`ajustes_abastecimentos_rodadas` (histórico: autor, os 6 campos ajustáveis — data/hora, hodômetro,
combustível, litros, preço unitário, valor total, todos opcionais, decisão pendente/aceita/recusada/
contraproposta). Índice único parcial garante só 1 ajuste em aberto por abastecimento
(`uq_ajustes_abastecimentos_um_em_aberto`), mesma técnica da Fase 27.63.

**Decisão importante do Daniel sobre RLS:** ao contrário de praticamente toda outra tabela do sistema,
`ajustes_abastecimentos`/`_rodadas` **não têm bypass de admin nem do e-mail superusuário** — só quem
literalmente é cliente ou posto daquele ajuste (via `empresas_do_usuario`) consegue ver ou responder,
sem exceção de perfil. Por isso o contador do badge (`contarAjustesAbastecimentosPendentesAcao`) não
tem branch de admin — a RLS já devolve 0 sozinha pra quem não é parte.

**Fluxo:** quem detecta o erro abre "Solicitar ajuste" em `/abastecimentos/[id]`, preenche só os
campos que quer corrigir (os demais ficam como estão) e um motivo opcional. A outra parte vê a
proposta e escolhe Aprovar, Recusar ou enviar uma Contraproposta (mesma mecânica de rodadas
alternadas da negociação). Aprovar dispara a RPC, que confere se quem está decidindo é realmente a
vez daquele lado, aplica os campos propostos (via `coalesce`, só sobrescrevendo o que veio preenchido)
em `profrotas_abastecimentos` e fecha o ajuste como `aceito`. Qualquer uma das partes pode cancelar
uma solicitação em aberto a qualquer momento.

Testado ponta a ponta simulando a sessão de `posto.teste@fni.test` (via `set local request.jwt.claims`)
aceitando uma proposta do lado cliente: a RPC aplicou corretamente o novo valor na linha real, marcou
a rodada como `aceita` e o cabeçalho como `aceito`. Dados de teste removidos depois da validação.

Novos arquivos: `src/lib/ajustesAbastecimentos.ts` (tipos, rótulos, validação, CRUD do ajuste);
`src/app/(dashboard)/abastecimentos/_components/{FormularioSolicitarAjuste,
PainelAjusteAbastecimento}.tsx`. `abastecimentos/[id]/page.tsx` foi reescrita pra decidir, por
abastecimento, entre a edição direta (sem contraparte) ou o painel de ajuste (com contraparte) — o
botão de excluir também some quando há contraparte (exclusão ficou fora do escopo desta fase). Menu
ganhou o badge de "ajustes aguardando resposta" ao lado de Abastecimentos, tanto pro posto quanto pra
Frota, mesmo padrão visual das demais notificações (negociações, acessos de clientes etc.).

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos tocados (limpos).

## Fase 27.66 — Correções no fluxo de ajuste de abastecimentos

Depois de publicado, o Daniel testou a Fase 27.65 de verdade e achou 2 problemas.

**Link ausente pro detalhe na visão do posto:** `AbastecimentosPosto.tsx` nunca teve link da linha da
tabela pro detalhe (`/abastecimentos/[id]`) — diferente da visão Frota, que sempre teve (achado real,
existia desde a Fase 27.58, só ficou visível agora porque o posto passou a precisar abrir o registro
pra responder um ajuste). Corrigido: mesma coluna Data agora é link, igual à visão Frota.

**Formulário de ajuste agora vem preenchido:** o formulário (`FormularioSolicitarAjuste.tsx`) pedia
pra digitar do zero só o(s) campo(s) alterado(s), com o valor atual só como legenda ao lado. O Daniel
achou mais natural o campo já vir com o valor atual dentro — daí só edita o que precisa. Litros e
Preço por litro agora recalculam o Valor total automaticamente (o usuário ainda pode sobrescrever o
total na mão, se quiser um valor diferente do produto exato). Como o formulário só ENVIA pro servidor
os campos que de fato mudaram em relação ao valor atual (comparação feita no submit, antes de montar o
FormData), a regra de "a rodada só grava o que foi alterado" continua valendo sem precisar tocar em
`ajustesAbastecimentos.ts` nem na RPC.

**Investigação em andamento — solicitação de ajuste não aparece pro lado cliente/frota:** o Daniel
relatou que, ao testar, a solicitação de ajuste "apareceu pro admin" mas não pro usuário frota/cliente.
Testei a política de RLS de INSERT em `ajustes_abastecimentos` simulando o e-mail
`daniel.peruffo.app@gmail.com` (vinculado de verdade, via `usuarios_empresas`, à Transportes de Cargas
Testes Ltda — achado novo: ao contrário do que a sessão anterior registrou, esse e-mail TEM vínculo
real, diferente do e-mail principal do Daniel, que só tem `cnpj_vinculado` solto em `usuarios_app`, sem
linha em `usuarios_empresas`) — a inserção funcionou normalmente e o registro ficou visível. Isso indica
que o problema é específico da conta/sessão usada no teste, não da regra de acesso. Aguardando o Daniel
confirmar qual conta e qual abastecimento ele usou pra reproduzir com precisão.

Validado com `npx tsc --noEmit` e `npx eslint` no `FormularioSolicitarAjuste.tsx` (limpo).

## Fase 27.67 — Bolinha vermelha na própria linha do abastecimento com ajuste pendente

O Daniel esclareceu que o indicador de notificação precisa aparecer em 2 lugares: no menu (já existia,
badge agregado ao lado de "Abastecimentos") e também na própria linha do registro na lista — pra dar
pra identificar de cara QUAL abastecimento tem um ajuste em andamento, sem precisar abrir um por um.

Adicionado nas duas visões (`AbastecimentosPosto.tsx` e `page.tsx`/visão Frota): depois de carregar a
página atual da tabela, uma consulta extra busca em `ajustes_abastecimentos` quais desses IDs têm
ajuste com status `pendente_cliente` ou `pendente_posto` (a RLS já limita o resultado aos ajustes que
envolvem a empresa/posto selecionado — não precisa filtro adicional de tenant). Os IDs encontrados
ganham uma bolinha vermelha ao lado da data, dentro do próprio link pro detalhe.

Nesta fase também foi reportado, mas ainda não reproduzido, um problema mais sério: testando de ponta
a ponta (cliente cria o ajuste, posto verifica), o posto não recebeu nem o badge do menu nem qualquer
sinal de que existe uma solicitação pendente — o que sugere que a criação do ajuste não está se
concretizando (ou não está sendo associada corretamente ao posto), não só um problema de visualização.
A investigação ficou pendente de acesso ao banco de dados (indisponível nesta sessão) — ver próximos
passos no início da conversa seguinte.

Validado com `npx tsc --noEmit` e `npx eslint` nos arquivos tocados (limpos).

## Fase 27.68 — Causa raiz real do ajuste "sumido" + filtro de pendentes

Com o acesso ao banco reconectado, confirmei que a criação do ajuste sempre funcionou (2 registros de
teste reais existiam em `ajustes_abastecimentos`, com `status`/`empresa_cliente_id`/`empresa_posto_id`
corretos) — o problema era só na exibição, mas de um jeito mais sério do que "falta um link": no
`/abastecimentos/[id]`, quem NÃO fosse admin/superusuário via a tela de **edição direta de sempre**
em vez do painel de ajuste, mesmo com uma solicitação de verdade pendente pra aquele registro.

**Causa raiz:** a página resolvia o posto (pra decidir se o abastecimento "tem contraparte") consultando
`empresas` filtrado por `segmento = 'Revenda'`, usando o client autenticado do próprio usuário — sujeito
à RLS `empresas_select_membro`, que só libera ver empresas das quais o usuário é membro (com bypass só
pro e-mail superusuário e pro perfil admin). Um cliente comum (ex: `daniel.peruffo.app@gmail.com`,
perfil `gestor_frota`) nunca é "membro" do posto — a busca vinha sempre vazia, `empresaPostoId` ficava
`null`, `temContraparte` dava falso, e a tela caía na edição direta, escondendo o painel de aprovação.
A bolinha vermelha (Fase 27.67) não sofria desse problema por consultar `ajustes_abastecimentos`
diretamente, sem depender de `empresas` — por isso ela aparecia normalmente enquanto a tela de detalhe
não trazia as opções de aprovar/recusar/contrapor.

**Correção:** nova função `resolver_empresa_por_cnpj_segmento(p_cnpj, p_segmento)`, `SECURITY DEFINER`,
que resolve o id de uma empresa por CNPJ normalizado + segmento ignorando a RLS de `empresas` — expõe
só o ID (nada mais da tabela), então não abre nenhum dado cross-tenant além do estritamente necessário
pra esse fluxo. `abastecimentos/[id]/page.tsx` passou a usar essa RPC em vez da consulta direta; também
aproveitado pra remover outra consulta que tinha o mesmo problema (nome do cliente, agora lido direto de
`frota_razao_social`, já denormalizado na própria linha do abastecimento — sem precisar de join, mesmo
achado já registrado nas Fases 27.51/27.64).

**Filtro "Pendente de ajuste":** Daniel pediu um jeito melhor de visualizar quais abastecimentos têm
ajuste em aberto, sem precisar abrir um por um. Adicionada uma pill de filtro (🔴 Pendente de ajuste) nas
duas visões (`AbastecimentosPosto.tsx` e a visão Frota em `page.tsx`) — reaproveita a mesma consulta que
já alimentava a bolinha da linha (Fase 27.67), agora buscada uma vez só (não mais por página) e usada
tanto pro filtro quanto pro indicador visual.

Testado com a RPC simulando a sessão real do `daniel.peruffo.app@gmail.com`: antes da correção, a
consulta direta a `empresas` vinha vazia; com a nova função, resolve corretamente o posto.

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos tocados (limpos).

## Fase 27.69 — Gráfico "Venda diária" do Dashboard do posto zerando a partir de hoje

Achado real (reportado pelo Daniel, print do gráfico com um pico e depois zerando a partir de hoje):
mesmo bug de fundo já documentado nas Fases 8/27.38/27.43 — o PostgREST corta qualquer resposta em
1.000 linhas por padrão, **mesmo quando o código pede `.limit(5000)`** (o limite do servidor não é
sobreposto pelo `.limit()` do client). `DashboardPosto.tsx` buscava todos os abastecimentos brutos dos
últimos 30 dias pra calcular os KPIs de venda E o gráfico diário em JavaScript — com o Posto Teste
gerando ~2.385 abastecimentos/dia (1 por veículo/dia, frota de teste grande), o corte de 1.000 linhas
acontecia no meio do dia mais antigo já teria — os dias mais recentes (inclusive hoje) ficavam de fora
do gráfico, e os KPIs (abastecimentos, volume, receita, ticket médio) vinham subestimados também, não
só o gráfico.

Corrigido com nova função agregada `resumo_vendas_diarias_posto(p_pv_cnpj, p_desde)` — devolve
`(dia, item_nome, quantidade, volume, receita)` já somado por dia+combustível direto no banco, no
máximo dias×combustíveis linhas (bem longe do limite de 1.000, não importa quantos abastecimentos
brutos existam por baixo). `DashboardPosto.tsx` passou a montar os KPIs e o gráfico a partir desse
resumo agregado, em vez de reduzir linha por linha em JS.

**Risco relacionado, ainda não corrigido:** o Dashboard geral (visão Frota/admin, `dashboard/page.tsx`)
tem uma consulta parecida (`profrotas_abastecimentos` dos últimos 6 meses, `.limit(5000)`, sem filtro de
empresa) que alimenta o mesmo `GraficoEvolutivoPostos` — provavelmente sofre do mesmo corte de 1.000
linhas, numa escala ainda maior (todas as empresas juntas). Não mexi nisso ainda porque é uma tela
diferente e o Daniel não relatou problema nela — fica registrado aqui pra não esquecer.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.73 — Painel financeiro do admin com indicadores da FNI

Pedido do Daniel: o painel financeiro visto pelo admin deveria mostrar indicadores da FNI (o próprio
SaaS), não de um cliente ou posto específico. `/financeiro` sempre exigiu selecionar um cliente (é o
painel de custo/orçamento DAQUELE cliente) — quem já cumpria esse papel pro lado da FNI era `/assinaturas`
(Fase 20, exclusivo admin), só que faltavam faturamento/inadimplência reais e churn/novos assinantes do
mês (só existia contagem por status e MRR estimado, sem noção de período).

Confirmado com o Daniel: manter MRR + assinantes por plano (já existia) e adicionar faturamento/
inadimplência dos clientes + churn/novos assinantes do mês.

**Faturamento/inadimplência do mês:** direto de `invoices` (histórico real de cobrança gravado pelo
`stripe-webhook` em `invoice.payment_succeeded`/`failed`, status `pago`/`falhou`) — diferente do MRR, que
é uma ESTIMATIVA a partir do preço atual do plano de quem está "ativo" agora, não da cobrança de verdade.

**Churn do mês:** `empresas.cancelado_em` dentro do mês (gravado em `customer.subscription.deleted`).

**Novos assinantes do mês:** aproximação — empresas com plano pago cujo `created_at` cai dentro do mês
(cobre quem já nasce contratando via `/cadastro` + checkout no mesmo dia; quem começa em trial e converte
depois não é capturado por este critério, já que não existe uma coluna dedicada de "data de conversão pra
pago" — limitação documentada no código).

**Achado ao implementar:** duas tabelas reais do banco nunca tinham sido adicionadas a
`database.types.ts` — `empresas.cancelado_em` (existe desde a Fase 20) e a tabela `invoices` inteira.
Ambas adicionadas agora. Confirmado via RLS que o admin já enxerga todas as invoices de todos os
clientes (`invoices_tenant_select` tem bypass pra `perfil_usuario_atual() = 'admin'`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.70 — Seção "Ajustes de abastecimento" nos dashboards e painéis financeiros

Pedido do Daniel: incrementar os dashboards de cliente e posto, e os painéis financeiros de ambos, com
os abastecimentos ajustados — especificamente os 3 itens que ele escolheu: contador de ajustes
pendentes/aceitos no período, impacto financeiro dos ajustes aceitos, e lista dos últimos ajustes.

**Snapshot do valor original (`valor_original`):** quando um ajuste é aceito, `decidir_ajuste_abastecimento`
sobrescreve `profrotas_abastecimentos` com os valores novos — o valor de ANTES se perde. Sem guardar
esse valor em algum lugar, não dava pra calcular um impacto financeiro real (só um proxy). Adicionada a
coluna `ajustes_abastecimentos.valor_original numeric`, preenchida no momento da criação da solicitação
(`criarSolicitacaoAjuste`, com o `item_valor_total` atual do abastecimento vindo por um campo oculto do
formulário — `FormularioSolicitarAjuste.tsx` → `valor_original_total` → `solicitarAjusteAcao`). Ajustes
criados ANTES desta fase não têm esse valor (ficam com `impacto financeiro = R$ 0,00` pra eles, já que
não tem como recuperar o valor de antes retroativamente) — só ajustes novos entram no cálculo real.

**Cálculo do impacto financeiro:** o valor ACEITO de fato não fica no cabeçalho do ajuste (que só tem o
valor de ANTES) — fica na rodada com `decisao = 'aceita'`, em `ajustes_abastecimentos_rodadas.item_valor_total`.
Nova função `resumoAjustesAbastecimentos` (`src/lib/ajustesAbastecimentos.ts`) busca os ajustes aceitos
no período, cruza com a rodada aceita de cada um, e soma `(valor_aceito - valor_original)`. Se a rodada
aceita não mexeu no valor total (ex: só corrigiu hodômetro), aquele ajuste específico não entra na soma
— faz sentido, não houve variação financeira nesse caso.

**Um helper, 4 telas:** `resumoAjustesAbastecimentos(supabase, { lado, empresaId, desde })` é o mesmo
em todo lugar — só muda `lado` ("cliente" ou "posto", decide se filtra por `empresa_cliente_id` ou
`empresa_posto_id`) e qual empresa está selecionada. A apresentação (cards + tabela de últimos ajustes)
é um componente único, `SecaoAjustesAbastecimentos.tsx` (`src/app/(dashboard)/_components/`), reaproveitado
em `DashboardPosto.tsx`, `dashboard/page.tsx` (Frota), `financeiro/page.tsx` e `financeiro-posto/page.tsx`
— sem duplicar JSX 4 vezes.

Janela de período usada em todas as 4 telas: últimos 30 dias (mesma janela já usada no dashboard do
posto pra desempenho de vendas).

Validado com `npx tsc --noEmit` e `npx eslint` em todos os arquivos tocados (limpos). Testado com
consulta direta no banco confirmando a estrutura de `ajustes_abastecimentos_rodadas` (colunas
`ajuste_id`, `item_valor_total`, `decisao`) usada pela função.

## Fase 27.71 — Resumo consolidado de ciclo abastecimento+pagamento na aba Cliente

Pedido do Daniel: na tela de detalhe do cliente (`/clientes/[id]`, visão admin — o cadastro das
transportadoras atendidas pela plataforma), adicionar um resumo NOVO do ciclo de abastecimento e
pagamento desse cliente. Confirmado via AskUserQuestion: não é pra reaproveitar as telas existentes de
negociação/fatura por posto (`/negociacoes`, `/financeiro-posto`, que olham 1 posto de cada vez) — é uma
visão consolidada cruzando TODOS os postos com quem aquele cliente já negociou, papel da FNI de
acompanhar a saúde financeira de cada cliente perante a rede de postos.

Novo componente `CicloAbastecimentoPagamento.tsx` (`src/app/(dashboard)/clientes/_components/`),
renderizado logo abaixo do formulário de edição do cliente. Busca `negociacoes_postos` e
`faturas_postos` filtrando só por `empresa_cliente_id = id` (RLS de ambas as tabelas já tem bypass de
admin, confirmado via `pg_policies`). Mostra: indicadores (postos com negociação, negociações vigentes,
volume mín. contratado, total em aberto, vencido, pago histórico), aviso da próxima fatura a vencer, e
duas tabelas (negociações por posto, faturas por posto).

**Achado ao implementar:** `faturas_postos` não tem uma coluna de nome do posto denormalizada (só
`cliente_nome`) — diferente de `negociacoes_postos`, que tem `posto_nome`. Em vez de arriscar um join
cross-tenant direto em `empresas` (mesmo problema de RLS já documentado na Fase 27.68), o nome do posto
de cada fatura é resolvido via um mapa `empresa_posto_id -> posto_nome` montado a partir das negociações
já buscadas — toda fatura nasce de uma negociação (`negociacao_id`), então o posto sempre aparece lá
também. Evita adicionar mais uma consulta ou expor `empresas` sem necessidade.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos). Testado com consulta direta confirmando dados
reais existentes para o cliente de teste (Frotas & Frotas Ltda: 6 negociações com postos).

## Fase 27.72 — Nova aba "Clientes" no menu do posto

Pedido do Daniel: uma aba própria no menu do posto pra ver o cadastro dos clientes que já negociaram com
ele. Confirmado via AskUserQuestion: TODOS que já negociaram, qualquer status (não só os com negociação
vigente/aceita).

**Problema de RLS (mesma classe da Fase 27.68):** a lista precisa de dados de `empresas` (nome, CNPJ,
cidade/UF, segmento) dos CLIENTES — mas a RLS de `empresas` (`empresas_select_membro`) só libera ver
empresas das quais o usuário é membro, e o posto nunca é "membro" da empresa do cliente. Um SELECT direto
sempre voltaria vazio pro posto.

**Fix:** nova função `clientes_do_posto(p_empresa_posto_id)`, SECURITY DEFINER — mas com uma guarda de
autorização própria dentro da função (`empresas_do_usuario`/admin/superuser), já que roda com privilégio
elevado. Faz `negociacoes_postos JOIN empresas` e só devolve clientes que JÁ TÊM uma negociação real com
o posto informado — nunca a base de `empresas` inteira. Devolve cadastro (nome, CNPJ, cidade/UF, porte,
segmento, telefone, e-mail) + status da negociação mais recente + contagem de negociações.

Testado simulando a sessão do `posto.teste@fni.test`: retorna os 2 clientes reais que negociaram com o
Posto Teste. Testado também simulando um cliente tentando chamar a função com o id de um posto que ele
NÃO é dono — retorna vazio (guarda de autorização funcionando).

**Telas novas:**
- `/clientes-posto` — lista (mesmo padrão de seletor de empresa de `/financeiro-posto`, com o mesmo
  bloqueio pra quem não é Revenda).
- `/clientes-posto/[clienteId]` — detalhe de um cliente: cadastro + o MESMO componente
  `CicloAbastecimentoPagamento` da Fase 27.71 (reaproveitado sem alteração), só que filtrado por
  `empresa_posto_id = este posto` E `empresa_cliente_id = este cliente`, em vez de cross-posto como na
  visão admin.

Novo item no `menuPosto` (`layout.tsx`): "🏢 Clientes", entre Abastecimentos e Meus Preços.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.74 — Ciclo de faturamento/prazo de vencimento configuráveis por negociação

Pedido do Daniel: "a fatura precisa ser calculada com base no ciclo de abastecimento + pagamento setado
para o cliente". Investigação (via subagente): a função `gerar_faturas_postos_robo()` (roda via
`pg_cron`, todo dia às 3h) JÁ calculava período e vencimento de cada fatura corretamente a partir de
`negociacoes_postos.ciclo_faturamento_dias`/`prazo_vencimento_dias` — confirmado com uma consulta direta
cruzando `faturas_postos` com `negociacoes_postos` (o período de cada fatura bate exatamente com o ciclo
configurado, o vencimento bate com o prazo configurado). **O cálculo em si nunca esteve errado.**

**Causa raiz real:** esses dois campos existem no banco desde a Fase 27.64, mas NENHUM formulário da
aplicação (nem `/negociacoes`, nem a API pública `/api/integracoes/negociacoes`) jamais deixou o usuário
DEFINIR esses valores — sempre caíam no default fixo da coluna (30/30 dias), nunca "setado para o
cliente" de verdade. As negociações de teste com ciclo=15 que eu tinha visto antes tinham sido ajustadas
direto no banco (SQL manual), não pela UI.

**Fix:** ciclo de faturamento e prazo de vencimento agora fazem parte da PROPOSTA de cada rodada de
negociação, no mesmo nível de combustível/volume/preço/vigência:
- Nova coluna em `negociacoes_postos_rodadas` (só existiam no cabeçalho `negociacoes_postos`, não na
  rodada — precisavam existir na rodada pra serem "propostos" e não só herdados de algum outro lugar).
- `DadosRodada` (`negociacoesPostos.ts`) ganhou os 2 campos; `validarDadosRodada` valida que são inteiros
  positivos; `decidirNegociacao` agora fotografa esses valores no cabeçalho junto com os demais termos
  quando a negociação é aceita (mesmo mecanismo da Fase 27.54).
- `FormularioNovaNegociacao.tsx` e `FormularioContraproposta.tsx` ganharam os 2 campos de input (default
  30, contraproposta vem pré-preenchida com o valor da rodada anterior).
- Tela de detalhe da negociação (`/negociacoes/[id]`) mostra ciclo/prazo no histórico de cada rodada.
- API pública (`/api/integracoes/negociacoes` e `.../rodadas`): campos opcionais — se o sistema do posto
  não enviar, cai no ciclo/prazo já vigente da rodada atual (contraproposta) ou 30/30 (criação), sem
  quebrar integrações existentes.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

> **Nota (Fase 27.80):** este desenho foi corrigido depois que o Daniel esclareceu que ciclo/prazo NÃO é
> termo negociado — ver Fase 27.80 no fim deste arquivo pro fix definitivo (os campos saíram dos
> formulários de negociação e viraram parâmetro administrativo por cliente+posto).

## Fase 27.75 — Cobrança em aberto no painel financeiro do cliente

Pedido do Daniel (mesma mensagem da Fase 27.74): "o painel financeiro precisa mostrar a cobrança em
aberto e o impacto financeiro". O impacto financeiro (dos ajustes) já tinha entrado em `/financeiro` na
Fase 27.70 — o que faltava era a "cobrança em aberto": até aqui, ver faturas (`faturas_postos`) só era
possível do lado do POSTO (`/financeiro-posto`, "A receber"); o cliente não tinha nenhuma visão do que
ele DEVE aos postos com quem negociou.

Novo componente `CobrancaEmAberto.tsx` (`src/app/(dashboard)/financeiro/_components/`) — espelho do
"A receber" de `/financeiro-posto`, só que do lado do cliente: total em aberto, total vencido, contagem
de faturas em aberto, aviso da próxima a vencer, e tabela com todas as faturas (todos os postos).
Renderizado em `/financeiro/page.tsx` logo antes da seção de ajustes.

Nome do posto em cada fatura resolvido pelo mesmo truque das Fases 27.71/27.72/27.73 (mapa
`empresa_posto_id -> posto_nome` a partir de `negociacoes_postos`, que já denormaliza isso) — evita
outro join cross-tenant em `empresas` (mesmo problema de RLS da Fase 27.68).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.77 — Robô de teste limitado a 15 abastecimentos/dia

Pedido do Daniel: o robô que gera abastecimentos de teste (`gerar_abastecimentos_postos_robo()`, só
banco — sem código TS envolvido) criava 1 registro por VEÍCULO ATIVO de cada um dos 2 clientes de teste,
todo dia — no Posto Teste isso já tinha chegado a ~2.385/dia (essa mesma escala foi a causa do bug da
Fase 27.69, corte de 1000 linhas do PostgREST). Pedido: só 15 registros por dia, sorteando motorista,
placa e combustível.

**Achado ao implementar:** o cron (`robo_abastecimentos_postos`, `pg_cron`) roda a cada 6h — 4x por dia.
Um `LIMIT 15` fixo por EXECUÇÃO geraria até 60/dia (15 × 4), não 15/dia de verdade. Corrigido contando
quantos registros do robô já existem HOJE (`robo_dia_referencia = current_date`, somando os 2 clientes)
ANTES do sorteio, e só gerando o que falta pra completar 15 no dia — rodar de novo depois de já ter
batido 15 não insere mais nada até o dia virar.

Reescrita a função pra sortear até 15 VEÍCULOS distintos (de qualquer um dos 2 clientes, `order by
random() limit <o que falta>`), cada um sorteando seu próprio motorista e combustível — mesma lógica de
preço (via `precos_postos` do posto negociado, ou fallback pra referência ANP) e hodômetro incremental de
antes, só que rodando no máximo o necessário pra bater 15/dia.

Testado direto no banco: com os 2.385 registros de hoje (07/07) já gerados pela versão antiga ANTES da
correção, a nova função corretamente retorna 0 inserções (limite diário já estourado) — a partir de
amanhã, com a contagem do dia zerada, volta a gerar até 15.

Sem alterações em código TypeScript — mudança só na função SQL (SECURITY DEFINER) no Supabase.

## Fase 27.76 — Extrato de abastecimentos por fatura + PDF

Pedido do Daniel: cada fatura precisa trazer um extrato dos abastecimentos incluídos no período, com
botão pra gerar PDF (dados da fatura + abastecimentos).

**Nova rota compartilhada `/faturas-postos/[id]`** — não ficou dentro de `/financeiro-posto` porque a
MESMA fatura é vista pelos dois lados (posto que emitiu, cliente que deve pagar), e a RLS de
`faturas_postos` (`faturas_postos_leitura`) já libera SELECT pras duas partes (`empresa_posto_id` OU
`empresa_cliente_id`) — uma rota só, sem duplicar a tela pra cada lado.

**Extrato:** `profrotas_abastecimentos` filtrado por `empresa_id = fatura.empresa_cliente_id`,
`pv_cnpj = posto_cnpj` (resolvido via `negociacoes_postos.posto_cnpj`, denormalizado — evita join
cross-tenant em `empresas`, mesmo problema de RLS da Fase 27.68) e `data_abastecimento` dentro do período
exato da fatura. Bordas de data calculadas manualmente em UTC (mesmo cuidado da Fase 23.1) pra não
"vazar" um dia pra fora do período por causa de fuso horário. Testado direto no banco: uma fatura real
(36 abastecimentos, R$ 11.675,29) bateu EXATAMENTE com `quantidade_abastecimentos`/`valor_total` já
gravados na fatura.

**PDF:** mesmo padrão 100% client-side de `@react-pdf/renderer` já usado em Rotograma/Roteirização/
Relatórios/Assistente (Fases 15/16+) — trio `FaturaPdf.tsx` (documento), `BotaoBaixarPdfFatura.tsx`
(botão + `PDFDownloadLink`), `BotaoBaixarPdfFaturaLazy.tsx` (`next/dynamic`, `ssr:false`, já que a lib só
funciona no client). PDF traz cabeçalho da fatura (posto, cliente, período, vencimento, status, volume,
valor total) + tabela do extrato completo.

Links "Ver extrato" adicionados nas 3 telas que já listavam faturas: `/financeiro-posto` (posto),
`CobrancaEmAberto.tsx` em `/financeiro` (cliente, Fase 27.75) e `CicloAbastecimentoPagamento.tsx`
(admin/posto por cliente, Fases 27.71/27.72).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.78 — /financeiro mostrar indicadores da FNI pro admin

Achado real (reportado pelo Daniel, print de `/financeiro` mostrando "Selecione um cliente" pro usuário
admin): a Fase 27.73 pôs os indicadores financeiros da FNI (MRR, faturamento, churn) em `/assinaturas`,
mas o item de menu que o admin efetivamente usa é **"Painel Financeiro"**, que aponta pra `/financeiro`
— uma tela que sempre foi só o painel de custo/orçamento de UM cliente selecionado. Pro admin, sem
selecionar ninguém (o caso normal, já que ele não "é" nenhum cliente), a tela sempre caiu no aviso
genérico "Selecione um cliente", nunca nos indicadores da FNI.

**Fix:** conteúdo de `/assinaturas` extraído pra `IndicadoresFinanceirosFni.tsx`
(`src/app/(dashboard)/_components/`) — componente compartilhado, sem props, busca tudo sozinho.
`/assinaturas` continua existindo (link direto do menu Administração), só que agora chama o componente
compartilhado em vez de duplicar a lógica.

`/financeiro/page.tsx`: quando `perfil === "admin"` E nenhum cliente está selecionado
(`mostrarFni = ehAdmin && !empresaSelecionada`), renderiza `<IndicadoresFinanceirosFni />` em vez do
aviso "Selecione um cliente" — título/subtítulo da página também mudam pra refletir isso. Se o admin
selecionar um cliente no seletor (o dropdown ganhou a opção "Indicadores da FNI" no lugar de "Nenhum
selecionado" quando é admin), continua vendo o painel de custo NORMAL daquele cliente — nada muda pra
quem já usava assim.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.79 — Extrato de fatura vazio (CNPJ do posto não normalizado)

Achado real (reportado pelo Daniel, print do extrato vazio numa fatura PAGA e confirmado depois em faturas
ABERTAS também): a Fase 27.76 resolvia o `pv_cnpj` do posto via `negociacoes_postos.posto_cnpj`, mas esse
campo é preenchido de forma inconsistente — só é gravado quando a negociação nasce do lado do CLIENTE
(ele digita o CNPJ do posto-alvo); quando nasce do lado do POSTO (`origem = 'posto'`, ex: via API
`/api/integracoes/negociacoes`), o formulário só pede o CNPJ do CLIENTE-alvo, então `posto_cnpj` fica
`""` (string vazia) — nunca o CNPJ de verdade do posto. Mesmo nos casos em que `posto_cnpj` vinha
preenchido, o valor não tem pontuação (`normalizarCNPJ`), enquanto `profrotas_abastecimentos.pv_cnpj` vem
formatado (com pontuação, do robô de teste) — uma comparação direta (`=`) sem normalizar também falhava
nesses casos.

**Fix real:** a RPC `abastecimentos_da_fatura` (Fase 27.76) foi reescrita pra resolver o CNPJ do posto via
`empresas.cnpj`, usando `negociacoes_postos.empresa_posto_id` (sempre preenchido, ao contrário de
`posto_cnpj`) — é a MESMA fonte que o robô usa pra gravar `pv_cnpj`, então os dois sempre batem depois de
normalizados. Como isso exige ler `empresas` do lado do POSTO (RLS bloqueia isso pro cliente — mesmo
problema da Fase 27.68), a função virou `SECURITY DEFINER` com guarda de autorização manual própria
(`empresa_cliente_id` OU `empresa_posto_id` da fatura, ou admin/superuser) — sem essa guarda, qualquer
usuário autenticado poderia pedir o extrato de qualquer fatura de qualquer empresa.

Testado direto no banco, simulando a sessão do `daniel.peruffo.app@gmail.com`, nas 4 faturas reais:
todas batem EXATAMENTE com `quantidade_abastecimentos` já gravado (38/38, 36/36, 35/35, 36/36) —
incluindo faturas cujas negociações nasceram do lado do posto (`posto_cnpj = ""`), que antes sempre
davam extrato vazio.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.80 — Ciclo de faturamento/prazo de vencimento: parâmetro por cliente+posto, não termo negociado

Depois da Fase 27.74, o Daniel apontou: "A fase 27.74 não foi realizada. Não encontrei onde os prazos são
parametrizáveis por cliente". Investigação (via subagente): os campos SÓ apareciam em 2 formulários —
criar negociação nova e responder contraproposta pendente. Uma vez que a negociação vira `aceita` (o
estado normal/estável de qualquer relação cliente+posto de verdade), não existia NENHUM caminho — nem UI
nem backend — pra ver-e-editar ciclo/prazo; só um histórico somente-leitura das rodadas passadas. Por
isso o Daniel, procurando especificamente onde "setar" o prazo, nunca achava.

Ao planejar o fix (uma ação "renegociar termos"), o Daniel corrigiu o entendimento de base com mais 3
mensagens seguidas:

1. "O prazo de abastecimento + pagamento é parametrizável no cliente e não por negociação" — ciclo/prazo
   NÃO é termo comercial como preço/volume; é parâmetro administrativo de cobrança.
2. "Este prazo, eventualmente, pode ser alterado e refletir na abertura de uma nova fatura, novo ciclo" —
   a mudança não é retroativa, só vale a partir do próximo ciclo.
3. "Exemplos de ciclos: 7+7, 15+10, 15+15, 30+15 (...) 7 dias de abastecimentos + 7 dias para criação da
   fatura e pagamento" e depois "No mês, podem ter 4 ciclos de 7+7: de 1 a 7, de 8 a 14, de 15 a 21 e de 22
   a 30 ou 31, dependendo do mês" — os ciclos são ANCORADOS NO CALENDÁRIO (sempre reiniciam no dia 1 de
   cada mês), não uma rolagem corrida indefinida.

Perguntado (via pergunta de esclarecimento), o Daniel confirmou: escopo por cliente+posto (não um valor
único pra todo o cliente), edição exclusiva do admin (FNI), e vale a partir do próximo ciclo (não
retroativo).

**Fix — parte 1 (desacoplar do fluxo de negociação):** `ciclo_faturamento_dias`/`prazo_vencimento_dias`
saíram de `DadosRodada`/`validarDadosRodada` (`negociacoesPostos.ts`), de `FormularioNovaNegociacao.tsx` e
`FormularioContraproposta.tsx`, do histórico de rodadas em `/negociacoes/[id]`, e dos campos opcionais da
API pública (`/api/integracoes/negociacoes` e `.../rodadas`) — voltam a ser puramente comercial
(combustível/volume/preço/vigência). `decidirNegociacao` não fotografa mais esses 2 campos no cabeçalho
ao aceitar (ficam no default 30/30 da coluna até o admin ajustar).

**Fix — parte 2 (novo mecanismo administrativo):** nova função `atualizarCicloPagamento()`
(`negociacoesPostos.ts`) e server action `atualizarCicloPagamentoAcao` (`negociacoes/actions.ts`) — mexem
DIRETO no cabeçalho de uma negociação já `aceita`, fora do fluxo de rodadas. Guarda de autorização própria
(`perfil_usuario_atual() = 'admin'` ou superusuário) porque a RLS de `negociacoes_postos`
(`negociacoes_postos_tenant_all`) libera UPDATE também pros dois lados do tenant, não só admin — sem essa
guarda, cliente ou posto poderiam mudar o próprio ciclo/prazo direto pela API do Supabase. Novo
componente `FormularioCicloPagamento.tsx` (edição inline) aparece na tabela de negociações de
`CicloAbastecimentoPagamento.tsx`, só quando `podeEditarCiclo` é `true` — prop passada como `true` só em
`/clientes/[id]` (visão admin) e omitida (default `false`) em `/clientes-posto/[clienteId]` (visão do
posto, mesmo componente reaproveitado, sem controle de edição). Não é retroativo por natureza: faturas já
geradas guardam seu próprio período/vencimento; `gerar_faturas_postos_robo()` só lê o valor atual pra
calcular o PRÓXIMO período a partir de onde parou.

**Fix — parte 3 (ciclos ancorados no calendário):** `gerar_faturas_postos_robo()` reescrita — a versão
anterior (rolagem corrida, sempre `periodo_fim + 1`) nunca respeitava fim de mês, deixando os períodos
deslizarem indefinidamente pelo calendário. Agora cada período é limitado ao fim do mês corrente
(`date_trunc('month', ...) + 1 month - 1 day`); e pra não sobrar um pedacinho de período separado no fim
do mês, se os dias restantes no mês forem menos que 2x o ciclo, o período atual já absorve TUDO até o fim
do mês (em vez de fechar no ciclo "cheio" e deixar uma sobra pequena logo depois). Validado por simulação
SQL: ciclo 7+7 num mês de 31 dias gera exatamente 1-7, 8-14, 15-21, 22-31 (10 dias no último) — 4 períodos,
igual ao exemplo do Daniel; ciclo 15 gera 1-15, 16-31 (16 dias); ciclo 30 gera o mês inteiro num período só.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos), e com simulação da lógica de corte de período
direto em SQL (recursive CTE) pros casos 7+7, 15+15 e 30+15 em meses de 28/29/30/31 dias.

## Fase 27.81 — Gráfico "Fluxo de caixa previsto" sempre vazio

Pedido do Daniel (print): o indicador "Fluxo de caixa previsto (vencimentos por dia)" em
`/financeiro-posto` aparecia sempre vazio ("Sem vencimentos no período selecionado").

**Achado real:** `resolverPeriodoFinanceiro()` (`financeiroPostos.ts`) sempre resolve uma janela pra TRÁS
(`fim = hoje`) pras opções rápidas (Hoje/7 dias/15 dias/Mês atual) — correto pros indicadores
retrospectivos "Recebido no período"/"Pago no período" (olham `pago_em`, só existe no passado), mas o
gráfico e os indicadores "vencendo no período"/"Saldo previsto do período" são PROSPECTIVOS (olham
vencimento futuro) e reaproveitavam por engano a MESMA janela pra trás — uma fatura com vencimento amanhã
nunca entrava no cálculo do padrão "15 dias".

**Fix:** nova função `resolverJanelaPrevista()` devolve uma janela separada, pra frente a partir de hoje,
com a mesma duração em dias da opção rápida escolhida ("Mês atual" = resto do mês corrente).
"Personalizado" continua igual (o usuário já escolhe a direção manualmente ao digitar datas). `page.tsx`
(`/financeiro-posto`) agora usa duas janelas: a retrospectiva (recebido/pago) e a prospectiva (vencendo/
saldo previsto/gráfico), com legenda própria ("Previsão: X – Y") no card do gráfico.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.82 — Tour de onboarding do posto era o mesmo do cliente

Pedido do Daniel: "ajustar o onboarding da tela de posto, pois esta com o mesmo da tela de cliente e sao
outras funcoes".

**Achado real:** o tour guiado de boas-vindas (Fase 24, `TourProvider` + `PASSOS_TOUR`) sempre foi UM ÚNICO
array fixo, mostrado igual pra qualquer perfil — inclusive "posto" (segmento Revenda), cujo menu
(`menuPosto` em `layout.tsx`) é uma trilha bem mais enxuta e diferente da de Frota (sem Cadastros,
Operação, Assistente FNI, roteirização etc.). Passos como "Cadastros" e "Operação" apontavam
(`data-tour="menu-cadastros"`/`"menu-operacao"`) pra elementos que sequer existem na tela do posto (sem
esses atributos no `menuPosto`), deixando o tour incoerente com as funções reais do perfil.

**Fix:** `tourPassos.ts` agora tem dois arrays — `PASSOS_TOUR_FROTA` (o de sempre, renomeado) e o novo
`PASSOS_TOUR_POSTO`, com passos específicos pro menu do posto (Dashboard, Negociações, Clientes, Meus
Preços, Financeiro, Integrações). `TourProvider` deixou de importar o array fixo — passou a receber
`passos: PassoTour[]` como prop. `layout.tsx` escolhe qual array passar
(`ehPosto ? PASSOS_TOUR_POSTO : PASSOS_TOUR_FROTA`) e ganhou `TOUR_POR_HREF_POSTO`, um mapa href→alvo
igual ao já existente pro lado Frota, com `data-tour` nos itens correspondentes do `menuPosto` (que antes
não tinha nenhum atributo `data-tour`). `usuarios_app.tour_onboarding_visto`/`marcar_tour_onboarding_visto`
não precisaram mudar — são um flag global por usuário, e cada usuário só vê uma trilha (posto OU frota),
nunca as duas.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.83 — Campo de ciclo/prazo (Fase 27.80) invisível na prática em /clientes/[id]

Depois de deployar a Fase 27.80, o Daniel reportou: "Revisar, pois nao encontrei na tela de cliente o
campo para configuração".

**Achado real:** o controle de edição existia (`FormularioCicloPagamento`, Fase 27.80) mas só como um link
de texto pequeno ("Ajustar ciclo/prazo (...)") dentro de uma COLUNA NO MEIO de uma tabela larga com
`overflow-x-auto` ("Negociações com postos", 8 colunas) — fácil de nunca rolar até lá, ainda mais sem
nenhuma pista visual de que aquilo era um campo de configuração administrativa importante.

Um segundo problema, achado ao revisar o fluxo de salvamento: `atualizarCicloPagamentoAcao` chamava
`revalidatePath("/clientes")` sem `{ type: "layout" }` — isso só invalida a rota EXATA `/clientes` (a
listagem), não a sub-rota dinâmica `/clientes/[id]` onde o formulário realmente fica. Mesmo editando com
sucesso, a tela podia continuar mostrando o valor antigo até um reload manual.

**Fix:**
- Nova seção própria "Ciclo de faturamento e prazo de vencimento" em `CicloAbastecimentoPagamento.tsx`,
  sempre visível logo abaixo dos indicadores/próxima fatura (sem precisar rolar nada), listando uma linha
  por posto com negociação já aceita — só aparece quando `podeEditarCiclo` é `true` (visão admin).
- `FormularioCicloPagamento.tsx`: o estado fechado deixou de ser um link discreto — agora mostra
  "Ciclo atual: **X+Y dias**" com um botão "Editar" (`btn-secondary`, visualmente óbvio como ação).
- A coluna "Ciclo+prazo" continua na tabela de negociações, só como referência somente-leitura (a edição
  em si só acontece na seção nova).
- `atualizarCicloPagamento()` (`negociacoesPostos.ts`) passou a devolver `empresaClienteId` no retorno de
  sucesso; `atualizarCicloPagamentoAcao` usa isso pra chamar `revalidatePath` também na página específica
  do cliente (`/clientes/[id]`) e no espelho read-only do lado do posto (`/clientes-posto/[clienteId]`),
  além da listagem geral.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.84 — Ciclos abertos (em andamento) não apareciam em nenhum painel financeiro

Pedido do Daniel: "os ciclos fechados já estão sendo exibidos nas visões, mas os ciclos abertos, em
operação dentro do ciclo definido para cada cliente, não aparecem nas visões".

**Achado real:** todos os painéis financeiros (`/financeiro-posto`, `/financeiro` do cliente,
`/clientes/[id]` admin, `/clientes-posto/[clienteId]`) só mostram `faturas_postos` — e essa tabela só
ganha uma linha nova quando `gerar_faturas_postos_robo()` FECHA um período (`periodo_fim < current_date`).
O ciclo ATUAL, em andamento, nunca tinha nenhuma representação em tela alguma — só aparecia no dia
seguinte ao fechamento, já como fatura de verdade.

**Fix:** nova RPC `ciclos_abertos_postos()` (`SECURITY DEFINER`, guarda manual de autorização — mesmo
padrão da Fase 27.79) calcula, pra cada negociação aceita visível ao chamador, o ciclo em andamento HOJE
— reaproveitando a MESMA lógica de corte de período do robô (precisa ficar em sincronia com ele: período
nunca atravessa fim de mês, absorve o resto do mês quando sobra pouco) — e soma os abastecimentos já
registrados (`fatura_posto_id is null`) dentro desse período até hoje. Devolve período/vencimento
PREVISTOS (podem mudar até o fechamento) e o valor/volume/quantidade acumulados.

Novo helper `src/lib/ciclosAbertos.ts` (`buscarCiclosAbertos`) e componente compartilhado
`SecaoCiclosAbertos.tsx` (`(dashboard)/_components/`) — uma seção "Ciclo em andamento" com badge azul
distinto de aberta/paga/vencida, reaproveitada nas 4 telas:
- `/financeiro-posto`: ciclos filtrados pelo posto selecionado, acima de "Contas a receber".
- `/financeiro` (cliente): ciclos filtrados pelo cliente selecionado, acima de "Cobrança em aberto".
- `CicloAbastecimentoPagamento.tsx` (`/clientes/[id]` admin e `/clientes-posto/[clienteId]` posto): prop
  nova `ciclosAbertos` + `rotuloCiclos` ("cliente" no admin — mostra qual POSTO; "posto" no posto — mostra
  qual CLIENTE), seção renderizada logo após os indicadores/próxima fatura.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos), e a RPC testada direto no banco simulando a
sessão do `posto.teste@fni.test` — retornou o ciclo em andamento correto pras 2 negociações aceitas dele,
com abastecimentos acumulados batendo com uma contagem manual por dia.

## Fase 27.85 — Visão de ciclos agrupada por contraparte no painel financeiro

Pedido do Daniel: "Um posto pode ter muitos ciclos com diversos status, abertos ou em andamento e
fechados. Precisamos facilitar a visão de postos com um volume grande de ciclos, pois possui
relacionamento com muitos clientes. Traga uma proposta de facilidade de visualização destes ciclos na
visão do posto dentro do painel financeiro" — pedido explícito de PROPOSTA, não de implementação direta.

**Achado real:** as telas da Fase 27.84 (`SecaoCiclosAbertos` + a lista plana de faturas em
`/financeiro-posto` e `/financeiro`) misturam TODAS as contrapartes numa única lista — funciona bem com
poucos clientes/postos, mas um posto com dezenas de relações de cliente vira uma lista enorme sem
nenhuma forma de agrupar, filtrar ou buscar por nome.

**Proposta validada com o Daniel** via mockup (`mcp visualize`) + `AskUserQuestion`, com duas decisões de
escopo confirmadas por ele: (1) a nova visão SUBSTITUI as tabelas atuais, não é uma visão adicional; (2)
aplicar dos dois lados — posto (agrupado por cliente) e cliente (agrupado por posto) — "Os dois agora".

**Fix:**
- `agruparCiclosPorContraparte()` (`src/lib/ciclosAbertos.ts`): consolida negociações + faturas + ciclo
  em andamento em 1 linha por contraparte, com contagem por status (aberta/vencida/paga/cancelada) e
  ordenação por prioridade (vencida > aberta > em andamento > sem pendência).
- `VisaoCiclosPorContraparte` (novo componente compartilhado, `(dashboard)/_components/`): busca por
  nome + chips de filtro por status (Todos/Em andamento/Em aberto/Vencidas/Pagas) + tabela 1-linha-por-
  contraparte, com link "Ver histórico" pro drill-down completo daquela contraparte.
- `/financeiro-posto`: tabelas "Ciclo em andamento" + "Contas a receber" (lista plana) substituídas pela
  visão agrupada por cliente.
- `/financeiro` (cliente) + `CobrancaEmAberto.tsx`: mesmo tratamento, agrupado por posto. KPIs e o banner
  "próxima fatura" continuam vindo direto das faturas (retrospectivo/pontual, não precisa de agrupamento).
- Nova página `/meus-postos/[postoId]`: drill-down do lado do cliente pra UM posto específico — espelha
  `/clientes-posto/[clienteId]` (que já existia do lado do posto, Fase 27.72), reaproveitando
  `CicloAbastecimentoPagamento`.
- `CicloAbastecimentoPagamento.tsx`: novo prop `podeGerenciarFaturas`. A lista plana removida de
  `/financeiro-posto` era o único lugar com os botões "Marcar como paga"/"Cancelar" — essa ação migrou
  pro drill-down `/clientes-posto/[clienteId]` (única tela que passa o prop como `true`).
- `financeiro-posto/actions.ts`: `marcarFaturaPagaAcao`/`cancelarFaturaAcao` passam a revalidar também
  `/clientes-posto/[empresa_cliente_id]`, além de `/financeiro-posto` — mesmo bug de cache já corrigido
  na Fase 27.83 (`revalidatePath` sem `{ type: "layout" }` só revalida o path literal).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

### Hotfix — erro em produção após o deploy da Fase 27.85

Daniel reportou em runtime (Railway): "Error: Functions cannot be passed directly to Client Components
unless you explicitly expose it by marking it with 'use server'" ao abrir `/financeiro-posto` e
`/financeiro`.

**Achado real:** `VisaoCiclosPorContraparte` é `"use client"`, mas `financeiro-posto/page.tsx` e
`CobrancaEmAberto.tsx` (Server Components) passavam `hrefHistorico` como uma FUNÇÃO
(`(id) => \`/rota/${id}\``). O Next.js serializa props na fronteira Server→Client, e funções não são
serializáveis (só Server Actions, marcadas `"use server"`, cruzam essa fronteira). Passou no
`tsc`/`eslint` porque é um erro de runtime do RSC, não um erro de tipo — só aparece com o app rodando.

**Fix:** trocado o prop função por duas props string (`hrefBase` + `empresaId`); o link é montado dentro
do próprio Client Component (`${hrefBase}/${contraparteId}?empresa=${empresaId}`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.86 — Logout automático por inatividade, configurável pelo admin

Pedido do Daniel: "Implementar logout automatico por um período de inatividade do usuario no sistema.
Parametrizavel em tela de configuração do admin."

**O que foi feito:**
- Nova tabela `configuracoes_sistema` — singleton (PK booleana com constraint `id = true`, garante no
  máximo 1 linha): é um parâmetro GLOBAL, vale pra todo o sistema (todos os perfis, clientes e postos),
  não por empresa. Coluna `logout_inatividade_minutos` (padrão 30, entre 5 e 480 minutos). RLS: SELECT
  liberado pra qualquer autenticado (o monitor roda em toda tela, de qualquer perfil); UPDATE só
  admin/superusuário (mesmo padrão de bypass já usado em outras tabelas, ex.: `anomalias_abastecimento`).
- `src/lib/configuracoesSistema.ts`: leitura (com fallback pro padrão se falhar) + validação + escrita,
  com guarda de autorização manual (mesmo padrão de `atualizarCicloPagamento`, Fase 27.80 — RLS não é a
  única camada de defesa nesse projeto).
- `MonitorInatividade` (novo Client Component, montado em `(dashboard)/layout.tsx` — roda em toda tela
  autenticada, qualquer perfil): escuta `mousemove`/`keydown`/`mousedown`/`scroll`/`touchstart`, grava a
  última atividade no `localStorage` (não só em memória — funciona entre ABAS diferentes do mesmo
  navegador, atividade numa aba conta pra todas) e confere a cada 15s se passou do limite configurado; se
  sim, desloga (`supabase.auth.signOut()`) e redireciona pra `/login?motivo=inatividade`.
- `/login`: novo aviso âmbar (separado do bloco vermelho de erro) quando chega com
  `?motivo=inatividade` — "Você foi desconectado por inatividade. Entre novamente para continuar."
- Nova tela `/configuracoes` (menu Administração → "⚙️ Configurações do Sistema", exclusiva do perfil
  admin, mesmo padrão de checagem de acesso de `/assinaturas`): formulário pra ajustar o tempo em
  minutos.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.87 — Rede de Postos (mesma mecânica do Grupo Econômico, para postos)

Pedido do Daniel: "Criar a mesma mecanica de grupo economico para postos, só que em postos deve ser
denominado de 'Rede de Postos' e o nome que leva a Rede" + "agrupamento de postos na mesma Rede para
visao pelos usarios cadastrados na Rede".

**Decisão de design:** em vez de duplicar tabela/RLS/RPC, a Rede de Postos reaproveita a MESMA mecânica
do Grupo Econômico (`grupos_economicos` + `grupos_economicos_empresas`). A RPC `empresas_do_usuario()`
(banco) já expande por `grupos_economicos_empresas` independente do tipo de empresa — clientes e postos
são ambos linhas de `empresas`, só o campo `segmento` muda ('Frota' vs 'Revenda', mesmos valores já
usados em `empresas.segmento`). Isso significa que um usuário vinculado a UM posto de uma Rede já passa
a enxergar as empresas irmãs em QUALQUER tela que já use `resolverEmpresaAtual()`/`empresas_do_usuario()`
(`/financeiro-posto`, `/negociacoes`, `/precos-postos`, `/clientes-posto`, `/integracoes`, `/usuarios`...)
— sem precisar alterar RLS nem duplicar autorização.

**O que foi feito:**
- Migração: nova coluna `grupos_economicos.segmento` ('Frota'|'Revenda', default 'Frota' — o grupo já
  existente vira Grupo Econômico automaticamente). Sem essa coluna, uma Rede criada pela tela nova
  apareceria também listada em `/grupo-economico` (mesma tabela, mesma query sem filtro).
- `src/lib/gruposEconomicos.ts` (novo): lógica de escrita compartilhada (criar/editar grupo, vincular/
  desvincular empresa) usada pelos dois pares de Server Actions. Guarda de autorização admin/superusuário
  em código (RLS já restringe escrita a admin via `with_check`, mas o padrão do projeto é sempre validar
  de novo — mensagem de erro melhor, Fase 27.80) + validação extra: a empresa vinculada precisa ter o
  MESMO segmento do grupo (não dá pra colocar um posto num Grupo Econômico de clientes, nem uma frota
  numa Rede de Postos).
- `/grupo-economico`: ajustado pra usar a lib compartilhada e filtrar `segmento='Frota'` (lista, seletor
  de empresas disponíveis, guarda de `notFound()` se o id aberto for de uma Rede).
- Novas rotas `/rede-postos` (page, novo, [id], actions, RedeForm, VincularPostoForm): espelham 1:1 as
  rotas de `/grupo-economico`, filtradas a `segmento='Revenda'` — rótulos próprios ("Rede de Postos",
  "Nome da Rede", "Postos vinculados").
- Novo item de menu "🔗 Rede de Postos" em Cadastros, + tooltip de ajuda (`rede_postos.pagina`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

**Dados de teste criados junto:** segundo posto revendedor de teste, "Posto Teste 2 Ltda" (CNPJ
22.333.444/0001-55, login `posto.teste2@fni.test`), com negociações aceitas e preços cadastrados, pra
Daniel montar uma Rede de Postos com 2 postos e testar a visão cruzada entre eles.

## Fase 27.88 — Robô de teste: 15 abastecimentos/dia por POSTO (não mais no total)

Pedido do Daniel: "Incluir 15 abastecimentos aleatorios, por dia, no posto de teste 2, utilizando o
preco cadastrado para os combustiveis, negociacoes vigentes com os dois clientes cadastrados" — e, ao
perguntar se o robô deveria dividir os mesmos 15/dia entre os dois postos de teste ou dar 15 pra cada,
Daniel confirmou: "não são abastecimentos somente com preço negociado vigente, pode gerar abastecimentos
com combustíveis que não tem preço negociado com os clientes também. São 15 abastecimentos aleatórios
para CADA posto."

**Achado real:** o robô da Fase 27.77 (`gerar_abastecimentos_postos_robo()`) tinha um cap de 15/dia no
TOTAL pros 2 clientes de teste juntos, e resolvia UM posto só por cliente (o da negociação aceita mais
recentemente atualizada) — desenhado quando só existia 1 posto de teste. Com o Posto Teste 2 (Fase
27.87), esse desenho faria os 15/dia migrarem inteiros pra um posto ou outro, nunca os dois ao mesmo
tempo.

**Fix:** reescrita a função pra contar quantos abastecimentos do robô já existem HOJE por POSTO
(`pv_cnpj`, não mais só no total) e loopar sobre TODOS os postos com negociação aceita e vigente com
qualquer um dos 2 clientes — cada posto gera seu próprio lote de até 15, sorteando veículos entre os
clientes que negociaram com AQUELE posto especificamente. Um veículo continua limitado a 1
abastecimento/dia no robô (índice único por placa+dia), então o mesmo veículo nunca "duplica" pra dois
postos no mesmo dia. O sorteio de combustível (5 produtos Otto) já era independente do que constava na
negociação — comportamento mantido, confirmando que não há restrição a "só combustíveis negociados".

Testado direto no banco: com o Posto Teste já no cap de 15/dia (rodadas anteriores do cron), rodar a
função manualmente gerou exatamente 15 novos pro Posto Teste 2 (0 pro Posto Teste, corretamente já no
limite); rodar de novo em seguida retornou 0 pros dois (idempotente dentro do mesmo dia).

Sem alterações em código TypeScript — mudança só na função SQL (SECURITY DEFINER) no Supabase, mais
negociações aceitas e preços cadastrados pro Posto Teste 2 (dados de teste, ver Fase 27.87).

## Fase 27.89 — Cache analítico pra destravar as funções lentas de inteligência de rede

Pedido do Daniel: "Precisamos verificar novamente a performance da aplicação. Em muitos pontos há
lentidão." Ao apresentar o diagnóstico, ele escolheu atacar primeiro as funções analíticas lentas e
depois (Fase 27.90) as políticas RLS duplicadas.

**Diagnóstico (medido, não estimado):** `pg_stat_statements` apontou 8 RPCs usadas em
`/inteligencia-rede`, `/postos` e `/relatorios` com tempo médio de segundos:
`historico_precos_detalhado` (5,1s), `historico_precos_serie_uf_combustivel` (2,9s),
`postos_gf_desvio_anp` (2,5s), `preco_medio_por_combustivel` (2,2s),
`historico_precos_volatilidade_mensal` (2,1s), `historico_precos_evolucao_mensal` (2,0s),
`postos_gf_precos_mapa` (1,9s), `preco_medio_por_combustivel_uf` (1,7s). `EXPLAIN ANALYZE` confirmou a
causa: cada função varria `historico_precos` (14 mil linhas) e/ou `postos_gf` (~3 mil linhas) inteiras,
sob RLS, de forma independente — e como a tela dispara as 8 em paralelo (`Promise.all`), elas competem
pela mesma CPU do banco, o que explica os picos bem acima da média. Um `count(*)` trivial sem RLS
nenhuma já levava ~318ms nesse banco, indicando que o compute do Supabase também é um fator (decisão de
infra/plano, fora do alcance de mudanças de código).

**Fix:** criado um cache analítico com 3 materialized views (`mv_historico_precos_raw`,
`mv_historico_precos_join`, `mv_precos_recentes_por_posto`) que pré-computam os scans e joins
compartilhados pelas 8 funções, atualizadas a cada 6h via `atualizar_cache_precos_postos()` agendada no
`pg_cron`. As 8 funções foram reescritas como `SECURITY DEFINER` lendo dessas views (materialized view
não suporta RLS), com um filtro de tenant replicado manualmente na cláusula `WHERE` — idêntico em
lógica ao que a política RLS original fazia:

```sql
and (
  (empresa_id)::text in (select unnest(empresas_do_usuario((select auth.jwt()) ->> 'email')))
  or ((select auth.jwt()) ->> 'email') = 'd.peruffo@gmail.com'
  or perfil_usuario_atual() = 'admin'
)
```

**Validação de equivalência:** checksum MD5 do resultado (linhas ordenadas e concatenadas) batendo
exatamente entre a versão antiga e a nova, testado em 4 contextos — sem filtro/admin, com
`p_empresa_id` que retorna dados, com `p_empresa_id` que retorna vazio, e com JWT real de usuário não-
admin — cobrindo inclusive o caso de borda das 32 linhas com `empresa_id` nulo em `historico_precos`.
Isolamento por tenant reconferido com duas contas reais não-admin (uma viu só o que devia ver; a outra,
sem vínculo com os clientes de teste, viu zero linhas).

**Achado extra na checagem de segurança pós-fix:** o advisor do Supabase (`get_advisors`, tipo
security) acusou `materialized_view_in_api` nas 3 views novas — como toda tabela nova no schema
`public`, elas saíram com `SELECT` liberado por padrão pros roles `anon` e `authenticated`. Como
materialized view não tem RLS, isso permitiria contornar completamente o filtro de tenant das funções e
puxar os dados de TODOS os clientes direto via REST (`/rest/v1/mv_historico_precos_raw?select=*`), sem
precisar de nenhuma permissão além da chave pública `anon`. Corrigido revogando todo acesso direto
(`REVOKE ALL ... FROM anon, authenticated`) nas 3 views — as funções continuam enxergando os dados
normalmente porque são `SECURITY DEFINER` (dono `postgres`), só o acesso direto à tabela é que fica
bloqueado. Reconfirmado depois: acesso direto à view retorna "permission denied" pra um usuário
autenticado comum, e a função correspondente continua retornando os dados certos.

**Resultado medido (`EXPLAIN ANALYZE`, mesmo contexto antes/depois):**

| Função | Antes | Depois | Ganho |
|---|---|---|---|
| `historico_precos_detalhado` | 5.130ms | 42,8ms | ~120x |
| `historico_precos_serie_uf_combustivel` | 2.872ms | 26,3ms | ~109x |
| `postos_gf_desvio_anp` | 2.530ms | 1.226ms | ~2x |
| `preco_medio_por_combustivel` | 2.200ms | 264,6ms | ~8x |
| `historico_precos_volatilidade_mensal` | 2.100ms | 29,3ms | ~72x |
| `historico_precos_evolucao_mensal` | 2.027ms | 23,5ms | ~86x |
| `postos_gf_precos_mapa` | 1.900ms | 38,5ms | ~49x |
| `preco_medio_por_combustivel_uf` | 1.700ms | 24,3ms | ~70x |

`postos_gf_desvio_anp` teve o menor ganho porque ainda recalcula, sem cache, o `DISTINCT ON` sobre
`anp_precos_referencia` (referência de preço ANP) — pode virar uma 4ª materialized view numa fase
futura se continuar pesando.

Sem alterações em código TypeScript — mudança só em SQL (materialized views, função de refresh, 8
funções analíticas reescritas, agendamento no `pg_cron`, e o hardening de grants) no Supabase.

## Fase 27.90 — Consolidar políticas RLS duplicadas + índices (2ª metade da performance)

Segunda parte do pedido "Precisamos verificar novamente a performance da aplicação" (Daniel escolheu
"as duas, começando pelas analíticas" — Fase 27.89 foi a primeira metade).

**Diagnóstico:** o advisor de performance do Supabase apontava 11 casos de "multiple permissive
policies" nas tabelas `anp_postos`, `anp_precos_referencia`, `grupos_economicos_empresas`,
`permissoes_perfil`, `profrotas_abastecimentos`, `security_logs`, `usuarios_app` e `usuarios_empresas`
— em cada um, uma política `FOR ALL` de escrita (normalmente restrita a admin) tinha o mesmo `command`
que uma política de leitura já existente, então o Postgres precisava avaliar as duas (unidas por OR) em
toda consulta nessas tabelas, mesmo quando o resultado final nunca dependia da segunda política. Também
7 índices duplicados (mesma definição, dois nomes) e 4 chaves estrangeiras sem índice em
`planos_viagem` (`centro_custo_id`, `motorista_id`, `rota_salva_id`, `rotograma_id`).

**Fix:** pra cada uma das 11 tabelas, a política `FOR ALL` foi separada em políticas dedicadas de
INSERT/UPDATE/DELETE (sem SELECT), deixando o SELECT coberto por uma única política. Em
`grupos_economicos_empresas`, `permissoes_perfil`, `usuarios_app` e `usuarios_empresas` isso foi
possível porque a condição da política de escrita já estava contida (ou era idêntica) na condição da
política de leitura — provado por análise lógica das expressões antes de aplicar, e reconfirmado com
teste real depois. Em `profrotas_abastecimentos`, as duas condições de SELECT eram genuinamente
diferentes (acesso por tenant vs. acesso por posto via CNPJ), então foram fundidas numa única política
com OR explícito, em vez de manter duas políticas separadas.

**Achado de segurança fora do escopo original, corrigido com autorização do Daniel:** ao mexer em
`security_logs`, a política `admin_select_seclogs` — apesar do nome — tinha `USING (true)`, sem
NENHUMA checagem de admin, valendo pra `anon`. Testado ao vivo: uma sessão anônima (sem login, só a
chave pública) conseguia ler as 152 linhas da tabela, incluindo email e IP de quem gerou cada evento de
segurança. Não havia nenhuma tela no app usando essa tabela (grep no frontend não achou nada), então não
tinha risco de quebrar funcionalidade. Perguntado, Daniel escolheu "Restringir a admin" — a política foi
reescrita pra só permitir SELECT a admin/superusuário. De quebra, a política `security_logs_tenant_all`
(que também duplicava SELECT, dando acesso a qualquer usuário do MESMO tenant do log) foi limitada a
UPDATE/DELETE, e a duplicação de INSERT com `backend_insert_seclogs` (que já permite gravar sem
restrição, necessário pra logar até tentativa de login anônima) foi eliminada.

**Validação de equivalência de acesso:** antes de mexer, capturado um checksum MD5 (linhas ordenadas)
do que cada uma das 8 tabelas retorna pra 4 contextos reais — admin (`d.peruffo@gmail.com`), usuário
comum (`daniel.peruffo.app@gmail.com`, perfil gestor_frota), usuário posto (`posto.teste@fni.test`) e
anônimo (role `anon`, sem JWT). Depois de aplicar as 4 migrações, os 4 contextos foram recapturados: nas
7 tabelas não relacionadas à correção de `security_logs`, os checksums bateram 100% em TODOS os
contextos — nenhuma linha a mais, a menos, ou diferente ficou visível pra ninguém. Em `security_logs`,
o admin continuou vendo as 152 linhas normalmente; o usuário comum e o anônimo, que antes viam as 152
linhas (bug), passaram a ver 0 — exatamente a mudança pedida.

**Índices:** removidos os 7 duplicados (`avaliacoes_empresa_id_idx`, `avaliacoes_user_email_idx`,
`idx_postos_gf_empresa`, `idx_pfa_cnpj`, `idx_pfa_pvcnpj`, `idx_stripe_events_event_id`,
`idx_tele_abast_empresa` — confirmado antes que nenhum deles era o índice por trás de uma constraint
`UNIQUE`, só `stripe_events_stripe_event_id_key` era, e essa ficou). Criados os 4 índices de FK que
faltavam em `planos_viagem`.

Rodado o advisor de performance de novo depois: os 11 casos de "multiple permissive policies"
zeraram, os 7 duplicados sumiram, as 4 FKs sem índice sumiram. Rodado o advisor de segurança também:
nenhum alerta novo, e o `admin_select_seclogs` corrigido não aparece mais como problema.

Sem alterações em código TypeScript — mudança só em políticas RLS e índices no Supabase.

## Fase 27.91 — Ciclo em andamento conta como "Em Aberto" (cliente, posto e admin)

Pedido do Daniel, com print da tela "Ciclos por cliente": um ciclo aparecia como "Em andamento" com
valor acumulado (ex: R$ 2.770,53), mas a coluna Faturas mostrava "Nenhuma ainda". Ele: "Deveria
aparecer faturas 'Em Aberto' visto que o ciclo foi iniciado com abastecimentos já realizados. Mesmo
que não hajam abastecimentos dentro de um ciclo, ele precisa ser aberto e fechado, posteriormente, no
final do ciclo" — e confirmou que vale "em ambas as visões de cliente, posto e admin".

**Causa:** a fatura REAL (`faturas_postos`) só é criada pelo robô `gerar_faturas_postos_robo()` depois
que o período do ciclo termina (`periodo_fim < hoje`) — enquanto o ciclo está em andamento, ele só
existe como um cálculo ao vivo (`ciclos_abertos_postos()`, Fase 27.84), exibido numa seção separada
("Ciclo em andamento"), sem contribuir pros totais/contagens de "Em aberto" em nenhuma tela — esses
totais somavam só faturas já fechadas.

**Fix:** o ciclo em andamento (`cicloAtual`/`ciclosAbertos`) agora soma nos totais e contagens de "Em
aberto" em paralelo às faturas reais, em 4 pontos:
- `lib/ciclosAbertos.ts` (`agruparCiclosPorContraparte`): toda contraparte com ciclo em andamento ganha
  +1 na contagem "aberta" e o valor acumulado soma em `valorEmAberto` — mesmo com valor 0 (ciclo sem
  abastecimento ainda conta como aberto). Corrige a tabela "Ciclos por contraparte"
  (`VisaoCiclosPorContraparte`), usada tanto em `/financeiro-posto` quanto em `/financeiro` (cliente).
- `/financeiro-posto/page.tsx`: indicador "A receber (em aberto)" passa a somar `ciclosAbertosDoPosto`.
- `/financeiro/page.tsx` + `CobrancaEmAberto.tsx`: indicadores "Total em aberto" e "Faturas em aberto"
  (visão do cliente) passam a somar/contar os ciclos em andamento — novo prop `ciclosAbertos`.
- `CicloAbastecimentoPagamento.tsx`: indicador "Em aberto" passa a somar `ciclosAbertos` — usado tanto
  em `/clientes/[id]` (admin) quanto em `/clientes-posto/[clienteId]` (posto, mesmo componente
  reaproveitado), cobrindo as 3 visões pedidas (cliente, posto, admin).

Simulado com os dados exatos do print (Frotas & Frotas Ltda com ciclo em andamento e R$ 0,00
acumulado; Transportes de Cargas Testes Ltda com R$ 2.770,53 acumulado, nenhuma fatura real ainda): o
resultado bate — as duas passam a contar "1 aberta", a segunda com `valorEmAberto = 2.770,53`.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos, nos 5 arquivos alterados).

## Fase 27.92 — Boleto/documento de cobrança por fatura fechada (cliente, posto, admin)

Pedido do Daniel, com um PDF de referência anexado (boleto real do Banco Itaú, de um sistema
concorrente — Ficha de Compensação + Aviso de Débito + Detalhamento de Abastecimento): "criar um
documento boleto... disponibilizado ao cliente ao final do ciclo de abastecimento, para download,
pagamento e quitação... com os campos preenchidos com os dados do cliente e do posto, com os valores
consolidados de cada ciclo de abastecimento fechado... trazer uma sessão com os abastecimentos
realizados... este boleto deve estar disponível para todas as visões: clientes, postos e admin". Depois:
"No boleto, tem que ter a referência do número da fatura".

**Decisões tomadas com o Daniel antes de implementar (`AskUserQuestion`):**
- O PDF anexado é um boleto bancário REAL (código de barras, linha digitável e PIX registrados no
  Itaú) — reproduzir isso de verdade exigiria integração com banco/gateway de pagamento (credenciais
  de API que a FNI não me deu acesso). Daniel escolheu: **documento informativo**, com QR Code PIX
  real, mas **sem** código de barras/linha digitável (removido — incluir uma linha digitável falsa
  poderia parecer fraude, já que o documento não é registrado em banco nenhum).
- **Cedente (quem recebe) é o POSTO**, não a FNI — reflete a relação comercial real (a negociação é
  cliente+posto). Cada posto cadastra a própria chave PIX (self-service).

**Implementado, em cima da infraestrutura já existente da Fase 27.76** (`/faturas-postos/[id]`, rota
única já acessível às 3 visões via RLS de `faturas_postos_leitura`, com extrato de abastecimentos +
PDF via `@react-pdf/renderer`):

- **`numero_fatura`** (bigint, sequence, unique) em `faturas_postos` — referência legível da fatura
  (pedido extra do Daniel), gerada automaticamente via `DEFAULT nextval(...)` em toda fatura nova
  (inclusive as do robô, sem tocar na função) e backfillada nas já existentes em ordem cronológica.
- **`pix_chave`** (text) em `empresas` — chave PIX do posto, cadastrada numa tela nova self-service,
  **`/minha-empresa`** (menu do posto, "🏦 Meus Dados / PIX"), restrita a empresas `segmento='Revenda'`.
  RLS de `empresas` já permitia UPDATE por qualquer membro da própria empresa (`empresas_update_admin`,
  apesar do nome), então não precisou de política nova.
- **RPC `dados_boleto_fatura(p_fatura_id)`** — retorna nome/CNPJ/endereço completos de cedente
  (posto) e sacado (cliente), mais a chave PIX do posto. `SECURITY DEFINER` com guarda de autorização
  manual, exatamente no mesmo padrão de `abastecimentos_da_fatura` (Fase 27.79): nem cliente nem posto
  são "membros" da empresa da contraparte, então SELECT direto em `empresas` pra ver o lado de fora
  falharia por RLS. Testado com 4 contextos reais: posto (autorizado, dados corretos), cliente
  (autorizado), admin (autorizado), e um posto de outra Rede SEM relação com a fatura — que também
  recebeu os dados, porque ele está agrupado na MESMA Rede de Postos do posto da fatura (Fase 27.87);
  confirmado que é o comportamento correto e já esperado do sistema (visão compartilhada entre postos
  da mesma Rede), não um vazamento novo.
- **`src/lib/pix.ts`** — gerador do payload "Pix Copia e Cola" (BR Code, padrão EMV do Banco Central),
  incluindo o CRC16-CCITT exigido no fim do payload, e a geração do QR Code (pacote `qrcode`, novo
  nas dependências) como PNG em data URL — tudo client-side/server-side em JS puro, sem precisar de
  nenhuma API de banco (só a chave PIX de quem recebe). Validado com um payload de teste: parser TLV
  campo a campo confirma todos os tamanhos batendo, e o CRC recalculado bate com o embutido no payload.
- **`FaturaPdf.tsx`** ganhou o layout de boleto: caixas de cedente/sacado (nome, CNPJ, endereço),
  número da fatura em destaque, QR Code PIX (ou aviso de "sem chave cadastrada, combinar com o posto"
  quando o posto ainda não configurou), e o extrato de abastecimentos renomeado pra "Detalhamento do
  abastecimento" (mesmo nome da seção do PDF de referência) com uma linha de TOTAL A PAGAR. Sem código
  de barras. A tela on-line (`/faturas-postos/[id]`) ganhou as mesmas seções.

Sem alterações em RLS além da leitura já existente — a novidade de segurança é toda no `SECURITY
DEFINER` da RPC nova, testada com os 4 contextos acima. Validado com `npx tsc --noEmit` e `npx eslint`
(limpos, em todos os arquivos novos/alterados).

## Fase 27.93 — Detalhamento do ciclo em andamento (quantidade + abastecimentos) + correção de falha de segurança crítica

Pedido do Daniel, com print de "Ciclos por posto" mostrando dois ciclos "Em andamento" só com
período e R$ 0,00: "Ciclo atual em andamento, precisa ter o valor consolidado e a quantidade de
abastecimentos, além do detalhamento dos abastecimentos que estão sendo considerados dentro do
ciclo". Até aqui o ciclo aberto (Fase 27.84) só mostrava valor acumulado — sem quantidade, e sem
nenhum jeito de ver QUAIS abastecimentos compõem esse valor (isso só existia pra fatura já FECHADA,
via `abastecimentos_da_fatura`/`/faturas-postos/[id]`, Fase 27.76/27.92).

**Implementado:**
- **RPC `abastecimentos_do_ciclo_aberto(p_negociacao_id)`** — espelha a mesma lógica de corte de
  período de `ciclos_abertos_postos()` (Fase 27.84), mas pra UMA negociação, retornando os
  abastecimentos individuais (mesmo formato de `abastecimentos_da_fatura`).
- **Nova página `/ciclo-aberto/[negociacaoId]`** — equivalente do `/faturas-postos/[id]` pro ciclo
  ainda não fechado: indicadores de período/vencimento previstos, status, volume e valor acumulado, e
  a tabela de abastecimentos que compõem esse valor. Acessível às 3 visões (cliente, posto, admin).
- **`VisaoCiclosPorContraparte.tsx`** ("Ciclos por posto"/"Ciclos por cliente") — a célula "Ciclo
  atual" agora mostra a quantidade de abastecimentos junto com período e valor, e ganhou o link "Ver
  detalhamento" pra nova página.
- **`SecaoCiclosAbertos.tsx`** — a tabela de ciclos em andamento (usada em `/financeiro`,
  `/financeiro-posto` e nos painéis de cliente/posto individuais) ganhou a mesma coluna/link "Ver
  detalhamento".

**Achado de segurança crítico (não relacionado ao pedido original, encontrado durante o teste da RPC
nova):** ao testar `abastecimentos_do_ciclo_aberto` com um e-mail propositalmente desconhecido
(`ninguem.desconhecido@fora.test`, simulando um chamador sem vínculo nenhum com o sistema), a função
devolveu **87 linhas — deveria ter devolvido 0**. Causa raiz: o padrão de autorização usado (herdado
de `abastecimentos_da_fatura`, Fase 27.79, e copiado pra `dados_boleto_fatura`, Fase 27.92, e pra esta
função nova) monta a autorização assim:

```sql
v_autorizado := condA OR condB OR condC OR (perfil_usuario_atual() = 'admin');
if not v_autorizado then
  return;
end if;
```

Quando o e-mail do chamador não tem linha em `usuarios_app` (caso de qualquer chamador
desconhecido/não cadastrado), `perfil_usuario_atual()` devolve `NULL` em vez de `false`. Em SQL,
`false or false or false or NULL` não é `false` — é `NULL` (lógica de 3 valores). E `IF NOT NULL
THEN` no PL/pgSQL nunca é verdadeiro (só entra no bloco quando a condição é literalmente `TRUE`), então
o `RETURN` de bloqueio era **pulado silenciosamente**, e a função continuava e devolvia dados reais pra
um chamador que não deveria ter acesso a nada.

Verifiquei se esse mesmo padrão existia em outro lugar (`pg_get_functiondef` de toda função com `if
not v_autorizado` no corpo) e encontrei exatamente 3 funções: **`abastecimentos_da_fatura`**
(pré-existente, em produção desde a Fase 27.79 — não foi algo introduzido nesta sessão, é uma falha
antiga que só apareceu agora porque testei o caminho negativo pela primeira vez), e as 2 novas desta
sessão (`dados_boleto_fatura`, Fase 27.92, e `abastecimentos_do_ciclo_aberto`, Fase 27.93 — copiei o
mesmo padrão vulnerável sem perceber).

**Corrigido** numa migration só (`fase_27_93_corrigir_bug_autorizacao_null_3_funcoes`), trocando `IF
NOT v_autorizado THEN` por `IF v_autorizado IS NOT TRUE THEN` nas 3 funções — só passa da guarda
quando `v_autorizado` é literalmente `TRUE`, nunca em caso de `NULL`.

**Reverificado depois da correção**, nas 3 funções:
- E-mail desconhecido → **0 linhas** (antes: 38/87 linhas, dependendo da função) — confirmado bloqueado.
- Posto dono do ciclo → dados corretos (sem regressão).
- Admin (`d.peruffo@gmail.com`) → dados corretos (sem regressão).
- Cliente dono do ciclo (`daniel.peruffo.app@gmail.com`) → dados corretos (sem regressão) — 30
  abastecimentos no ciclo em andamento e os dados do boleto da fatura fechada, ambos batendo com o
  esperado.

Também corrigido nessa mesma migration um bug secundário (`column reference "id" is ambiguous`) na
RPC nova: o `RETURNS TABLE(id bigint, ...)` colidia com uma busca de `empresas.id` sem apelido dentro
da função — resolvido com alias (`from empresas e where e.id = ...`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos, nos arquivos novos/alterados).

## Fase 27.94 — Upload de NF-e (venda de combustível) por abastecimento + API pra ERPs

Pedido do Daniel, com um XML real de NFe anexado (posto real, autorizado pela SEFAZ-MG): "criar
upload de nota fiscal de venda de produto... o posto realizar o upload do XML da NFe, realizar as
críticas das regras de validação de todos os campos... e reportar cenários/status... para que o
usuário consiga corrigir e realizar o upload do XML novamente, salvo quando a NFe já foi inserida...
o sistema deve exibir para cliente, posto e admin o PDF da NF montada a partir do XML... Nesta
primeira entrega, 1 NFE para cada abastecimento". Depois, mais dois pedidos na mesma linha: "ERPs de
automação de postos... podem se integrar com a aplicação para upload automático" e "Sempre levando em
consideração a experiência do usuário com muitos volumes de abastecimentos".

**Decisões tomadas com o Daniel antes de implementar (`AskUserQuestion`):**
- **Vínculo NFe↔abastecimento: o sistema tenta descobrir sozinho** (por CNPJ emitente/destinatário +
  janela de data + tolerância de quantidade/valor), em vez do posto escolher o abastecimento antes de
  subir o XML.
- **Validação do código ANP: rígida, contra uma tabela de referência** — pesquisei a Tabela D02.2 da
  ANP (códigos oficiais de produto) e montei o catálogo completo (`anp_codigos_combustivel`, ~80
  códigos de combustíveis) mais um mapeamento dos 11 nomes de combustível já usados no app
  (`precos_postos.combustivel`) pro código ANP esperado (`combustiveis_codigo_anp`). O código da NFe
  precisa bater exatamente com o esperado pro combustível do abastecimento.
- **Tolerância numérica: pequena, com folga** — até 0,5 L de diferença na quantidade, até 2% (mínimo
  R$ 0,05) no valor — cobre arredondamento e o efeito do ICMS monofásico retido (presente no XML de
  exemplo) sem deixar passar erro grosseiro.
- **PDF: simplificado, no mesmo estilo do documento de cobrança** (Fase 27.92) — sem código de barras,
  já que a nota em si já foi autorizada pela SEFAZ (não é preciso reemitir um DANFE oficial).

**Schema novo:**
- `anp_codigos_combustivel` (codigo_anp, descricao_anp) — catálogo oficial ANP, leitura livre.
- `combustiveis_codigo_anp` (combustivel, codigo_anp) — mapeamento app→ANP, leitura livre.
- `notas_fiscais_abastecimento` — 1 linha por NFe validada, `abastecimento_id` **unique** (1:1, 1ª
  entrega), `chave_acesso` **unique** (44 dígitos, trava de duplicidade), todos os campos extraídos do
  XML (emitente/destinatário/produto/valores), `xml_storage_path`. RLS: só SELECT (membro do posto ou
  do cliente da nota, ou admin) — **sem política de INSERT/UPDATE/DELETE**, toda escrita passa pelas
  RPCs abaixo.
- Bucket privado `notas-fiscais-xml` (Storage) — mesmo padrão de `ticket-anexos`/`termos-adesao`, com
  policy de SELECT/INSERT que confere a dona do `abastecimento_id` na pasta.

**Motor de matching/validação (RPCs `SECURITY DEFINER`, mesmo padrão de guarda manual "IS NOT TRUE"
corrigido na Fase 27.93):**
- `buscar_abastecimentos_candidatos_nota_fiscal(...)` — dado os dados extraídos do XML, acha os
  abastecimentos candidatos (CNPJ normalizado + janela de ±2 dias + tolerância). 0 candidatos =
  pendência; 1 = vincula direto; 2+ = devolve a lista pro usuário escolher.
- `inserir_nota_fiscal_abastecimento(...)` — **revalida tudo de novo, nunca confia no resultado do
  matching**: duplicidade de chave, CNPJ batendo com o abastecimento, tolerância, código ANP contra o
  catálogo E contra o mapeamento esperado do combustível. Só grava se tudo passar; senão devolve um
  motivo específico (`chave_duplicada`, `fora_da_tolerancia`, `codigo_anp_nao_corresponde` etc.),
  traduzido em mensagem amigável (`src/lib/nfe.ts`).
- **API de integração pro ERP do posto** (pedido posterior do Daniel): as duas RPCs acima têm um 2º
  overload que recebe `empresa_posto_id` já validado (em vez de resolver por e-mail/JWT) — **só o
  `service_role` pode executar esse overload** (`REVOKE ALL ... FROM public, anon, authenticated` +
  `GRANT ... TO service_role`, testado: `authenticated` recebe `permission denied`, `service_role`
  funciona). Usado por `POST /api/integracoes/notas-fiscais` (novo endpoint no Hub de Integrações já
  existente, Fase 25/27.50 — reaproveita `api_keys`/`autenticarRequisicaoApi`, novo escopo
  `notas_fiscais:write`, só disponível pra chaves de posto). O ERP manda o XML bruto como corpo da
  requisição (`Content-Type: application/xml`); se ambíguo, reenvia com `?abastecimento_id=`.

**Parser do XML** (`src/lib/nfe.ts`, `fast-xml-parser`) — **achado real testando com o XML do Daniel**:
por padrão o `fast-xml-parser` converte texto "numérico" pra `number`, o que **corrompe a chave de
acesso** (44 dígitos vira notação científica por perda de precisão de ponto flutuante — ex.:
`3.126072...e+43` em vez dos 44 dígitos exatos) e comeria zeros à esquerda de CNPJ/código ANP.
Corrigido com `parseTagValue`/`parseAttributeValue: false` (mantém tudo como string; a conversão pros
campos que precisam virar número é manual). Validações estruturais antes de qualquer consulta ao
banco: modelo 55, `<protNFe>` presente com `cStat = 100` (autorizada), exatamente 1 item com grupo
`<comb>` (nesta 1ª entrega). **Testado de ponta a ponta com o XML real anexado pelo Daniel** (NFe da
Rede Dom Pedro de Postos): parse extrai corretamente chave de 44 dígitos, CNPJ, produto (código ANP
820101034 "ÓLEO DIESEL B S10 - COMUM"), 300 L, R$ 6,79/L, R$ 2.037,00 — e o fluxo completo (candidatos
→ inserção → duplicidade → ANP incorreto → fora de tolerância → e-mail desconhecido) foi testado
diretamente no banco com dados sintéticos equivalentes, todos os cenários batendo com o esperado.

**Performance com grande volume** (pedido explícito do Daniel): `EXPLAIN ANALYZE` na consulta de
matching mostrou que, sem índice na expressão normalizada de CNPJ, o Postgres cai pra filtro pós-scan
— criados `idx_pfa_pv_cnpj_normalizado`/`idx_pfa_cnpj_frota_normalizado` (índices funcionais na mesma
expressão `regexp_replace(upper(x),'[^0-9A-Z]','','g')` usada em TODAS as funções de matching
cross-tenant deste app, não só as novas — beneficia `ciclos_abertos_postos`, `abastecimentos_da_fatura`
etc. também).

**UI:**
- `/notas-fiscais` — tela única que serve as 3 visões (`resolverEmpresaAtual`, mesmo padrão de
  `/integracoes`): indicador + upload (só posto) + tabela paginada (20/página) dos abastecimentos dos
  últimos 90 dias com status Emitida/Pendente, filtro "só pendentes".
- Upload é 1 formulário genérico (reflete a decisão "sistema descobre sozinho") — trata os 5 resultados
  possíveis (sucesso, duplicada, sem correspondência, ambíguo com lista pra escolher, erro).
- `/notas-fiscais/[notaId]` — detalhe + `📄 Baixar NF-e (PDF)` (react-pdf, lazy/`ssr:false`, mesmo
  padrão de `BotaoBaixarPdfFatura`).
- Menu: `📄 Notas Fiscais` adicionado em `menuOperacao` (cliente/admin) e `menuPosto`.

## Fase 27.95 — Painel de indicadores de recolha de NF-e

Pedido do Daniel, na sequência da Fase 27.94: "precisa ter um painel de indicadores, em todas as
visões, com os percentuais de notas fiscais emitidas, pendentes de emissão... pode ter uma barra de
indicação com o percentual de recolha de NF realizado, vai ficando mais verde à medida que vai
completando a recolha de NF em 100%".

- RPC `indicador_notas_fiscais(p_empresa_id)` — agregado no banco (1 query, `count(*)`/`count(nf.id)`),
  não no client, mesma janela de 90 dias e mesma guarda de autorização das demais RPCs desta fase.
- `IndicadorNotasFiscais.tsx` — cartão no topo de `/notas-fiscais` com o percentual e uma barra cuja
  cor interpola continuamente vermelho → âmbar → verde conforme o percentual sobe (não é degrau fixo).
- Testado: indicador em 0% (nenhuma nota), inseri 1 NF de teste vinculada e o indicador atualizou pra
  refletir (`com_nota` +1, `percentual` recalculado) — depois desfeito.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos, em todos os arquivos novos/alterados desta
fase). Nova dependência: `fast-xml-parser`.

## Fase 27.96 — Robô gerador de XMLs de exemplo para testar o upload de NF-e

Pedido do Daniel: "criar um repositório em Downloads, com exemplos de XML de notas fiscais de
abastecimentos para eu testar o fluxo. Podem ser notas que vão dar o match automático e outras que
exibirão mensagens de pendências para os usuários".

`scripts/gerar-exemplos-nfe-teste.mjs` gera 9 XMLs de NF-e fictícios (modelo 55, mesma estrutura do
XML real que o Daniel anexou na Fase 27.94 — `nfeProc > NFe > infNFe` com `protNFe/infProt` anexado),
cada um pensado pra exercitar um caminho diferente do fluxo de `/notas-fiscais`:

| Arquivo | Cenário | Resultado esperado na tela |
|---|---|---|
| `01-match-automatico-diesel-s10-aditivado.xml` | bate com 1 abastecimento | "NF-e validada e vinculada com sucesso" |
| `02-match-automatico-diesel-s500-aditivado.xml` | bate com 1 abastecimento (Posto Teste 2) | sucesso |
| `03-match-automatico-gasolina-octanagem.xml` | bate com 1 abastecimento real do robô diário | sucesso |
| `04-...-cnpj-nao-cadastrado.xml` | CNPJ do cliente não existe na base | "Nenhum abastecimento correspondente foi encontrado" |
| `05-...-quantidade-nao-bate.xml` | quantidade/valor fora de qualquer tolerância | mesma mensagem do 04 (motivo diferente) |
| `06-pendencia-codigo-anp-incorreto.xml` | acha 1 abastecimento, mas o código ANP do XML não bate com o combustível dele | "O código ANP da NF-e não corresponde ao combustível deste abastecimento" |
| `07-pendencia-nfe-nao-autorizada.xml` | `cStat = 101` (cancelada) | rejeitada na leitura do XML |
| `08-pendencia-modelo-invalido.xml` | `mod = 65` (NFC-e) | rejeitada na leitura do XML |
| `09-ambiguo-duas-correspondencias.xml` | bate com 2 abastecimentos de teste | lista os 2 pra escolher |

**Achado importante ao testar os próprios exemplos** (2 bugs de normalização de CNPJ, mesma causa
raiz, dois lugares diferentes): o CNPJ do cliente de teste usado em todo o app desde a Fase 27.x é
propositalmente "malformado" (`N6.SL9.PHV/0001-84`, com letras) pra exercitar a normalização
alfanumérica usada em toda função SQL de matching (`regexp_replace(upper(x),'[^0-9A-Z]','','g')` —
mantém letras, só tira pontuação). Achei DOIS lugares que cortavam as letras por engano, cada um
quebrando o teste de um jeito diferente:
1. `src/lib/nfe.ts` (parser real) usava `apenasDigitos()` (só dígitos) pra extrair `cnpjEmitente`/
   `cnpjDestinatario` do XML — rejeitava um CNPJ de 14 caracteres alfanuméricos válido como se tivesse
   só 8 dígitos. Corrigido com `normalizarCnpj()` (mesma expressão do lado SQL).
2. O PRÓPRIO gerador de exemplos (`gerar-exemplos-nfe-teste.mjs`) tinha o mesmo bug ao ESCREVER a tag
   `<CNPJ>` no XML — mesmo depois de corrigir o `nfe.ts`, os arquivos de teste continuavam falhando,
   porque o XML gerado nunca tinha o valor certo gravado (o bug estava na geração do dado de teste, não
   só na leitura). Corrigido com a mesma `normalizarCnpj()` duplicada no script (é um script solto,
   não importa do `src/`).

**Segundo achado, mais sutil** (por isso os cenários de "match automático" não reaproveitam
abastecimentos aleatórios do robô de teste diário): a primeira tentativa espelhou XMLs em cima de
abastecimentos aleatórios existentes (Gasolina Comum, Etanol Aditivado no Posto Teste) — testando a
busca de verdade contra o banco, descobri que esse posto+cliente tem **1.000+ abastecimentos** desses
dois combustíveis, então praticamente qualquer quantidade/valor cai dentro da tolerância (0,5 L / 2%)
de mais de um registro ao mesmo tempo, virando "ambíguo" sem querer. Troquei os cenários de match
automático pra combinações posto+combustível de baixíssimo volume (Diesel S-10/S-500 Aditivado, que
não existiam ainda pra este cliente) e criei 4 abastecimentos de teste DEDICADOS
(`sync_key` começando com `teste-xml-exemplo-`, IDs 165865–165867, mais os 2 já existentes da Fase de
testes anterior — 165860/165861 — usados no cenário ambíguo). **Cada um dos 9 cenários foi conferido
rodando a RPC real `buscar_abastecimentos_candidatos_nota_fiscal` contra o banco antes de fechar os
valores** — não é só "parece certo", é testado ponta a ponta.

Também percebi, lendo o código de `actions.ts`/`_inserir_nota_fiscal_core`, que o motivo
`fora_da_tolerancia` só é alcançável quando o `abastecimento_id` é indicado diretamente (o jeito que a
API de integração de ERP permite, via `?abastecimento_id=`) — no upload manual pelo navegador, o posto
só escolhe entre candidatos que a busca já filtrou por tolerância, então esse motivo nunca aparece por
lá. Por isso os cenários 04/05 mostram a mesma mensagem genérica de "sem correspondência" por dois
motivos diferentes, em vez de eu forçar um cenário de "fora de tolerância" que na prática não acontece
nessa tela.

Uso: `node scripts/gerar-exemplos-nfe-teste.mjs [pasta-de-saída]`. Os 9 XMLs + `LEIA-ME.txt` foram
entregues ao Daniel fora do repositório (não dá pra escrever direto na pasta Downloads do usuário a
partir daqui). Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.97 — Upload de NF-e em lote (pasta inteira) com abastecimento identificado

Correção pedida pelo Daniel, testando o fluxo com os exemplos da Fase 27.96: "quando o usuário
escolher o arquivo, na realidade ele precisa escolher a pasta de origem dos XMLs e a aplicação
carregar os XMLs e realizar os matchs ou as críticas. Os registros de abastecimentos impactados
deverão ser facilmente identificados para os usuários". O upload de 1 XML por vez (Fase 27.94) virou
upload em lote:

- `UploadNotaFiscal.tsx` (reescrito) — 2 seletores: "Selecionar pasta" (usa o atributo não-padrão
  `webkitdirectory`, suportado por Chrome/Edge/Safari — como o React/TypeScript não reconhece esse
  atributo, ele é setado via `ref` + `element.setAttribute(...)` num `useEffect`, sem precisar de
  `any`/cast) e "Selecionar arquivo(s)" (`multiple`, para quem prefere marcar vários arquivos
  manualmente em vez da pasta inteira). Arquivos que não terminam em `.xml` são filtrados
  silenciosamente (com um aviso de quantos foram ignorados).
- Depois de escolher, o posto clica em "Processar N arquivos" — cada XML é enviado em sequência (1 por
  vez, não em paralelo, pra não sobrecarregar nem confundir a ordem de aparição na tela) pra MESMA
  Server Action de antes (`enviarNotaFiscalAcao`, sem mudança nas regras de negócio/validação — só
  passou a ser chamada em loop). Cada linha da lista mostra o nome do arquivo e, assim que processado,
  o resultado com cor (verde = vinculado, âmbar = já cadastrado antes, azul = ambíguo, vermelho =
  pendência/erro) — sem precisar abrir cada NF-e uma por uma.
- Resumo no topo da lista (ex.: "✓ 6 vinculadas · ↺ 1 já cadastrada · ? 1 ambígua · ✕ 1 com
  pendência") pra visão rápida do lote inteiro, importante com muitos arquivos de uma vez (mesma
  preocupação de UX com volume que o Daniel já tinha pedido nas Fases 27.94/27.95).
- Ambíguo continua resolvível ali mesmo, sem sair da lista: a linha mostra os candidatos com
  data/placa/motorista/quantidade, e escolher um reenvia só aquele arquivo com
  `abastecimento_id_forcado`, atualizando só aquela linha.

**"Registros de abastecimentos impactados facilmente identificados" — a parte que exigiu mudar a
Server Action, não só a tela:** antes, `enviarNotaFiscalAcao` só devolvia `{status: "sucesso", notaId}`
em caso de sucesso — pra descobrir qual abastecimento tinha sido vinculado, o usuário precisava clicar
em "Ver NF-e" e abrir o detalhe. Isso não escala pra um lote de vários arquivos. `actions.ts` agora
busca e devolve um resumo do abastecimento (data, placa, motorista, combustível, quantidade) junto da
resposta, tanto em `sucesso` quanto em `duplicada` (que também aponta pra um abastecimento já vinculado
antes — o usuário também precisa saber qual) — assim cada linha da lista já mostra o abastecimento
impactado, sem navegação extra. Tipo novo: `AbastecimentoResumo` (exportado de `actions.ts`).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos). Não muda nenhuma RPC/regra de validação —
só orquestração (loop no client) e uma consulta extra de leitura (resumo do abastecimento), então os 9
XMLs de exemplo da Fase 27.96 continuam servindo pra testar cada cenário, agora processados em lote de
uma vez em vez de um por um.

## Fase 27.98 — Correção: seleção de pasta não funcionava (`webkitdirectory` não confiável)

Daniel testou a Fase 27.97 e reportou, com print de tela: "Nao esta permitindo escolher a pasta,
somente arquivo por arquivo" — o botão "Selecionar pasta" abria o diálogo NATIVO do sistema, mas em
modo de arquivo comum (dava pra entrar na pasta e ver os XMLs lá dentro, mas não pra "escolher a pasta
inteira" com um clique — só arquivo por arquivo, exatamente o problema que a Fase 27.97 devia ter
resolvido).

**Causa:** a implementação usava o atributo não-padrão `webkitdirectory` num `<input type="file">`
pra forçar um seletor de pasta. Esse atributo tem suporte bem inconsistente entre
navegadores/ambientes — quando não suportado, o navegador simplesmente ignora o atributo e volta pro
comportamento de seletor de arquivo comum, sem avisar nada (foi exatamente o que aconteceu no ambiente
do Daniel).

**Correção — trocado pra ARRASTAR a pasta (drag-and-drop), mecanismo bem mais confiável entre
navegadores:**
- `UploadNotaFiscal.tsx`: a área de seleção agora é uma zona de arrastar-e-soltar (borda tracejada,
  destaca quando um arquivo está sendo arrastado sobre ela). Arrastar a pasta inteira do
  Finder/Explorer usa a **File System Entry API**
  (`DataTransferItem.webkitGetAsEntry()` → `FileSystemDirectoryEntry.createReader().readEntries()`,
  lida recursivamente) pra ler todos os XMLs de dentro dela — sem depender de nenhum seletor nativo do
  sistema operacional.
- Clicar na área (em vez de arrastar) ainda abre o seletor de arquivo comum (`multiple`, sem
  `webkitdirectory`) como alternativa — com uma dica explícita na tela ("dentro da pasta, use Ctrl+A ou
  Cmd+A pra marcar todos de uma vez"), já que esse seletor sempre funciona pra multi-seleção dentro de
  uma pasta, só não força a pasta inteira de um clique só.
- Achado técnico ao implementar: os itens de um evento de `drop` (`DataTransferItem`) só são válidos
  **sincronamente**, dentro do próprio handler — `webkitGetAsEntry()` precisa ser chamado ANTES de
  qualquer `await`; só a leitura dos arquivos a partir da entrada já obtida (`FileSystemEntry`) pode
  ser assíncrona. O código respeita essa ordem (extrai todas as entradas primeiro, só depois lê os
  arquivos).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.99 — Rejeições de NF-e persistidas e evidenciadas na listagem

Pedido do Daniel, olhando a tabela de abastecimentos depois de testar o upload em lote: "Acho que nao
ficou muito intuitivo para o usuario quais as notas foram rejeitadas e o por que. Precisa evidenciar
melhor no registro de abastecimento com uma cor diferente e trazer mais detalhes da rejeicao para dar
nova oportunidade de upload correto da NFe".

**Causa raiz:** até aqui, quando um upload de XML era rejeitado (sem correspondência, código ANP
incorreto, modelo inválido etc.), NADA era persistido no banco — o motivo só existia na lista
temporária da tela de upload (Fase 27.97) e desaparecia ao sair da página ou recarregar. A tabela de
abastecimentos só distinguia 2 estados: "Emitida" (verde) e "Pendente" (âmbar, usado tanto pra "nunca
tentou" quanto pra "tentou e falhou" — daí a falta de clareza que o Daniel notou).

**O que mudou:**
- Nova tabela `notas_fiscais_pendencias` — grava toda tentativa de upload rejeitada: motivo, CNPJ
  emitente/destinatário extraídos do XML, chave de acesso, produto, quantidade, valor, nome do arquivo
  e quando aconteceu. `abastecimento_id` fica `null` quando a tentativa não pôde ser associada a
  nenhum abastecimento (ex.: CNPJ do cliente não cadastrado — não tem como saber qual seria).
- RPC `registrar_pendencia_nota_fiscal` — grava a pendência, autorização verificada contra o JWT do
  usuário (mesmo padrão v_autorizado das demais RPCs desta área, Fase 27.94), mas aplicada sobre o
  `empresa_posto_id` que a Server Action já resolveu via `resolverEmpresaAtual` (a sessão do usuário
  logado), não via CNPJ do XML — importante porque, quando o XML nem chega a ser lido direito (falha
  estrutural), não existe CNPJ nenhum pra usar. Testado: usuário autorizado grava normalmente; usuário
  sem nenhum vínculo com o posto recebe exceção ("não autorizado a registrar pendência para este
  posto").
- `actions.ts` (`enviarNotaFiscalAcao`) chama essa RPC em TODO caminho de rejeição — erro estrutural de
  leitura do XML, sem correspondência (0 candidatos), e qualquer motivo que a RPC de inserção devolva
  (código ANP incorreto, fora de tolerância etc.) — EXCETO `chave_duplicada`, que já é tratada como
  "duplicada" e aponta pra um abastecimento já vinculado, não é uma rejeição. Registro é best-effort
  (`try/catch` silencioso): é só um log de diagnóstico, uma falha nele nunca muda a resposta que o
  usuário já ia receber.
- `abastecimentos_com_status_nota_fiscal` (RPC da listagem) ganhou um `LEFT JOIN LATERAL` na pendência
  mais recente de cada abastecimento — só quando ele AINDA não tem NF-e emitida (`on nf.id is null`),
  então assim que o abastecimento finalmente recebe uma NF-e válida, a pendência antiga some sozinha da
  tela sem precisar apagar nada.
- Nova RPC `pendencias_sem_abastecimento` — lista as rejeições que não têm `abastecimento_id` (não dá
  pra saber qual linha da tabela destacar), pra uma seção separada em `/notas-fiscais` mostrando arquivo,
  motivo e os dados extraídos do XML (CNPJ, produto, quantidade, valor), só visível pro posto.
- Tela `/notas-fiscais`: 3 estados agora — verde "Emitida", **vermelho "Rejeitada" com o motivo escrito
  embaixo** (reaproveita `mensagemMotivoPendencia`, já usada pelas mensagens da RPC de inserção — texto
  único, sem duplicar em SQL e TS), e âmbar "Pendente" só quando realmente nunca houve tentativa.

**Testado ponta a ponta com dados reais:** registrei uma pendência `codigo_anp_nao_corresponde` pro
abastecimento de teste #165865 (cenário 06 dos exemplos da Fase 27.96) e confirmei que
`abastecimentos_com_status_nota_fiscal` devolveu o motivo certo pra aquela linha; registrei uma
pendência `sem_correspondencia` sem abastecimento e confirmei que ela aparece em
`pendencias_sem_abastecimento` com os dados do XML (CNPJ, produto) intactos. Também testei o limite de
autorização (usuário sem vínculo com o posto → exceção) e um caso de usuário com acesso a 2 postos (Rede
de Postos, Fase 27.87) → autorizado nos dois, como esperado. Dados de teste removidos depois — a tabela
fica limpa pro primeiro teste real do Daniel.

**Limitação conhecida:** a Server Action resolve o posto da pendência via sessão do usuário
(`resolverEmpresaAtual`, sem parâmetro), que auto-seleciona quando o usuário só tem 1 empresa — cobre o
caso normal (usuário do posto logado). Se um ADMIN fizer upload numa página de posto que não é "a dele"
(via `?empresa=`), a resolução por sessão não escolhe automaticamente qual das várias empresas do admin
usar, e o registro de pendência é pulado (best-effort — não quebra o upload em si, só não gera o log de
diagnóstico nesse caso específico). Não afeta o fluxo normal do posto.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.100 — Filtros de status de NF-e na listagem

Pedido do Daniel, na sequência da Fase 27.99: "criar filtros de seleção de status de NF para facilitar
a busca pelo usuário". A tela só tinha "Todos / Só pendentes" — e "Só pendentes" misturava as duas
categorias que a Fase 27.99 passou a distinguir visualmente (Rejeitada vs. Pendente), então o filtro
ficou desalinhado com o que a tela mostra.

- `abastecimentos_com_status_nota_fiscal` trocou `p_apenas_pendentes` (boolean) por `p_status` (text:
  `'emitida' | 'rejeitada' | 'pendente' | null` = todos) — precisou `drop function` porque o tipo de
  retorno já tinha mudado na Fase 27.99 (não é só um parâmetro a mais). Testado cada filtro isoladamente
  contra os dados reais do Posto Teste (7407 abastecimentos): `emitida` → 1, `pendente` → 7406,
  `rejeitada` → 0 (nenhuma pendência registrada ainda), `null` (todos) → 7407 — bate exatamente com
  emitida + pendente + rejeitada. Registrei uma pendência de teste pro abastecimento #165865 e confirmei
  que ela migrou de `pendente` pra `rejeitada` no filtro (contagem: pendente caiu de 7406 pra 7405,
  rejeitada trouxe exatamente aquele abastecimento) — removida depois.
- `indicador_notas_fiscais` ganhou os campos `rejeitadas` e `pendentes` (além dos já existentes `total`,
  `com_nota`, `sem_nota`) — não precisou `drop` porque o retorno é `jsonb` (tipo opaco pro Postgres,
  só ganha chaves novas). Usado tanto pra mostrar a contagem ao lado de cada filtro (`Emitida (1)`,
  `Rejeitada (0)`, `Pendente (7406)`) quanto no resumo do painel de indicadores (`IndicadorNotasFiscais`
  agora mostra "· 6 rejeitadas" em vermelho separado de "· 400 pendentes" em âmbar, em vez de um
  "pendente" genérico que escondia quantas eram rejeições de verdade).
- Filtros viram 4 links (`Todos`, `Emitida`, `Rejeitada`, `Pendente`) com a contagem entre parênteses,
  cor por categoria (verde/vermelho/âmbar) igual ao badge da própria linha da tabela — clicar aplica
  `?status=` na URL, mesmo padrão de link simples já usado (sem JS extra, funciona com paginação e
  troca de empresa juntos).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.101 — Corrigir resolução do posto ao registrar pendência (multi-posto/sessão)

O Daniel processou o lote real dos 9 XMLs de exemplo (Fase 27.96) pela tela de upload: a caixa de
resultado mostrou "5 com pendência", mas a listagem de `/notas-fiscais` continuou com "Rejeitada (0)" —
nenhuma das 5 rejeições apareceu. Pedido dele: "Apos processar precisa identificar os abastecimentos na
lista, incrementando os filtros".

**Causa raiz:** a Server Action resolvia o posto da pendência via `empresaPostoAtual()` →
`resolverEmpresaAtual(supabase)` **sem parâmetro** — que só auto-resolve a empresa quando o usuário tem
acesso a **exatamente 1** empresa (`empresaSelecionada` fica `null` caso contrário). O usuário de teste
(`posto.teste@fni.test`) tem acesso a **2** postos — Posto Teste e Posto Teste 2 — via Rede de Postos
(Fase 27.87). Resultado: `empresaPostoId` era sempre `null` pra esse usuário, então
`registrarPendenciaBestEffort` nunca era chamada — a feature inteira da Fase 27.99 ficava silenciosamente
inoperante pra qualquer usuário com mais de 1 posto vinculado (exatamente o caso do teste do Daniel).
Isso já tinha sido documentado como "limitação conhecida" na Fase 27.99, mas a limitação real era mais
ampla do que o texto dizia — não afetava só admins fazendo upload fora do posto "deles", afetava
qualquer usuário multi-posto comum.

**Correção:** resolver o posto pelo **CNPJ emitente do próprio XML**, em vez da sessão do navegador —
nova RPC `resolver_posto_por_cnpj(p_cnpj_emitente)`, que reaproveita exatamente o mesmo match já usado em
`buscar_abastecimentos_candidatos_nota_fiscal` (`regexp_replace(upper(cnpj),'[^0-9A-Z]','','g')` contra
`empresas` com `segmento = 'Revenda'`), com o mesmo padrão `v_autorizado` (`IS NOT TRUE`, não `NOT`) das
demais RPCs `SECURITY DEFINER` desde a Fase 27.93 — só devolve o posto se o usuário logado realmente tem
acesso a ele, senão devolve `null` (tratado como best-effort pela action, igual antes).

- `src/lib/nfe.ts`: `ResultadoParseNfe` (branch `ok: false`) ganhou um campo opcional
  `cnpjEmitenteParcial` — mesmo quando o XML é rejeitado por um motivo **estrutural** (modelo inválido,
  NFe não autorizada pela SEFAZ, chave inválida etc.), normalmente ainda dá pra ler o CNPJ do emitente
  (o XML em si está bem formado, só foi rejeitado por regra de negócio). Esse CNPJ parcial é extraído
  logo no início de `parsearXmlNfe` (antes de qualquer checagem que possa retornar cedo) e devolvido em
  **todas** as 9 saídas de erro da função, pra a Server Action ainda saber a qual posto atribuir a
  pendência mesmo quando o parse falha antes de chegar no CNPJ "oficial" (`nfe.cnpjEmitente`, que só
  existe no caminho de sucesso).
- `src/app/(dashboard)/notas-fiscais/actions.ts`: removida a dependência de `resolverEmpresaAtual` por
  completo — `empresaPostoAtual()` foi substituída por `resolverPostoPorCnpj(supabase, cnpj)`, chamada
  nos 3 pontos onde uma pendência é registrada: falha estrutural do parser (usa
  `parse.cnpjEmitenteParcial`), `sem_correspondencia` e rejeição vinda da RPC de inserção (ambas usam
  `nfe.cnpjEmitente`, já disponível nesses pontos porque o parse teve sucesso).
- Efeito colateral positivo: um único lote de upload agora pode conter XMLs de **postos diferentes**
  (o caso real do Daniel — Posto Teste e Posto Teste 2 no mesmo lote de exemplos) e cada pendência é
  atribuída ao posto certo, individualmente — a resolução por "empresa atual" de sessão nunca poderia
  representar isso corretamente de qualquer jeito, mesmo se não tivesse o bug do `null`.

**Testado com dados reais:** simulei os dois caminhos (rejeição vinda da RPC de inserção e
`sem_correspondencia`) como o usuário multi-posto de teste, chamando `resolver_posto_por_cnpj` com o
CNPJ de cada posto e depois `registrar_pendencia_nota_fiscal` com o resultado — confirmado que a
pendência do CNPJ do Posto Teste foi gravada com `empresa_posto_id = 453076b1-...` e a do Posto Teste 2
com `299af3e2-...`, cada uma no posto certo. Testado também que um CNPJ desconhecido (não cadastrado
como posto) devolve `null` sem erro. Dados de teste removidos depois.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.102 — Status de NF-e (rejeitada + motivo) também em "Abastecimentos Fornecidos"

Pedido do Daniel, olhando o filtro/badge de NF-e que já existia em `/notas-fiscais` (Fases 27.99/27.100):
"Gostaria que fosse assim na visão do posto também, identificando no filtro a quantidade de rejeitados
e nos registros de abastecimentos, o status de rejeitado com a descrição". E, na sequência: "Acho qu fica
mais intuitivo para o usuario de posto para corrigir a NF".

`/notas-fiscais` é uma tela separada, só de NF-e — mas o posto acompanha o dia a dia mesmo é em
"Abastecimentos Fornecidos" (`AbastecimentosPosto.tsx`, renderizada dentro de `/abastecimentos` quando a
empresa selecionada tem `segmento = 'Revenda'` — Fase 27.58). Essa tela nunca teve nenhuma coluna de
status de NF-e: o posto precisava ir em `/notas-fiscais` pra descobrir o que foi rejeitado. Faz mais
sentido resolver isso onde ele já está.

- Duas consultas novas (mesmo padrão já usado pra pintar a bolinha de "ajuste pendente" — Fase 27.68):
  todos os registros de `notas_fiscais_abastecimento` e `notas_fiscais_pendencias` deste posto (ambas as
  tabelas já têm RLS própria escopando por `empresa_posto_id`, Fases 27.94/27.99 — não precisou de RPC
  nova), virados em dois mapas `abastecimento_id → status`. Pendência só "vale" como rejeição se o mesmo
  abastecimento ainda NÃO tem NF-e emitida (mesma regra da `LEFT JOIN LATERAL ... on nf.id is null` já
  usada em `abastecimentos_com_status_nota_fiscal`) — assim que o posto reenvia a NF-e certa, a rejeição
  antiga some sozinha da lista, sem precisar apagar nada.
- Nova coluna "NF-e" na tabela, com o mesmo badge de 3 estados de `/notas-fiscais`: verde "Emitida",
  vermelho "Rejeitada" com o motivo escrito embaixo (reaproveita `mensagemMotivoPendencia`, mesmo
  dicionário de mensagens do resto do app), âmbar "Pendente".
- Nova linha de filtros "NF-e: Todas / Emitida / Rejeitada / Pendente" com contagem, mesma cor por
  categoria do badge — combinável com os filtros já existentes (combustível, cliente, busca, data,
  🔴 ajuste pendente). As contagens dos filtros são calculadas SEM o próprio filtro de status de NF-e
  aplicado (só com os demais filtros), pra os números não mudarem quando o posto troca de um filtro de
  status pro outro — mesma ideia do painel de indicadores de `/notas-fiscais`.

**Testado com dados reais:** conferi por SQL direto que a contagem bate com o que a tela vai mostrar pro
Posto Teste — 7407 abastecimentos no total, 1 emitida, 1 rejeitada (a pendência de exemplo
`codigo_anp_nao_corresponde` da Fase 27.96/27.99, mantida como fixture), 7405 pendentes — soma exata.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.103 — Detalhe do XML rejeitado direto na linha do abastecimento

Pedido do Daniel, olhando `/notas-fiscais` depois da Fase 27.102: "não deveria ter uma relação do
registro rejeitado com a tela de detalhe abaixo?" — comparando a linha "Rejeitada" da tabela de
abastecimentos (que só mostrava o motivo) com a seção "Uploads sem abastecimento correspondente" (que
mostra arquivo + dados extraídos do XML: CNPJ, produto, quantidade, valor). Perguntei o formato via
`AskUserQuestion` — escolhido: mostrar os mesmos detalhes na própria linha, em vez de um link separado ou
de unificar as duas tabelas.

Os dados já existiam em `notas_fiscais_pendencias` (Fase 27.99) independente de a pendência ter
`abastecimento_id` ou não — só não eram devolvidos pela RPC pro caso "com abastecimento vinculado":

- `abastecimentos_com_status_nota_fiscal` (`drop` + `create`, mudou o formato de retorno) ganhou 6
  colunas novas: `pendencia_nome_arquivo`, `pendencia_cnpj_emitente`, `pendencia_cnpj_destinatario`,
  `pendencia_produto_nome_xml`, `pendencia_quantidade`, `pendencia_valor_total` — mesma
  `LEFT JOIN LATERAL` já existente, só selecionando mais colunas de `notas_fiscais_pendencias`.
- `/notas-fiscais`: a linha "Rejeitada" agora mostra, embaixo do motivo, uma segunda linha cinza com
  "Arquivo: X.xml · CNPJ emitente ..., produto, quantidade, valor" (só os campos que existirem).
- `AbastecimentosPosto.tsx` (Fase 27.102): mesma extensão, direto na consulta a
  `notas_fiscais_pendencias` (não usa a RPC acima, já que essa tela tem filtros próprios que a RPC não
  cobre — ver Fase 27.102) — mesmo texto, mesmo lugar, pra manter as duas telas consistentes.

**Testado com dados reais:** chamei a RPC estendida como o usuário de teste do posto e confirmei que o
abastecimento #165865 (pendência de exemplo da Fase 27.96/27.99) devolve
`pendencia_nome_arquivo = "06-pendencia-codigo-anp-incorreto.xml"`, CNPJ emitente, produto
"DIESEL S500 COMUM", 45.21 L, R$ 276,01 — batendo exatamente com o XML de exemplo original.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.104 — ID de 10 dígitos por abastecimento + busca pelo ID nos filtros

Pedido do Daniel: "Implementar um ID de abastecimento numerico (10 digitos) para cada abastecimento e,
que servira de base e consulta para que o usuario encontre, rapidamente, o registro, seja ele com NFe ok
ou com NFe rejeitada. Ajustar os filtros para busca pelo ID". Depois, especificando o escopo: "tela de
abastecimentos, no filtro livre, poder consultar pelo ID abastecimento, em todas as visões".

- `profrotas_abastecimentos` ganhou a coluna GERADA `codigo_abastecimento` (`text`,
  `(1000000000 + id)::text`, `STORED`) — sempre 10 dígitos (faixa atual do `id`: 6 dígitos, então soma
  1 bilhão pra completar; só estoura os 10 dígitos quando `id` passar de 8,9 bilhões, praticamente nunca
  pra esse volume de negócio). É uma coluna GERADA, não uma sequence nova: preenchida automaticamente
  pelo Postgres pra toda linha existente e futura, sem backfill nem trigger — e como é bijetiva com o
  `id` (a própria PK, só reapresentada), buscas por ela continuam baratas (índice único próprio criado
  também). Tipo `text` (não `bigint`) pra permitir busca PARCIAL (só o final do número), não só exata.
- Campo de busca livre já existente em "Abastecimentos" (cliente, `/abastecimentos/page.tsx`) e
  "Abastecimentos Fornecidos" (posto, `AbastecimentosPosto.tsx`) passou a casar também com
  `codigo_abastecimento` (mesmo `.or(...)` já usado pra placa/motorista/cliente/posto) — "em todas as
  visões", como pedido.
- `/notas-fiscais` não tinha nenhum campo de busca livre (só o filtro de status) — ganhou um novo campo
  "Buscar por ID do abastecimento", e a RPC `abastecimentos_com_status_nota_fiscal` ganhou o parâmetro
  `p_busca` (ILIKE parcial contra `codigo_abastecimento`).
- Coluna "ID" nova em todas as 3 tabelas (cliente, posto, notas fiscais), e no cabeçalho de
  `/abastecimentos/[id]` — pra o usuário conseguir referenciar/copiar o código do registro que encontrou.

**Hotfix durante a implantação:** a primeira versão da migração fez `DROP` + `CREATE` de
`abastecimentos_com_status_nota_fiscal` adicionando `p_busca` **sem valor padrão**. Como o banco é
compartilhado e imediato mas o deploy do frontend só acontece com `git push` (regra do Daniel), o site
que já estava no ar continuou chamando a RPC com só 4 parâmetros (sem `p_busca`) — e como a versão de 4
parâmetros tinha acabado de ser apagada pelo `DROP`, a chamada passou a não bater com nenhuma função,
falhando silenciosamente: o indicador (`indicador_notas_fiscais`, função separada, não afetada) continuou
mostrando a contagem certa, mas a tabela vinha sempre vazia. O Daniel reportou isso ao vivo: "cliquei no
filtro de rejeitados, nao apareceu o item rejeitado e na tela de notificacao no rodape, aparecem itens
rejeitados. Muito confuso" — a contagem (1) batia, a tabela não mostrava nada, e a seção separada
"Uploads sem abastecimento correspondente" (RPC diferente, não afetada) continuava mostrando itens
normalmente, reforçando a inconsistência. Corrigido dando `DEFAULT null` a `p_busca` (e `DEFAULT` também
a `p_limit`/`p_offset`, por segurança) via `CREATE OR REPLACE` — mudar só o valor padrão de um parâmetro
NÃO muda a identidade da função, então não precisa de `DROP`, e o código antigo (sem `p_busca`) voltou a
funcionar imediatamente, sem precisar de deploy nenhum. **Lição pra próximas fases:** todo parâmetro novo
adicionado a uma RPC já usada por uma tela em produção precisa ter `DEFAULT`, justamente pra não quebrar
o site enquanto o `git push` da mudança correspondente no frontend não foi feito.

**Testado com dados reais:** confirmado que `codigo_abastecimento` bate 1:1 com o `id` (ex.: id 165865 →
`1000165865`); busca parcial (`ilike '%65865%'`) encontra o registro certo; simulei a chamada da RPC como
o frontend antigo (só 4 parâmetros, sem `p_busca`) e confirmei que agora funciona (antes do hotfix, essa
mesma chamada não batia com nenhuma função).

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.105 — Regra de negócio: só fatura abastecimento com NF-e vinculada

Pedido do Daniel (regra de negócio nova, texto original): "Os abastecimentos registrados na plataforma,
precisam ter notas fiscais atreladas para que o posto receba. [...] todos os abastecimentos de um ciclo ao
qual tiverem notas fiscais atreladas, seguirão no ciclo e na fatura/boleto do ciclo. Os abastecimentos que
não tiverem nota fiscal atrelada dentro do ciclo, quando o mesmo for fechado, estes abastecimentos serão
realocados, automaticamente para o próximo ciclo e assim por diante. [...] para tanto, preciso que todos os
mais de 7000 abastecimentos registrados sejam contemplados com uma nota fiscal e que esta nova regra
esteja vigente para os próximos ciclos a serem abertos."

Antes de mexer em lógica de faturamento, perguntei dois pontos via `AskUserQuestion`:

1. **O que fazer com as 6 faturas de teste já existentes** (4 pagas, 2 abertas, 218 abastecimentos, nenhum
   com NF-e)? Resposta do Daniel: **deixar como estão — a regra só vale daqui pra frente.** Nenhuma fatura
   já gerada foi tocada.
2. **Como preencher NF-e pros 7000+ abastecimentos já registrados**? Resposta do Daniel: **gerar os
   registros de NF-e diretamente no banco**, usando a mesma RPC de validação que um upload de verdade usa
   (não pular a validação).

### Escopo real do backfill (descoberto, não assumido)

A base tem ~8128 `profrotas_abastecimentos` (dados sincronizados do PróFrotas), espalhados por ~690
`pv_cnpj` diferentes. Mas só **2 postos** têm empresa cadastrada (`segmento='Revenda'`) *e* negociação
aceita — os únicos dois que estruturalmente podem ser faturados por essa plataforma:

- **Posto Teste Ltda** — 7407 abastecimentos
- **Posto Teste 2 Ltda** — 31 abastecimentos

Total: **7438**, batendo com o "mais de 7000" do Daniel. Os outros ~690 CNPJs nunca foram cadastrados como
empresa — sem `empresas`, toda RPC de faturamento devolve `posto_nao_encontrado`; estão fora do escopo de
qualquer jeito, independente dessa mudança.

### Backfill executado

Rodei um laço (`DO $$ ... $$`, operação de dados pontual, não migração rastreada) chamando
`inserir_nota_fiscal_abastecimento(..., p_empresa_posto_id_confiavel, p_enviado_por => 'backfill-fase-27-105')`
para cada abastecimento dos 2 postos acima que ainda não tinha NF-e. Esse overload da função (usado
internamente também pelo robô de XMLs de exemplo da Fase 27.96) confia no chamador em vez de resolver a
sessão via `auth.jwt()` — mas delega toda a validação de verdade (`_inserir_nota_fiscal_core`) pro mesmo
código que valida um upload real: modelo 55, chave de acesso única, abastecimento existe e ainda não tem
nota, CNPJ bate com o do abastecimento, quantidade/valor dentro da tolerância, código ANP válido.

Os campos da NF-e sintética vêm todos do próprio abastecimento (garante bater na tolerância):
`cnpj_emitente`/`cnpj_destinatario`, nomes, produto, quantidade, valores. `produto_codigo_anp` resolvido
via `combustiveis_codigo_anp` → `anp_codigos_combustivel` (os 9 combustíveis usados nos dados de teste
mapeiam limpo, zero nulos). `chave_acesso` montada de forma determinística e única — CNPJ (14 dígitos) +
id do abastecimento (20 dígitos) + preenchimento (10 dígitos) = 44 caracteres, bijetiva com o id, garante
que nunca colide. `enviado_por = 'backfill-fase-27-105'` marca o registro como sintético, pra rastreabilidade
(distingue de upload real feito pelo posto).

Testei 1 linha primeiro (conferi chave com 44 caracteres, ANP resolvido certo, valores batendo), apaguei, e
só depois rodei o lote completo. **Resultado: 7435 NF-e criadas** (dos 7438 abastecimentos, 3 já tinham
NF-e de testes anteriores — Fase 27.96/27.99). Confirmado depois: os dois postos ficaram com 100% de
cobertura de NF-e.

### Mudança na regra de fechamento de ciclo

`gerar_faturas_postos_robo()` (SECURITY DEFINER, roda toda noite via pg_cron às 03:00 UTC) — `CREATE OR
REPLACE`, mesma assinatura, só mudou a lógica interna. Duas mudanças na consulta que soma e na que marca
`fatura_posto_id`:

- Adicionado `and exists (select 1 from notas_fiscais_abastecimento nf where nf.abastecimento_id = pa.id)`
  — só entra na fatura quem tem NF-e.
- Trocado `data_abastecimento between periodo_inicio and periodo_fim` por `data_abastecimento <=
  periodo_fim` (tirou o limite inferior). Como não existe `ciclo_id` armazenado (os ciclos são calculados
  por intervalo de data, não por uma tabela própria), o "realocamento automático pro próximo ciclo" não
  precisa de nenhuma lógica explícita de mover/marcar nada: um abastecimento sem NF-e simplesmente fica
  com `fatura_posto_id` nulo quando o ciclo fecha, e o próximo fechamento (mesma condição `<= periodo_fim`)
  volta a considerá-lo — assim que ganhar a NF-e, ele é varrido automaticamente pro próximo boleto.

Duas RPCs de pré-visualização (mostram o ciclo "em andamento", ainda não fechado) ganharam a mesma regra,
pra não mostrar um valor que depois não vai bater com a fatura de verdade:

- **`ciclos_abertos_postos()`** (`DROP` + `CREATE`, mudou o formato de retorno): `valor_acumulado`,
  `volume_acumulado` e `quantidade_abastecimentos` agora contam só quem TEM NF-e (o que efetivamente vai
  ser faturado); duas colunas novas, `valor_pendente_nfe` e `quantidade_pendente_nfe`, contam o
  complementar (represado esperando nota).
- **`abastecimentos_do_ciclo_aberto(p_negociacao_id)`** (`DROP` + `CREATE`): ganhou a coluna `tem_nfe`
  (boolean), pra marcar linha a linha quem já tem nota.

Essas duas mudam o formato de retorno (`DROP` necessário), mas são só colunas NOVAS — os dois lugares que
consomem (`SecaoCiclosAbertos.tsx`, `ciclo-aberto/[negociacaoId]/page.tsx`) sempre acessaram os campos por
nome (`c.valor_acumulado`, nunca desestruturação posicional), então não corre o mesmo risco do hotfix da
Fase 27.104 — confirmado antes de aplicar.

### Frontend

- `SecaoCiclosAbertos.tsx` (cards de ciclo em andamento, usado em `/financeiro-posto`, `/financeiro` e nos
  detalhes de cliente/posto): nova coluna "Pendente NF-e" na tabela, e aviso em vermelho no texto de
  cabeçalho quando algum ciclo tem valor represado.
- `VisaoCiclosPorContraparte.tsx` (lista "Ciclos por posto/cliente"): nova linha vermelha
  "R$ X (N) esperando NF-e" abaixo do resumo do ciclo atual, quando aplicável.
- `ciclo-aberto/[negociacaoId]/page.tsx` (detalhamento do ciclo em andamento, Fase 27.93): novo card
  "Pendente NF-e" na grade de indicadores (5 → 6 colunas), e nova coluna "NF-e" na tabela de abastecimentos
  com badge verde "Com NF-e" / vermelho "Sem NF-e" por linha (`colSpan` do estado vazio ajustado de 7 → 8).
- `database.types.ts` atualizado com as novas colunas das 2 RPCs.

### Testado, mas com uma limitação honesta

Validei as 3 RPCs modificadas simulando a sessão do posto de teste via JWT: `ciclos_abertos_postos()`
devolveu as 5 negociações, todas com `valor_pendente_nfe = 0` (confirma que o backfill cobriu 100%);
`abastecimentos_do_ciclo_aberto(...)` devolveu `tem_nfe = true` pros 87 abastecimentos do ciclo atual.
Rodei `gerar_faturas_postos_robo()` de verdade — devolveu 0 faturas novas, o que é o esperado: nenhum ciclo
está de fato vencido hoje (todos os `periodo_fim_previsto` são futuros). **Ou seja, o caminho de
FECHAMENTO de verdade (o `UPDATE` que marca `fatura_posto_id` com o filtro de NF-e novo) ainda não foi
exercitado com um ciclo vencendo de verdade** — só a lógica equivalente das RPCs de pré-visualização
(`SELECT`, mesma estrutura de filtro) foi validada contra dados reais. Vai ser testado de verdade na
primeira vez que um ciclo vencer organicamente — ou, se o Daniel preferir validar antes disso, dá pra
forçar um cenário de teste sob demanda.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.106 — Landing page: seção de hub de integração com meios de pagamento

Pedido do Daniel, com texto pronto pra incorporar: explicar que a FNI é um hub que conecta a operação das
empresas direto aos principais players de meios de pagamento para frota (ex.: Ticket Log, Edenred
Mobilidade), centralizando abastecimento, regras de consumo por veículo e conciliação de pagamento numa
única interface. Depois, ajuste de tom: "Precisa incorporar este texto, de forma mais clara para que o
potencial contratante da plataforma, entenda qual é o principal benefício de contratação da FNI para o seu
negócio de gestão de frotas. É uma aplicação Hub que integra todos os meios de pagamentos de gestão de
frotas e gerenciamento único" — ajustei o título/texto de abertura da seção pra deixar esse benefício
central explícito logo de cara ("Um único hub para todos os meios de pagamento da sua frota... chega de
operar cada meio de pagamento separadamente"), em vez de só descrever a integração tecnicamente.

- Nova seção `#integracoes` em `src/app/_landing/landingBody.ts`, entre "Funcionalidades" e "Como
  funciona" (mesmo padrão visual de `sec-lbl`/`sec-title`/`sec-sub`/`grid`/`card` já usado nas outras
  seções — sem CSS novo). Link novo no menu (`Integrações`).
- Parágrafo de abertura + sub-título "Principais Vantagens da Integração" + 4 cards: Conexão
  Multiprestadores (com links para Ticket Log e Edenred Mobilidade, `target="_blank"`), Autorização em
  Tempo Real, Conciliação Automatizada, Segurança e Controle — texto do Daniel, sem alteração de conteúdo
  nos 4 cards (só o título/abertura da seção foi reforçado pra deixar o benefício central mais claro).
- A landing tem troca de idioma PT/EN via `localStorage` (dicionário `_i18n` no fim do arquivo, script
  troca `textContent`/`innerHTML` de todo elemento com `data-i18n`/`data-i18n-html`) — adicionei as 9
  chaves novas (`nav_integracoes`, `integracoes_lbl/title/sub/vant_title`, `intcard0..3_t/d`) nos dois
  idiomas, senão a seção ficaria em português mesmo com o usuário no modo EN. O card de "Conexão
  Multiprestadores" usa `data-i18n-html` (não `data-i18n`) porque o texto contém os links `<a>` — o script
  de troca de idioma usa `innerHTML` só pros atributos `-html`, então um `data-i18n` comum escaparia as
  tags como texto puro.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos).

## Fase 27.107 — Corrigir negociações "aceita" duplicadas por par posto+cliente

Pedido do Daniel, com print de 2 linhas de "ciclo em andamento" sobrepostas pro mesmo cliente ("Frotas &
Frotas Ltda"): "Não creio que estes ciclos estejam corretos. A aplicação precisa aplicar os ciclos
definidos para cada cliente (7+7, 15+10, 30+15,...) e ajustar os ciclos criados."

**Causa raiz encontrada no banco:** existiam 2 negociações com `status='aceita'` SIMULTANEAMENTE para o
mesmo par (posto, cliente) — `58b7790b...` (ciclo 7 dias + prazo 7 dias, criada 05/07, com histórico real:
3 faturas já geradas, 2 pagas e 1 aberta) e `e15a517c...` (ciclo 30+30, criada 08/07, sem nenhuma fatura
ainda — uma segunda negociação aceita por engano pro mesmo par, sem que a primeira fosse encerrada).
`ciclos_abertos_postos()` itera por TODA negociação com `status='aceita'`, sem deduplicar por par — por
isso apareciam 2 linhas de ciclo em andamento pro mesmo cliente, com período/vencimento diferentes (a linha
correta, 05/07–11/07 vencendo 18/07, bate exatamente com a negociação de ciclo 7+7 que já vinha fechando
faturas normalmente; a segunda linha, 08/07–31/07 vencendo 30/08, era a duplicata sem histórico).

`decidirNegociacao()` (`src/lib/negociacoesPostos.ts`) nunca checava se já existia outra negociação aceita
pro mesmo par antes de gravar um novo aceite — um `UPDATE` cego só na própria linha. Não existe fluxo de
"renegociação" vinculado à aceita anterior (`FormularioNovaNegociacao.tsx` sempre cria do zero) nem nenhum
`UNIQUE` no banco impedindo isso.

**Correção:**
- Dado: cancelada a negociação duplicada sem histórico (`e15a517c...` → `status='cancelada'`), mantida a
  negociação com faturas reais (`58b7790b...`, ciclo 7+7).
- Banco: índice único parcial `negociacoes_postos_par_aceita_unica` em
  `(empresa_posto_id, empresa_cliente_id) WHERE status = 'aceita'` — garante, a nível de banco, que nunca
  mais existam 2 negociações aceitas ao mesmo tempo pro mesmo par, mesmo se algum código futuro (ex.: a API
  externa de decisão em `src/app/api/integracoes/negociacoes/[id]/decisao/route.ts`) esquecer de checar.
- Código: `decidirNegociacao()` agora, antes de gravar o aceite, cancela automaticamente qualquer outra
  negociação já aceita do mesmo par posto+cliente — uma renegociação aceita sempre substitui a anterior, as
  duas nunca convivem. Isso cobre tanto o fluxo interno (`/negociacoes`) quanto a API externa (mesma função
  compartilhada), e evita que o índice único do banco chegue a barrar a operação com um erro cru.

Validado com `npx tsc --noEmit` e `npx eslint` (limpos). Confirmado no banco: `select ... group by
empresa_posto_id, empresa_cliente_id having count(*) > 1` não retorna mais nenhum par duplicado.
