# Backlog

Itens levantados em conversas com o Daniel e explicitamente adiados pra
depois (não é lista de ideias — só o que foi decidido fazer, mas ainda não
entrou). Cada item tem contexto suficiente pra retomar sem precisar
reconstruir o raciocínio do zero.

## Assistente FNI: visualização, usabilidade e destaque na aplicação — FEITO em 22/11/2026 (exceto "Fixar no painel")

**Feito:** tela inicial com saudação, caixa em destaque e cartões por tema; conversa com
markdown, copiar, sugestões de continuação, histórico de conversas por usuário (tabela
`assistente_conversas`, RLS por e-mail) e "Nova conversa"; seletor de cliente compacto na
barra; destaque no menu lateral (cartão laranja no topo), cartão "Pergunte à FNI" no
Dashboard (cliente e posto), botão flutuante "Pergunte à FNI" em todas as telas e atalho
Ctrl/Cmd+K, com sugestão conforme a tela.

**Ainda em aberto:**
- "Fixar no painel": guardar um gráfico/resposta do assistente como cartão do Dashboard
  (precisa de tabela de cartões fixados + re-execução da consulta ao abrir).
- Mobile (PWA do posto): o Flutter ainda não desenha os gráficos que `/api/assistente`
  devolve em `blocos`.
- Dashboard: o cartão "Pergunte à FNI" aparece mesmo para perfil sem permissão ao
  Assistente (o clique cai no aviso de acesso negado) — esconder conforme a permissão.

## Pedido de ajuste (aprovação da contraparte) para abastecimentos PDV

**Adiado em:** 02/10/2026, pedido do Daniel ("coloca no backlog para
resolvermos depois").

**Contexto:** os canais interno/externo já têm um fluxo de "pedido de
ajuste" — quando um lado (cliente ou posto) quer contestar/corrigir um
abastecimento, abre um pedido que a contraparte aprova ou rejeita
(`ajustes_abastecimentos` + RPC `decidir_ajuste_abastecimento` +
componente `PainelAjusteAbastecimento` no painel web). Abastecimentos PDV
(tabela `abastecimentos_pdv`, projeto `pdv-fni`) não têm esse fluxo ainda —
a tela `/abastecimentos/pdv/[id]` no Gestão de Frotas já tem uma nota
explícita avisando disso.

**O que falta:**
- Adicionar coluna `abastecimento_pdv_id` em `ajustes_abastecimentos` (hoje
  só referencia interno/externo).
- Estender a RPC `decidir_ajuste_abastecimento` pra aceitar esse novo tipo.
- Estender o tipo/identificador usado pelo componente
  `PainelAjusteAbastecimento` pra aceitar `"pdv"` como provedor.
- Ligar o painel na tela `/abastecimentos/pdv/[id]` (Gestão de Frotas).

## ~~Crop manual na tela de captura do hodômetro (PWA Motorista)~~ — FEITO em 03/10/2026

Resolvido de outra forma, por sugestão do Daniel: em vez de recorte manual
depois da foto, a câmera ao vivo (pacote `camera`) já mostra um quadro de
enquadramento; a foto vai ao OCR junto com o retângulo do quadro e o
servidor recorta nessa região. Texto original abaixo, só pra histórico.

**Adiado em:** 02/10/2026, depois de melhorar a acurácia do OCR
(pré-processamento com `sharp` — grayscale/normalize/sharpen/threshold +
variante invertida, PSM fixado em single-line, foto em maior
resolução/qualidade, aviso de confiança baixa no app). Ainda não se sabe
se essas melhorias bastam na prática.

**Contexto:** a tela `abastecimento_pdv_hodometro_screen.dart`
(estrada-que-cuida) fotografa o painel inteiro do veículo e manda pro OCR
sem nenhum recorte — o dígito do hodômetro é só uma fração pequena da foto,
com bastante "ruído visual" em volta (ponteiros, ícones, reflexo do
vidro). Se o ajuste de pré-processamento não for suficiente, o próximo
passo natural é deixar o motorista recortar manualmente a região dos
dígitos antes de enviar (motorista arrasta um quadro na própria tela) —
tende a ajudar mais que qualquer ajuste de algoritmo, mas é mais trabalho
de UI (precisa de lib de crop ou canvas customizado, hoje não há nenhuma
no `pubspec.yaml`).

**Decisão:** só entrar nisso se o motorista reportar que a leitura
continua ruim depois do ajuste já aplicado.

## Assistente FNI: consumo e chave por cliente — FEITO em 22/11/2026
- Franquia mensal de tokens por plano (`limites_plano.assistente_tokens_mes`, -1 = ilimitada; valores iniciais são suposições a ajustar) e ajuste por cliente em `assistente_config_empresa.franquia_tokens_mes`.
- Cliente pode cadastrar a própria chave Anthropic (Vault, validada antes de salvar); com chave própria não há limite da FNI. Franquia esgotada bloqueia com convite para a chave própria.
- Pendente: tela de admin para editar franquia/limites por plano e por cliente (hoje via SQL); mostrar custo estimado em R$.
- Requer `SUPABASE_SERVICE_ROLE_KEY` no Railway (já usada nos convites); `ANTHROPIC_API_KEY` continua sendo a chave da FNI.

## Desempenho (22/11/2026)
- FEITO: índice por expressão em `anp_postos` (CNPJ normalizado) — a view `abastecimentos_unificado` varria ~47 mil postos a cada consulta (Dashboard/Abastecimentos/Assistente: ~3,6 s → ~0,17 s). Layout do dashboard e página de Abastecimentos agora fazem as leituras independentes em paralelo.
- FEITO (22/11/2026, 2ª rodada): `postos_gf_desvio_anp` 1,9 s → 0,07 s e `postos_gf_alertas_preco` 4,3 s → 0,02 s (resultado pré-calculado na MV `mv_desvio_anp`, atualizada junto com o cache de preços a cada 6 h; as funções agora filtram e checam o acesso do usuário). Dashboard "top clientes": 3,6 s → 0,07 s. Políticas RLS de `profrotas_abastecimentos`, `abastecimentos_internos` e `abastecimentos_pdv` passaram a avaliar `perfil_usuario_atual()`/`empresas_do_usuario()` uma vez por consulta (InitPlan).
- PENDENTE: (a) mais ~230 políticas RLS ainda chamam `perfil_usuario_atual()` solto (reavaliado por linha) — embrulhar em `(select ...)` por tabela, começando pelas maiores; (b) `historico_precos_detalhado` (~1,2 s, devolve 65 mil linhas ao navegador): paginar ou agregar no banco; (c) `cliente_divergencias_preco` (~0,9 s, chama `resolver_empresa_por_cnpj_segmento` por linha); (d) as MVs agora ficam até 6 h defasadas para o desvio ANP (aceitável; se precisar de mais frescor, chamar `atualizar_cache_precos_postos()` após cada carga de preços).

## Assistente FNI: PDF com gráficos e entrada por voz — FEITO em 22/11/2026
- "Baixar conversa em PDF" agora inclui os gráficos (barras, linhas, pizza) e tabelas exibidos na tela, além do texto (títulos, listas, tabelas) e das consultas.
- Microfone ao lado do campo de pergunta (Assistente, card do Dashboard e botão flutuante/Ctrl+K): o usuário digita ou fala (pt-BR, reconhecimento do próprio navegador). O texto falado entra no campo para conferência; não envia sozinho.
- Envio automático da pergunta falada após 3 s de silêncio (parar no botão cancela o envio).
- Pendente: PDF individual por resposta; resposta falada (síntese de voz).
