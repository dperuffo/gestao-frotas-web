# Proposta — Programa de Fidelidade "Estrada que Cuida" (app do motorista)

Rascunho técnico do MVP. Fases seguintes ficam só como roadmap (seção 7) —
não fazem parte desta entrega.

Decisões já confirmadas com o Daniel (16/07/2026): app novo e dedicado ao
motorista (não é uma aba dentro do PWA de empresa/posto); vínculo
abastecimento↔motorista resolvido por confirmação ativa do motorista (ver
seção 2); MVP é só o núcleo — Pontuação + Níveis + Dashboard; nenhum parceiro
real (marketplace, telemedicina etc.) existe hoje — v1 é carteira de pontos +
catálogo gerido pelo admin, sem integração de pagamento/entrega; pontos são
cumulativos (sem janela de expiração) enquanto o motorista estiver **aderido**
ao programa — precisa existir uma tela de adesão explícita no app (aceite,
não é automático no primeiro login); provedor de OTP escolhido: Twilio Verify
(ver seção 2b); nome do app é o próprio "Estrada que Cuida".

## 1. Por que isso não é um recurso a mais — é uma base nova

Hoje a plataforma tem 2 perfis de login: empresa (frota) e posto. Motorista é
só um **cadastro** feito pela empresa (`motoristas`: nome, CPF, CNH,
telefone), sem usuário, senha ou sessão própria. E o vínculo de um
abastecimento com um motorista é **texto livre** — `motorista_nome` nas
tabelas de abastecimento, sem chave estrangeira pra `motoristas.id`. Ou seja,
hoje um "João Silva" digitado num abastecimento não tem nenhuma garantia de
ser o João Silva cadastrado (nem de ser uma pessoa real, já que muitos
abastecimentos vêm de integrações automáticas com provedores de cartão).

Isso significa que **pontuar por abastecimento com segurança exige duas
coisas novas antes de qualquer pilar do programa**: login do motorista, e um
jeito confiável dele reivindicar "esse abastecimento foi meu".

## 2. Login e vínculo — mecanismo do MVP

**Login:** telefone já existe no cadastro (`motoristas.telefone`) — proposta
é login por código enviado via SMS/WhatsApp (OTP), sem senha (público que
troca de celular com frequência e não costuma gerenciar senha).

### 2b. Provedor de OTP — Twilio, via autenticação nativa do Supabase

Escolhi o **Twilio** como provedor de SMS, mas — correção importante em
relação à 1ª versão desta proposta — em vez de eu construir uma Edge
Function própria pra gerar/validar código, vamos usar o **login por telefone
nativo do Supabase Auth** (`signInWithOtp`/`verifyOTP`, já pronto no SDK
Flutter), configurando o Twilio só como o "carteiro" (provedor de SMS) dentro
do próprio painel do Supabase. Vantagens sobre construir na mão:

- Supabase já cuida de gerar, expirar e limitar tentativas do código —
  bem menos código nosso, bem menos superfície de erro de segurança.
- A sessão que sai disso já é uma sessão de autenticação de verdade
  (`auth.uid()`), então a RLS das tabelas novas usa o **mesmo padrão** já
  usado em todo o resto do banco (`auth.jwt()`/`auth.uid()`), em vez de
  eu inventar um esquema de JWT próprio.
- Menos peças novas pra manter (nada de Edge Function de auth, nada de
  geração de código na mão).

O que muda pro Daniel: em vez de criar chaves de API do Twilio pra mim
integrar via HTTP, ele cria a conta Twilio e cola as credenciais direto no
painel do Supabase (**Authentication → Providers → Phone**), sem elas
passarem por mim ou pelo código da aplicação.

**Vínculo com o cadastro existente:** o motorista já tem um registro em
`motoristas` (criado pela empresa, sem login). No primeiro login por
telefone, o Supabase cria um `auth.users` novo (é assim que o login por
telefone funciona) — preciso then vincular esse novo usuário ao registro
`motoristas` já existente com o mesmo telefone. Isso entra como uma nova
coluna `motoristas.auth_user_id` (nullable, preenchida nesse primeiro
login) + uma tela/passo "confirme seu cadastro" caso o telefone não bata com
nenhum motorista já cadastrado por nenhuma empresa (ex.: pedir CPF pra
localizar o cadastro certo, já que o mesmo número de telefone teoricamente
não deveria repetir entre motoristas diferentes, mas o CPF é a chave mais
confiável).

**Adesão ao programa:** antes de participar (confirmar abastecimentos, ver
saldo), o motorista precisa aderir explicitamente — tela própria no primeiro
acesso ("Quero participar do Estrada que Cuida", aceite de termos). Pontos
são cumulativos, sem expiração por tempo, enquanto o motorista continuar
aderido.

**Vínculo abastecimento↔motorista — mecanismo realista pro MVP:** exigir
identificação em tempo real no bico da bomba (QR code/CPF na hora) depende de
integração com o posto ou com os provedores de cartão (Ticket, Alelo, Repom
etc.) — fora do nosso controle e de implementação bem mais longa. Proposta
pro v1: **confirmação por revisão**, não em tempo real:

1. O motorista já é ligado a um veículo hoje via "Vínculo Motorista ↔
   Veículo" (`parametros_vinculo_motorista_veiculo`, Fase 27.120).
2. O app do motorista mostra os abastecimentos recentes (últimos 15 dias) da
   placa vinculada a ele, ainda não confirmados por ninguém.
3. O motorista confirma "Fui eu" (ou rejeita, se não foi ele) — só aí o
   abastecimento pontua.
