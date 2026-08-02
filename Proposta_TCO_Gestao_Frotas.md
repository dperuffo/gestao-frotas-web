# Proposta — Gestão de TCO (Custo Total de Propriedade) de Frotas

**Data:** 29/07/2026 · Baseado no artigo [Fleet TCO Calculator](https://www.fleetio.com/blog/calculating-total-cost-of-ownership-for-fleet) (Fleetio, referência de mercado em fleet management) e no estudo Ernst & Young sobre TCO de frotas de caminhão.

---

## O que é TCO e por que interessa ao FNI

TCO (Total Cost of Ownership) é o custo completo de operar um veículo — não só o que ele "gasta rodando" (combustível, manutenção), mas também quanto ele custou pra comprar, quanto perde de valor com o tempo (depreciação), o custo de capital envolvido e o custo de ficar parado (downtime). É a métrica que decide **quando trocar um veículo** e **se um veículo está dando prejuízo** — hoje o cliente FNI vê custos soltos (combustível aqui, manutenção ali), mas não vê o quadro completo por veículo.

A fórmula de referência (Fleetio, baseada em estudo da E&Y):

```
TCO = Custo de Aquisição + Custos Administrativos/Operacionais + Depreciação + Custo de Downtime
```

Detalhada em componentes anuais:

| Componente | Fórmula |
|---|---|
| Depreciação anual | (Valor de compra − Valor residual) ÷ Anos de posse |
| Custo de capital anual | % custo de capital × [(Valor de compra + Valor residual) ÷ 2] |
| Combustível anual | (Km rodado ÷ Consumo médio) × Preço do combustível |
| Manutenção anual | Soma dos custos de manutenção do período |
| Administrativo anual | Licenciamento, seguro, IPVA, taxas |
| Downtime anual | Horas paradas × Custo-hora de downtime |
| **TCO anual por veículo** | Soma de todos acima |
| **Custo por km** | TCO anual ÷ Km rodado no ano |

A E&Y também mostra que a manutenção cresce de forma não-linear (o maior salto é entre o 1º e o 3º ano — chega a quase 5x) e que frotas maiores conseguem TCO por km menor (economia de escala) — dois insights que valem a pena expor pro cliente como benchmark, não só o número final.

## O que a Gestão de Frotas já tem (e o que falta)

Boa notícia: a maior parte dos dados de entrada **já existe** na plataforma, espalhada em tabelas diferentes. Um módulo de TCO seria principalmente um trabalho de **agregação por veículo**, não de captura de dado novo — o mesmo padrão de query que já usamos no DRE (`dre_frota`), só que agrupado por `placa` em vez de por `empresa_id` inteira.

| Componente do TCO | Fonte já existente | Situação |
|---|---|---|
| Combustível | `abastecimentos_unificado` (litros, preço/litro, valor_total, hodômetro, data) | ✅ Pronto — já filtrável por placa |
| Manutenção | `manutencoes_realizadas` (custo_total, data, itens) | ✅ Pronto — já filtrável por placa |
| Multas | `multas` (valor_original, valor_desconto) — Onda-2, recém-implementado | ✅ Pronto — já por placa |
| Oficinas (orçamentos aceitos) | `contas_pagar` origem `orcamento_oficina` | ✅ Pronto, mas sem `placa` direta (via `solicitacoes_orcamento_oficina`) |
| Seguro / IPVA / Licenciamento | `custos_fixos` (tipo, valor, competência) | ✅ Pronto — a tabela **já tem coluna `placa`** |
| Km rodado / hodômetro | `abastecimentos_unificado.hodometro`, `cadastro_veiculos.hodometro_atual`, RPC `manutencao_preditiva_base` (já calcula km_atual) | ✅ Pronto |
| Valor de mercado atual (proxy de depreciação) | `cadastro_veiculos.valor_fipe` (busca automática por código FIPE) | ✅ Parcial — dá o valor *hoje*, mas não a curva histórica |
| Valor de aquisição / data de compra | — | ❌ Não existe. Precisa de 2 campos novos em `cadastro_veiculos` |
| Custo de capital (financiamento/juros de oportunidade) | — | ❌ Não existe. Precisa de campo (taxa) + fórmula |
| Downtime (horas parado) | — | ❌ Não existe medição direta. Dá pra aproximar via `manutencoes_realizadas` (dias entre início/fim de OS) ou pela severidade em `manutencao_preditiva_base`, mas não é o mesmo que downtime real |

Ou seja: **4 dos 6 blocos do TCO já estão praticamente prontos** (combustível, manutenção, multas/oficinas, custos fixos). Os 2 que faltam — aquisição/depreciação e downtime — precisam de captura de dado novo, mas são pequenos (2-3 campos cada).

## Proposta de escopo

### Fase 1 — TCO básico por veículo (rápida, reaproveita quase tudo)

**Schema (migração aditiva):**
- `cadastro_veiculos`: adicionar `valor_aquisicao numeric`, `data_aquisicao date`, `valor_residual_estimado numeric` (opcional — se vazio, assume 20% do valor de aquisição em 5-6 anos, igual a heurística do artigo).
- Nova RPC `tco_veiculo(p_empresa_id, p_placa, p_data_inicio, p_data_fim)`: mesmo padrão de `dre_frota`, somando combustível + manutenção + multas + custos_fixos (por placa) no período, mais depreciação linear anualizada a partir de `valor_aquisicao`/`valor_fipe`.
- Nova RPC `tco_frota_resumo(p_empresa_id)`: ranking de veículos por custo/km, pra identificar rapidamente os "veículos vilões" (mesmo espírito da tela de Manutenção Preditiva, que já rankeia por score).

**Tela nova `/tco` (web) + equivalente no PWA cliente:**
- Cards por veículo: TCO anual, custo por km, breakdown por categoria (combustível/manutenção/depreciação/fixos/multas) — igual ao "Show annual breakdown" da calculadora da Fleetio.
- Ranking dos veículos com maior custo/km (sinaliza candidatos a substituição).
- Filtro por centro de custo (a tabela `centros_custo` já existe e já linka em `cadastro_veiculos`).
- Se `valor_aquisicao` não estiver preenchido, mostra TCO "operacional" (sem depreciação/capital) com aviso pra completar o cadastro — não trava a tela.

**Viabilidade:** Média-Alta. É essencialmente uma RPC nova + uma tela, reaproveitando 4 tabelas que já existem e já têm RLS pronta. Maior parte do esforço é o cadastro dos 2-3 campos novos por veículo (o cliente vai precisar preencher isso manualmente, não tem fonte automática).

### Fase 2 — Custo de capital e curva de depreciação real

- Campo `taxa_custo_capital` (parâmetro global ou por empresa, com valor padrão sugerido tipo Selic + spread).
- Em vez de depreciação linear simples, usar o histórico de `valor_fipe` (a tabela já grava `mes_referencia` a cada busca) pra montar uma curva real de desvalorização por modelo, em vez de assumir uma reta.
- **Viabilidade:** Média. Depende de já ter histórico de FIPE acumulado o suficiente pra virar curva (hoje a busca é pontual, não uma série temporal disparada por rotina).

### Fase 3 — Downtime

- Opção simples: campo `dias_parado` opcional no registro de manutenção (`manutencoes_realizadas`), preenchido manualmente pelo gestor.
- Opção mais robusta: cruzar com `manutencao_preditiva_base` (veículos em status "crítico" contam como downtime estimado) — mas isso é uma aproximação, não medição real.
- **Viabilidade:** Baixa-Média — é o componente mais "artesanal" de capturar sem telemetria (GPS/rastreador), que o FNI hoje não tem.

## Recomendação

Começar pela **Fase 1** — é o maior ganho com o menor esforço, porque a base de dados (combustível, manutenção, multas, custos fixos) já está toda pronta e validada em produção. As Fases 2 e 3 são refinamentos que dependem de dado que ainda não existe (série histórica de FIPE, downtime real) e podem esperar o cliente já estar usando e pedindo mais profundidade.

Esse módulo também fecha bem com o que acabou de entrar (Multas e Oficinas, Onda-2 do benchmark TicketLog) — ambos já alimentam automaticamente `contas_pagar`, então já estão "prontos" pra entrar na conta de TCO sem trabalho extra.
