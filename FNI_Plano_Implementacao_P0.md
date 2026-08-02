# FNI — Plano de Implementação P0: virar um TMS de verdade

**Data:** 22/07/2026 · Sequência ao `FNI_Gap_Analysis_TMS_ERP.md`. Cada fase segue o padrão do projeto (migrations aditivas + Server Actions + RLS por `empresa_id` + registro no README).

**Escopo do P0:** emissão de CT-e e MDF-e, fluxo operacional (coleta → romaneio → viagem → entrega), tabelas de frete com piso ANTT e faturamento de fretes com cobrança real. Estimativa total: **4 a 6 meses** no seu ritmo atual de fases.

---

## Fase P0.0 — Pré-requisito: Hardening de segurança (1-2 semanas)

Antes de guardar certificado digital, dados fiscais e financeiros, feche as 2 pendências já registradas no README:

1. Substituir as policies "permitir tudo" (`USING (true)`) das tabelas de produção por policies por `empresa_id` (padrão `empresas_do_usuario()` que você já usa).
2. Replicar `perfil_usuario_atual() = 'admin'` nas ~27 tabelas que ainda usam o e-mail fixo `d.peruffo@gmail.com` como bypass.

**Conceito para aprender:** RLS é a última linha de defesa — num ERP, um vazamento entre tenants é dado fiscal/bancário de terceiro, com responsabilidade legal (LGPD).

---

## Fase P0.1 — Cadastro fiscal do emitente + integração com API fiscal (2-3 semanas)

O FNI é multi-tenant: quem emite CT-e é **cada cliente transportadora**, com o certificado digital dele. O FNI orquestra.

**Decisão de arquitetura — provedor fiscal:** usar API de emissão em vez de integrar com a SEFAZ direto.

| Provedor | Docs | Observação |
|---|---|---|
| **Focus NFe** (recomendado p/ começar) | CT-e, CT-e OS, MDF-e, NF-e, eventos | API REST simples, homologação gratuita, forte em transporte |
| **PlugNotas / TecnoSpeed** | idem + hub maior | Bom plano B; TecnoSpeed também tem produtos de CIOT/pagamento p/ P1 |
| ~~Nuvem Fiscal~~ | — | ❌ Anunciou desativação em 31/07/2026 — não usar |

*(Confirme preços/condições atuais nos sites antes de fechar — mudam com frequência.)*

**Entregáveis:**

- Migration `empresas_fiscal` (1:1 com `empresas`): IE, RNTRC, regime tributário, série e próxima numeração de CT-e/MDF-e, ambiente (`homologacao`/`producao`), `provedor_ref` (id da empresa no provedor). O certificado A1 (.pfx) é enviado direto ao provedor — **não** armazenar o arquivo no Supabase; guardar só o vencimento para alertar.
- `src/lib/fiscal/provider.ts`: camada fina sobre a API do provedor (criar empresa, emitir, consultar, cancelar, webhook). Interface própria → trocar de provedor depois sem reescrever telas.
- Tela `/fiscal/configuracao` (menu Gestão): dados fiscais, upload do certificado, teste de conexão em homologação.
- Rota `/api/webhooks/fiscal`: recebe callbacks de autorização/rejeição (padrão do seu `webhook_server.py`/`stripe_events`: gravar o evento bruto antes de processar).

**Conceitos:** certificado A1 vs A3 (A1 = arquivo, o único viável em nuvem); ambiente de homologação da SEFAZ (documentos "de mentira" para testar de graça — toda a fase P0.2 roda nele primeiro).

---## Fase P0.2 — Emissão de CT-e (4-6 semanas — o coração do P0)

Hoje `fretes_cte` só recebe upload de XML de terceiros. Vai passar a existir o caminho "FNI emite".

**Entregáveis:**

- Migration em `fretes_cte` (aditiva): `origem` (`upload` | `emitido`), `status` (`rascunho → enviando → autorizado / rejeitado / cancelado`), `motivo_rejeicao`, `tomador_*` (CNPJ/nome/papel: remetente, destinatário, expedidor, recebedor), `cfop`, `natureza_operacao`, `icms_*` (CST, base, alíquota, valor), `chaves_nfe` (array — as NF-e da carga que o CT-e acoberta), `provedor_ref`.
- Nova tabela `cadastros_parceiros`: remetentes/destinatários/tomadores (CNPJ, IE, endereço) — o "cadastro de clientes do cliente", que hoje não existe e o CT-e exige.
- Tela "Emitir CT-e" dentro do frete (`/fretes/[id]`): formulário pré-preenchido com origem/destino/valor do frete + tomador + NF-e da carga → `emitirCteAcao` → provedor → status via webhook. DACTE (PDF) vem do provedor; guardar XML autorizado no Storage (mesmo bucket-padrão do seu `notas-fiscais-xml`).
- Eventos: cancelamento (até 7 dias, antes do MDF-e) e Carta de Correção.
- O caminho de upload continua existindo (frete transportado por terceiro que emitiu o próprio CT-e).