4. Trava anti-fraude: 1 abastecimento só pode ser confirmado por 1 motorista;
   depois de confirmado, fica bloqueado pra qualquer outro.

Isso já resolve o problema de segurança básico (não é mais nome digitado por
terceiro, é o próprio motorista afirmando) sem depender de integração nova
com posto/bandeira. QR code em tempo real no bico da bomba fica como
evolução de fase futura (ver seção 7), quando/se fizer sentido negociar com
os postos parceiros.

## 3. Modelo de dados (novo)

| Tabela | Papel |
|---|---|
| `motoristas` (existente) | ganha campos de auth: nada de senha — login via OTP validado contra `telefone` já existente. Precisa de `telefone_verificado_em`. |
| `fidelidade_adesoes` | 1 linha por motorista aderido — `motorista_id`, `aderiu_em`, `versao_termos_aceita`, `status` (ativo/cancelado). Confirmar/ver saldo exige existir uma linha `ativo` aqui — é o gate de tudo. |
| `fidelidade_pontos_ledger` | 1 linha por evento de pontos (ganho ou uso) — `motorista_id`, `tipo_evento` (abastecimento_confirmado, resgate, etc.), `pontos` (+/-), `referencia` (jsonb, ex.: id do abastecimento), `criado_em`. Nunca se edita uma linha — saldo é sempre a SOMA das linhas (auditável, sem "saldo mágico" que pode dessincronizar). |
| `fidelidade_abastecimentos_confirmados` | 1 linha por abastecimento confirmado por um motorista — `abastecimento_referencia` (provedor + id, mesmo padrão de `ajustes_abastecimentos`), `motorista_id`, `confirmado_em`. Índice único em `abastecimento_referencia` — garante que 1 abastecimento só é confirmado 1 vez. |
| `fidelidade_niveis` | catálogo fixo (Bronze/Prata/Ouro/Diamante/Herói da Estrada) com faixa de pontos — começa como constante no código (não muda com frequência), sem precisar virar tabela no v1. |

**Regra de pontuação do MVP:** 1 ponto por R$ 1 abastecido (conforme o
documento do Daniel), creditado no `fidelidade_pontos_ledger` no momento da
confirmação (passo 3 da seção 2) — não no momento do abastecimento em si
(evita pontuar algo que o motorista ainda não confirmou ser dele).

**Nível do motorista:** soma cumulativa de TODO o ledger desde a adesão, sem
expiração por tempo (confirmado com o Daniel) — enquanto `fidelidade_adesoes`
estiver `ativo`. Se o motorista cancelar a adesão e aderir de novo depois, o
tratamento do saldo anterior é uma decisão a tomar quando o caso surgir (não
bloqueia o MVP, já que cancelamento não é fluxo do v1).

## 4. App novo do motorista

Projeto Flutter separado (não é uma 3ª aba do PWA atual) — auth própria (OTP
por telefone), sem o conceito de "empresa selecionada" que o app atual tem.
Telas do MVP:

- **Login** (telefone + código OTP).
- **Adesão** (primeiro acesso, antes de qualquer outra tela): aceite dos
  termos do programa — sem isso, o motorista não confirma abastecimento nem
  vê saldo.
- **Dashboard**: saldo de pontos, nível atual, barra de progresso pro
  próximo nível ("Faltam 2.500 pontos para Ouro"), atalho pros
  abastecimentos pendentes de confirmação.
- **Abastecimentos pendentes**: lista pra confirmar/rejeitar (mecanismo da
  seção 2).
- **Extrato de pontos**: histórico do ledger (ganhos e usos).
- **Meu nível**: os 5 níveis, benefícios de cada um (só como catálogo
  informativo no v1 — sem catálogo de resgate real ainda, já que não há
  parceiros, conforme decidido).

## 5. O que o MVP **não** inclui (fica pra depois, ver seção 7)

- Cashback/dinheiro real — resgatar pontos por dinheiro tem implicação
  financeira/regulatória séria (custódia de valores, possível enquadramento
  como meio de pagamento) — precisa de decisão de negócio e provavelmente
  jurídico antes de qualquer implementação, não é só código.
- Marketplace, telemedicina, farmácia, cursos, conta família, gamificação/
  ranking, Volta Para Casa — todos dependem de parceiros reais que ainda não
  existem (conforme sua resposta).

## 6. Fases sugeridas (MVP)

1. Conta Twilio + configurar como provedor de SMS em Authentication →
   Providers → Phone no painel do Supabase (fora do código — você faz essa
   parte, as credenciais não passam por mim).
2. Coluna `motoristas.auth_user_id` + tabelas `fidelidade_adesoes`,
   `fidelidade_pontos_ledger` e `fidelidade_abastecimentos_confirmados` +
   RLS (motorista só vê o que é dele, via `auth.uid()`).
3. Projeto Flutter novo ("Estrada que Cuida") + telas Login (OTP nativo do
   Supabase) e vínculo com o cadastro existente (telefone → CPF se precisar).
4. Tela de Adesão.
5. Tela "Abastecimentos pendentes" + confirmação.
6. Cálculo de nível (derivado do ledger) + Dashboard.
7. Extrato de pontos.
8. Testes com motoristas do robô de abastecimentos de teste já existente.

## 7. Roadmap depois do MVP (não detalhado agora)

Economia Imediata (cashback/parceiros) → Conta Família → Saúde na Estrada →
Marketplace da Cabine → Universidade da Estrada → Clube do Caminhão →
Gamificação/Ranking → Programa Volte Para Casa. Cada um provavelmente vira
uma proposta própria quando chegar a vez, já que cada um tem decisões de
negócio próprias (parceiros, verba, forma de resgate).
