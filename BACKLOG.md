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
- FEITO (22/11/2026): tela Administração > Limites do Assistente (`/administracao/limites-assistente`) para editar a franquia por plano e a exceção por cliente. Limites atuais (tokens/mês): Gratuito 10 mil, Básico 30 mil, Profissional 150 mil, Enterprise 500 mil, Posto Essencial 30 mil, Posto Profissional 100 mil, Posto Enterprise 500 mil.
- Pendente: mostrar custo estimado em R$.
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

## Desempenho: abertura de telas (22/11/2026, 3ª rodada)
- Achado: o app roda no Railway em Virginia (us-east4) e o Supabase está em São Paulo (sa-east-1) — cada ida ao banco/Auth custa ~130 ms. O Railway não tem região no Brasil. Opções: (a) manter e reduzir idas ao banco (feito abaixo); (b) hospedar o app em São Paulo (outro provedor); (c) migrar o Supabase para us-east (novo projeto + restauração).
- FEITO: middleware usa `getClaims()` (JWT validado localmente) em vez de `getUser()` e guarda 60 s a checagem de empresa suspensa (antes eram ~4 idas seguidas ao banco em TODA navegação); layout não consulta mais `listFactors` (fatores vêm no usuário) e usa `obterUsuarioAtual()` (1 chamada por requisição, também em 18 páginas e `resolverEmpresaAtual`, que agora busca perfil e empresas em paralelo); bolinhas do menu deixaram de bloquear a abertura (carregam logo após a tela aparecer).
- Atenção: o cache de suspensão fica na memória do servidor (hoje 1 réplica no Railway); com mais réplicas cada uma teria o seu (até 60 s de atraso na suspensão).
- Pendente: ~65 páginas ainda chamam `auth.getUser()` direto (cada uma 1 ida ao Auth); `historico_precos_detalhado`, `cliente_divergencias_preco` (ver rodada anterior).
- FEITO (22/11/2026, 4ª rodada): cache em memória de 30–60 s (`src/lib/dadosUsuarioCache.ts`) para perfil, empresas do usuário, vínculos, lista/contagem de empresas e acesso ao Insights de IA — lidos em toda abertura de tela pelo layout e por `resolverEmpresaAtual`. A chave sempre leva o e-mail do usuário autenticado. As telas que alteram usuários/vínculos (minha-equipe, usuarios, convite, cadastro, importação, negociações) chamam `invalidarCacheUsuarios()`.
- Próximo: funções RPC que juntam as consultas do Dashboard/Abastecimentos/Veículos em 1 ida ao banco; cache de avisos e favoritos do menu (hoje 2 idas por layout).
- FEITO (22/11/2026, 5ª rodada): Dashboard dispara o 2º grupo de indicadores junto com o 1º (antes 3 etapas em fila); Abastecimentos busca ajustes abertos em paralelo (só espera antes quando o filtro "ajuste pendente" está ligado); segmento da empresa em cache (30 s); avisos do sino (listarAvisosAcao, ~5 idas por layout) usam o usuário compartilhado e cache de 30 s, limpo ao marcar como lido e ao publicar/editar/excluir aviso.
- Próximo: página de Veículos e demais telas mais usadas (mesmo método: achatar etapas em fila); funções RPC únicas só onde ainda restar mais de 2 etapas em fila; favoritos do menu (1 ida por layout, já em paralelo).

## Assistente FNI: cadastro de veículo e motorista — FEITO em 22/11/2026

- **Feito:** o Assistente cadastra, altera, inativa e reativa veículo e motorista (ferramenta `propor_cadastro`), sempre com cartão de confirmação (antes → depois nas alterações). Sem exclusão definitiva: "excluir" vira inativar (mantém o histórico). Confirmação refaz validação, empresa, perfil e permissão (`aba_veiculos`/`aba_motoristas`), duplicidade e grava com a sessão do usuário (RLS), com log de auditoria (`assistente_fni`). O canal do app do motorista (`/api/assistente`) ficou somente leitura (`semAcoes`). 12 testes novos em `cadastroAssistente.test.ts`.
- **Pendente:** centro de custo, FIPE e demais campos do formulário completo (só os principais entram pelo Assistente); veículo de empresa irmã do grupo; cadastro em lote por planilha pelo chat; teste de ponta a ponta no navegador com cada perfil (gestor, analista, posto).