**Conceitos:** CT-e documenta o **serviço de transporte** (frete) e referencia as NF-e da **carga** (mercadoria, emitida pelo embarcador) — essa distinção define o modelo de dados. ICMS do frete varia por UF de início; começar com CST 00 (tributação normal) e o par de UFs mais comum dos seus clientes, expandir depois.

**Critério de aceite:** emitir, cancelar e corrigir CT-e em homologação de ponta a ponta pela tela do frete; rejeição da SEFAZ aparece legível para o usuário (padrão das suas `notas_fiscais_pendencias`).

---

## Fase P0.3 — MDF-e (2-3 semanas)

Sem MDF-e o caminhão circula irregular — multa e retenção de carga. Depende da P0.2.

**Entregáveis:**

- Tabelas novas: `mdfe` (empresa, veículo, motorista(s), UF de carregamento/descarregamento, percurso, status `autorizado → encerrado / cancelado`) e `mdfe_documentos` (chaves dos CT-e/NF-e a bordo).
- Fluxo na tela do frete/viagem: "Iniciar viagem" → gera MDF-e com os CT-e autorizados → DAMDFE para o motorista (o PWA Flutter já é o canal natural).
- **Encerramento** ao chegar (botão manual agora; automático por geofence quando a telemetria chegar no P1). Alerta de MDF-e aberto há mais de X dias.
- Condutor adicional, inclusão de DF-e em trânsito (carga fracionada embarca mais CT-e no caminho).

**Conceito:** 1 viagem = 1 MDF-e por veículo, agrupando N CT-e. É o elo entre o fiscal (P0.2) e o operacional (P0.4).

---

## Fase P0.4 — Fluxo operacional: coleta → romaneio → entrega (4-5 semanas)

Transforma o marketplace de fretes num fluxo de transportadora. Reaproveita muito do que existe: `fretes` já tem endereços de coleta/entrega, dimensões de carga, `fretes_eventos` (timeline) e o app Flutter do motorista.

**Entregáveis:**

- `fretes_nfe` (romaneio): NF-e do embarcador vinculadas ao frete — upload do XML (reusar o parser `src/lib/nfe.ts`, que já existe!) ou digitação da chave. Peso/volume/valor somados viram o "manifesto de carga" do frete e alimentam o CT-e (P0.2) e o MDF-e (P0.3).
- `fretes_ocorrencias`: tabela padronizada (código + descrição + foto + geoloc + timestamp) — atraso, avaria, recusa, reentrega, devolução. Registráveis pelo motorista (PWA) e pelo gestor. Aproveitar o padrão visual de `fretes_eventos`.
- **Canhoto digital (POD)**: `fretes_entregas` — foto do canhoto, assinatura na tela (canvas), nome/documento do recebedor, geoloc e hora. No PWA do motorista, botão "Confirmar entrega". Comprovante em PDF baixável pelo gestor (padrão do seu `NotaFiscalPdf`).
- Máquina de estados da viagem: `aguardando_coleta → coletado → em_transito → entregue / com_ocorrencia`, dirigida pelos eventos do motorista, refletida na timeline.

**Critério de aceite:** um frete nasce da cotação (P0.5), recebe NF-e do embarcador, emite CT-e, abre MDF-e, e termina com canhoto digital anexado — tudo auditável na timeline.

---

## Fase P0.5 — Tabelas de frete, cotação e piso ANTT (3-4 semanas)

Pode rodar em paralelo com P0.2-P0.4 (não depende do fiscal).

**Entregáveis:**

