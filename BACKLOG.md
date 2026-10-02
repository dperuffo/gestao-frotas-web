# Backlog

Itens levantados em conversas com o Daniel e explicitamente adiados pra
depois (não é lista de ideias — só o que foi decidido fazer, mas ainda não
entrou). Cada item tem contexto suficiente pra retomar sem precisar
reconstruir o raciocínio do zero.

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

## Crop manual na tela de captura do hodômetro (PWA Motorista)

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