## Auditoria e sincronização ProFrotas (22/11/2026)

- **Feito:** `fn_audit_log` ignora UPDATE sem mudança e grava só os campos alterados; trigger `aaa_suprime_update_sem_mudanca` descarta UPDATE sem mudança em `profrotas_abastecimentos` (a sync horária reescrevia a janela inteira); 111 mil linhas idênticas removidas de `audit_logs`.
- **Pendente:** `VACUUM FULL audit_logs` fora do horário de uso (devolve cerca de 360 MB ao disco); política de retenção da auditoria (ex.: 90 dias quentes + arquivo); a sync ainda envia toda a janela de datas (poderia pedir só o que mudou desde `dataAtualizacao`).

## Atualização automática da tela após ações (22/11/2026)

- **Feito:** `AtualizarTelaAposAcao` (no layout do painel) recarrega os dados da tela atual depois de qualquer Server Action concluída com sucesso, sem F5. Preserva o estado local; junta ações seguidas; ignora `/assistente`, redirecionamentos e aba oculta.
- **Pendente:** não reproduzi a causa original só pela leitura do código (as ações já chamam `revalidatePath` e os dados do servidor são atuais); validar no navegador com inativar veículo, inativar motorista e seletores de Parâmetros de uso. Se ainda falhar, olhar o cache do roteador do cliente. ~~`alternarAtivoVeiculo` e `alternarAtivoMotorista` ignoravam o erro do UPDATE~~ — FEITO em 22/11/2026: agora devolvem `{ erro }` (inclusive quando a RLS barra sem erro, 0 linhas) e os botões mostram a mensagem em vermelho; o log de auditoria só grava em caso de sucesso. **Pendente:** o mesmo aviso nos demais botões de ativar/inativar (vínculos e regras de Parâmetros de uso, colegas da equipe, avisos, conteúdos).


## Rendimento km/L com correção estatística (KMV-315, 28/11/2026)
- Feito: RPC `indicador_rendimento_corrigido` (hodômetro válido → faixa plausível por categoria → mediana ± max(3×MAD, 35%)), tabela editável `rendimento_regras` (leve 3–25, pesada 1,2–7), selo de confiança por veículo no painel 8 do Dashboard. Calibração real: leve 13,30 → 10,58 km/L; pesada 4,24 → 2,98 km/L.
- Achado: ~97% dos abastecimentos dos últimos 90 dias estão SEM hodômetro → maioria dos veículos "dados insuficientes". Ação: incentivar hodômetro (OCR do app do motorista) e integrações.
- Pendente: validar faixas/tolerâncias com a Eni e Dados; regra por veículo (mediana própria) quando houver ≥5 intervalos; mesma correção nos relatórios e no Assistente; R$/km corrigido no painel; versão para os PWAs.

## Preço pago vs. referência ANP (KMV-315, 28/11/2026)
- Feito: RPC `cliente_saving_anp` (ref. ANP da semana do abastecimento: município → estado → Brasil) e painel 10 no Dashboard (mês selecionado, por combustível e 6 meses). Positivo = economia; negativo = acima da ANP.
- Achado: dados atuais dão ~2-3% ACIMA da ANP (só temos preço de bomba; sem desconto/preço líquido). Por isso o painel NÃO se chama "Economia gerada".
- Pendente: preço líquido/desconto (Ipiranga/Dynamics) para o "Saving na veia"; usar preço acordado das negociações ativas quando existir; Mix de combustíveis; Não autorizadas por motivo.

## Mix de combustíveis (KMV-315, 28/11/2026)
- Feito: RPC `cliente_mix_combustiveis` e painel 11 no Dashboard (mês selecionado). Participação (%) por produto dentro de Frota pesada (diesel) e Frota leve (gasolina/etanol), separadas. GNV e Arla ficam à parte, sem somar no volume das categorias.
- Pendente: comparar com o mês anterior (variação em p.p.); aplicar no PWA do Cliente.