- `tabelas_frete` + `tabelas_frete_faixas`: por cliente-tomador ou geral; rota (UF/cidade origem→destino) × faixa de peso; componentes: frete-peso, **ad valorem** (% do valor da NF), **GRIS** (% risco), TDE/TDA, taxa de despacho, pedágio, ICMS "por dentro".
- `src/lib/freteCalculo.ts`: motor de cálculo puro (entrada: rota, peso, valor da carga, tabela → saída: composição item a item). Funções puras = fáceis de testar unitariamente.
- **Piso mínimo ANTT** (Res. 5.867/2020): tabela `pisos_antt` (nº de eixos × distância × tipo de carga), importável via XLSX (seu padrão) a cada atualização da ANTT. O simulador exibe o piso e **alerta** quando o frete proposto fica abaixo — proteção legal para o seu cliente.
- Tela `/cotacoes`: simula → salva → converte em frete com um clique (pré-preenche `fretes` e o `plano_viagem` — margem = receita tabelada − custo estimado que o `planos_viagem` já calcula. Aqui o FNI fecha um ciclo que pouco TMS tem.)

---

## Fase P0.6 — Faturamento de fretes + contas a receber com cobrança real (3-4 semanas)

Estende o motor de faturas que você já tem (`faturas_postos`, numeração, ciclos) para o mundo dos fretes.

**Entregáveis:**

- `faturas_fretes` + `faturas_fretes_itens`: agrupa CT-es autorizados por tomador e período (espelhando o padrão de `faturas_postos`).
- `contas_receber` genérico: origem (`fatura_frete`, `fatura_posto`, `avulso`), parcelas, vencimento, juros/multa, baixa parcial. As faturas existentes passam a gerar títulos aqui — primeiro passo do ERP financeiro (P1 estende para `contas_pagar`).
- **Cobrança real**: integração com um gateway (Asaas, Cora, ou API do banco do cliente) para **boleto registrado e PIX dinâmico** com conciliação automática via webhook (pagou → baixa o título). O seu `pix.ts` (QR estático) vira fallback para quem não conectar gateway.
- Painel `/financeiro` ampliado: aging de recebíveis (a vencer, vencido 30/60/90), inadimplência por cliente.

**Conceito:** boleto *registrado* entra no sistema do banco e permite conciliação automática — o retorno via webhook do gateway substitui o CNAB tradicional e é o caminho moderno (CNAB fica para P1, se algum cliente exigir banco específico).

---

## Ordem e paralelismo

```
P0.0 Hardening ──► P0.1 Fiscal base ──► P0.2 CT-e ──► P0.3 MDF-e ──► P0.6 Faturamento
                          │
                          └──(paralelo)── P0.5 Tabelas/Cotação ──► P0.4 Operacional
```

- **Trilha fiscal** (P0.1→P0.2→P0.3): sequencial, é a espinha dorsal.
- **P0.5** não depende de nada fiscal — bom para intercalar enquanto espera homologação/certificado.
- **P0.4** ganha valor total depois do CT-e, mas o romaneio (`fretes_nfe`) pode nascer antes, pois o CT-e vai precisar dele.

## O que você vai precisar providenciar (fora do código)

1. **Certificado digital A1** de um CNPJ para testes em homologação (pode ser o da sua própria empresa).
2. Conta no provedor fiscal (Focus NFe tem sandbox gratuito) e num gateway de cobrança (Asaas tem sandbox).
3. Um cliente-piloto transportadora disposto a rodar a homologação junto — as regras reais de ICMS/CFOP dele vão calibrar a P0.2 (mesmo padrão "achado real" que você já usa com NF-e).
4. Conversa com o contador do piloto sobre série/numeração de CT-e e regime tributário.

## Riscos principais

- **ICMS interestadual do frete** é a parte mais traiçoeira do CT-e — comece restrito às UFs do piloto; rejeições da SEFAZ são o "teste real".
- **Dependência do provedor fiscal**: o caso Nuvem Fiscal (desativação anunciada para 31/07/2026) mostra que a camada `provider.ts` isolando o fornecedor não é luxo, é seguro de vida.
- **Escopo do P0.4**: canhoto digital no PWA envolve câmera/assinatura offline — se apertar, corte para "foto do canhoto" na v1 e assinatura na v2.

---

*Fontes da pesquisa de provedores: [Focus NFe — API CT-e](https://focusnfe.com.br/produtos/conhecimento-transporte-eletronico-cte/), [PlugNotas](https://plugnotas.com.br/), [Nuvem Fiscal](https://www.nuvemfiscal.com.br/), [comparativo Notaas 2026](https://www.notaas.com.br/blog/post/melhor-api-nfse-desenvolvedores-brasil-plugnotas-tecnospeed-enotas-nuvem-fiscal-focus-nfe-comparativo-2025-2026).*
