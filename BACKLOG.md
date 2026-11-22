# Backlog

Itens levantados em conversas com o Daniel e explicitamente adiados pra
depois (não é lista de ideias — só o que foi decidido fazer, mas ainda não
entrou). Cada item tem contexto suficiente pra retomar sem precisar
reconstruir o raciocínio do zero.

## Assistente FNI: visualização, usabilidade e destaque na aplicação

**Adiado em:** 22/11/2026, pedido do Daniel (com print da tela atual do
Assistente). A segunda parte do pedido veio cortada ("o assistente precisa de
destaque dentro da aplica…") — interpretada como destaque do Assistente dentro
da aplicação; confirmar com o Daniel antes de começar.

**Contexto:** a tela `/assistente` hoje é um chat simples: 13 chips de
sugestão em fila, sem agrupamento, e muito espaço vazio. O Assistente virou o
principal diferencial do produto (responde com gráficos/tabelas, compara
preços numa rota, projeta custo), mas está só como um item do menu lateral.

**Ideias levantadas (a priorizar):**
- Tela: agrupar sugestões por tema (Custos, Rotas e preços, Veículos e
  motoristas, Multas e fretes, Como usar), com ícones e cartões; mostrar
  poucas por vez ("ver mais").
- Tela: renderizar markdown nas respostas (negrito, listas); botão de
  copiar/baixar PDF mais visível; indicar a empresa em uso e permitir
  trocar o cliente ali mesmo (hoje, usuário com várias empresas precisa
  escolher no seletor de outra tela para a ferramenta de rota funcionar).
- Tela: histórico de conversas (hoje some ao atualizar) e botão
  "nova conversa"; fixar um gráfico no Dashboard.
- Destaque na aplicação: campo "Pergunte à FNI…" no topo/Dashboard, botão
  flutuante em todas as telas (abre o chat em painel lateral), e perguntas
  sugeridas conforme a tela em que o usuário está.
- Mobile (PWA do posto): o Flutter ainda não desenha os gráficos que a rota
  `/api/assistente` já devolve em `blocos`.

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
