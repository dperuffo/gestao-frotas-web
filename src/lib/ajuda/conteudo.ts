export type ItemAjuda = { titulo: string; texto: string };

// Fase 24 — Assistente de Onboarding. Cada entrada é referenciada por uma
// chave (ex.: "dashboard.custo_total") a partir de <AjudaIcon chave="..."/>
// espalhado pelas telas — centralizar aqui em vez de escrever o texto direto
// na JSX de cada página deixa mais fácil manter/revisar tudo de uma vez, e
// permite reusar o mesmo texto em mais de um lugar (ex.: "custo por km"
// aparece no Dashboard e no Financeiro com a mesma explicação).
//
// Convenção de chave: "<tela>.<indicador_ou_painel>" em minúsculo/snake_case
// (mesmo nome usado nas colunas/RPCs sempre que possível, pra achar rápido).
export const AJUDA: Record<string, ItemAjuda> = {
  // ── Privacidade / LGPD ────────────────────────────────────────────
  "lgpd.pagina": {
    titulo: "Privacidade e LGPD",
    texto: "Seus dados cadastrais, histórico de consentimento e os mecanismos de revogação de consentimento e solicitação de exclusão de dados previstos na Lei Geral de Proteção de Dados.",
  },
  // ── Dashboard ──────────────────────────────────────────────────────
  "dashboard.clientes_ativos": {
    titulo: "Clientes ativos",
    texto: "Sempre em nível de rede (todos os clientes FNI), independente do cliente selecionado no seletor do topo — mostra quantos clientes estão com assinatura ativa hoje.",
  },
  "dashboard.motoristas_veiculos_ativos": {
    titulo: "Motoristas / Veículos ativos",
    texto: "Contagem de cadastros com status \"Ativo\", filtrada pelo cliente selecionado no seletor do topo (ou de toda a rede, se nenhum cliente estiver selecionado).",
  },
  "dashboard.litros_mes": {
    titulo: "Litros no mês",
    texto: "Soma dos litros abastecidos desde o dia 1º do mês atual até hoje, para o cliente selecionado.",
  },
  "dashboard.valor_mes": {
    titulo: "Valor no mês",
    texto: "Soma do valor pago em abastecimentos desde o dia 1º do mês atual até hoje, para o cliente selecionado.",
  },
  "dashboard.custo_medio_litro": {
    titulo: "Custo médio/litro",
    texto: "Valor total abastecido no mês dividido pelos litros totais do mês — a média ponderada do preço pago, não a média simples dos preços por abastecimento.",
  },
  "dashboard.consumo_grafico": {
    titulo: "Consumo e gasto — últimos 6 meses",
    texto: "Litros abastecidos e valor gasto, mês a mês, para o cliente selecionado — ajuda a ver tendência de alta ou queda no consumo da frota.",
  },
  "dashboard.cnh_vencendo": {
    titulo: "CNH vencendo em 30 dias",
    texto: "Motoristas ativos cuja CNH vence nos próximos 30 dias a partir de hoje, ordenados pela data mais próxima de vencer.",
  },
  "dashboard.top_clientes": {
    titulo: "Top 5 clientes por gasto",
    texto: "Sempre em nível de rede (compara todos os clientes entre si, mesmo com um cliente selecionado no seletor do topo) — os 5 que mais gastaram com combustível nos últimos 6 meses.",
  },
  "dashboard.centro_custo": {
    titulo: "Desempenho por centro de custo",
    texto: "Combustível e manutenção agrupados por centro de custo, no cliente e mês selecionados no topo — usa o histórico de qual veículo esteve em qual centro, não só a alocação atual. \"Custo total/km\" e \"Consumo médio\" só aparecem quando há km suficiente registrado.",
  },
  "dashboard.manutencao_preditiva": {
    titulo: "Manutenção preditiva",
    texto: "Resumo do estado dos itens de manutenção (óleo, filtros, pneus etc.) da frota do cliente selecionado. Crítico = já passou do km/data previsto; Em alerta = perto do limite. Score médio é a nota geral de saúde da frota (0 a 100).",
  },
  "dashboard.eficiencia_veiculos": {
    titulo: "Eficiência real por veículo",
    texto: "Km rodado e km/L calculados a partir de hodômetros consecutivos reais dos abastecimentos (não de rota planejada) — mede a eficiência de fato observada em cada veículo no período.",
  },
  "dashboard.variacao_precos": {
    titulo: "Variação de Preços",
    texto: "Compara o preço médio pago pela sua frota em cada combustível com a referência ANP (município → estado → Brasil, o mais específico disponível). Barra positiva = você pagou acima da referência ANP; negativa = abaixo.",
  },
  "dashboard.consumo_diario": {
    titulo: "Previsão de Consumo Diário",
    texto: "Projeta o consumo (litros/dia) dos próximos dias com base na média móvel dos últimos dias com abastecimento — ajuda a antecipar a necessidade de reabastecer o caixa/orçamento de combustível.",
  },
  "dashboard.evolucao_preco_medio": {
    titulo: "Evolução do Preço Médio",
    texto: "Preço médio por litro pago pela frota, mês a mês, por tipo de combustível — ajuda a enxergar tendência de alta/queda ao longo do tempo.",
  },
  "dashboard.volume_postos": {
    titulo: "Volume por Posto",
    texto: "Quantos litros a frota abasteceu em cada posto no período — mostra onde está concentrado o gasto com combustível.",
  },
  "dashboard.ranking_top5": {
    titulo: "Ranking Top 5 Postos",
    texto: "Os 5 postos com maior volume abastecido pela frota no período, ordenados do maior para o menor.",
  },
  "dashboard.ranking_veiculos": {
    titulo: "Ranking de Veículos",
    texto: "Veículos ordenados por custo total (ou por consumo, conforme a métrica escolhida) no período — ajuda a identificar os veículos mais caros de operar.",
  },
  "dashboard.ranking_motoristas": {
    titulo: "Ranking de Motoristas",
    texto: "Motoristas ordenados por consumo médio (km/l) dos veículos que dirigiram no período — cuidado: reflete o veículo usado também, não só o estilo de condução.",
  },
  // ── Financeiro ─────────────────────────────────────────────────────
  "financeiro.custo_total": {
    titulo: "Custo total do mês",
    texto: "Combustível + manutenção + custos fixos lançados no mês vigente, para o cliente selecionado.",
  },
  "financeiro.custo_por_km": {
    titulo: "Custo por km",
    texto: "Custo total do mês dividido pelos km rodados no mesmo mês. Fica em branco (—) se não houver km suficiente para calcular.",
  },
  "financeiro.orcamento_planejado": {
    titulo: "Orçamento planejado",
    texto: "Soma de todos os orçamentos lançados para o mês vigente (geral + por categoria + por centro de custo), na aba \"Planejar orçamento\" abaixo.",
  },
  "financeiro.saldo_orcamento": {
    titulo: "Saldo do orçamento",
    texto: "Orçamento planejado menos o custo total realizado no mês. Negativo (vermelho) significa que já se gastou mais do que o planejado.",
  },
  "financeiro.combustivel": {
    titulo: "Combustível",
    texto: "Total gasto com abastecimentos no mês vigente (mesmo valor rastreado desde os lançamentos de Abastecimentos).",
  },
  "financeiro.manutencao": {
    titulo: "Manutenção",
    texto: "Total gasto com manutenções realizadas registradas no mês vigente (módulo Manutenção Preditiva).",
  },
  "financeiro.custos_fixos": {
    titulo: "Custos fixos",
    texto: "Seguro, IPVA, licenciamento, rastreamento, multas e outros custos fixos lançados manualmente ou recebidos via integração (API) no mês vigente.",
  },
  "financeiro.evolucao_mensal": {
    titulo: "Evolução mensal",
    texto: "Combustível, manutenção e custos fixos dos últimos 6 meses, lado a lado — ajuda a ver se o gasto está subindo ou caindo mês a mês.",
  },
  "financeiro.orcamento_por_categoria": {
    titulo: "Orçamento do mês por categoria",
    texto: "Cada linha é um orçamento planejado (geral, ou de combustível/manutenção/custos fixos), podendo ser da frota inteira ou de um centro de custo específico. \"Realizado\" usa o gasto real daquele centro de custo (ou da empresa toda, se o orçamento for \"Frota inteira\"). Só é possível editar/excluir linhas do mês vigente.",
  },
  "financeiro.custos_fixos_lancados": {
    titulo: "Últimos custos fixos lançados",
    texto: "Histórico dos custos fixos mais recentes, manuais ou recebidos por integração (coluna Origem). Só é possível editar/excluir lançamentos cuja competência seja o mês vigente — meses fechados ficam só leitura.",
  },

  // ── Centros de Custo ───────────────────────────────────────────────
  "centros_custo.indicadores": {
    titulo: "Indicadores por Centro de Custo",
    texto: "Combustível, manutenção e custo total de cada centro de custo no período — usa o histórico de qual veículo esteve em qual centro, então mesmo que um veículo tenha trocado de centro no meio do período, o custo é dividido corretamente entre os dois.",
  },
  "centros_custo.veiculos_alocados": {
    titulo: "Veículos alocados",
    texto: "Veículos vinculados a este centro de custo atualmente. Um veículo pode ter passado por outros centros no passado — o histórico completo é usado nos cálculos de custo, não só a alocação atual.",
  },

  // ── Manutenção Preditiva ───────────────────────────────────────────
  "manutencao.status": {
    titulo: "Status do item de manutenção",
    texto: "Em dia (verde): longe do limite. Atenção (amarelo): perto do limite por km ou por tempo. Vencido (vermelho): já passou do km ou da data prevista pra próxima manutenção.",
  },
  "manutencao.proxima_prevista": {
    titulo: "Próxima manutenção prevista",
    texto: "Calculada a partir da última manutenção registrada + o intervalo configurado pro componente (ex.: troca de óleo a cada 10.000 km ou 6 meses, o que vier primeiro).",
  },

  // ── Postos ─────────────────────────────────────────────────────────
  "postos.rede_cliente": {
    titulo: "Rede do Cliente",
    texto: "Postos que a sua frota já abasteceu (via cadastro manual, planilha ou integração) — é a visão padrão da tela.",
  },
  "postos.universo_anp": {
    titulo: "Universo ANP",
    texto: "Todos os postos cadastrados na base da ANP (Agência Nacional do Petróleo), mesmo que sua frota nunca tenha abastecido lá — útil pra planejar rota ou comparar preço com um posto novo.",
  },
  "postos.minha_frota": {
    titulo: "Inteligência da Minha Frota",
    texto: "Cruza os postos que sua frota usa com o histórico de preço, pra apontar oportunidades: postos mais baratos na mesma região, tendência de preço, etc.",
  },
  "postos.preco_resolvido": {
    titulo: "Preço de referência",
    texto: "Preço próprio da sua rede (Rede do Cliente) tem prioridade; se não houver, usa o preço ANP mais específico disponível: primeiro do município, depois do estado, depois do Brasil.",
  },

  // ── Roteirização ───────────────────────────────────────────────────
  "roteirizacao.score_posto": {
    titulo: "Score do posto (0-100)",
    texto: "Nota calculada combinando preço, desvio da rota, bandeira/confiabilidade e outros fatores configuráveis (perfil de peso) — quanto maior, melhor a recomendação de parar naquele posto.",
  },
  "roteirizacao.comparativo_estrategias": {
    titulo: "Comparativo de Estratégias",
    texto: "Compara diferentes formas de escolher onde abastecer na rota (ex.: sempre o mais barato vs. o de melhor score) e projeta o custo total e a economia esperada de cada uma.",
  },
  "roteirizacao.custo_acumulado": {
    titulo: "Custo acumulado",
    texto: "Soma do gasto com combustível conforme o veículo avança na rota, parada a parada, na estratégia escolhida.",
  },
  "roteirizacao.nivel_tanque": {
    titulo: "Nível do tanque",
    texto: "Simulação de quanto combustível resta no tanque ao longo da rota, considerando o consumo médio do veículo e os abastecimentos planejados. A faixa vermelha marca zona de risco (abaixo de 25%).",
  },
  "roteirizacao.custo_por_posto": {
    titulo: "Custo por Posto de Abastecimento",
    texto: "Quanto seria gasto em cada parada de abastecimento planejada na rota, na estratégia escolhida.",
  },

  // ── Rotograma ──────────────────────────────────────────────────────
  "rotograma.linha_tempo_riscos": {
    titulo: "Linha do tempo de riscos/paradas",
    texto: "Pontos de atenção ao longo da rota (trechos de risco, paradas recomendadas, restrições) na ordem em que o motorista vai encontrá-los.",
  },

  // ── Relatórios ─────────────────────────────────────────────────────
  "relatorios.anomalias": {
    titulo: "Anomalias (outliers)",
    texto: "Abastecimentos com preço muito fora do padrão pra aquele combustível/região, calculado estatisticamente (método IQR — intervalo interquartil). Não significa necessariamente erro, mas vale conferir.",
  },
  "relatorios.performance_posto": {
    titulo: "Performance por Posto",
    texto: "Compara os postos que sua frota usa por preço médio, frequência de uso e volume — ajuda a decidir onde vale mais a pena concentrar os abastecimentos.",
  },
  "relatorios.score_performance": {
    titulo: "Score × Performance",
    texto: "Cruza o score do posto (usado na Roteirização) com o desempenho real observado nos abastecimentos — pra validar se o score está de fato prevendo bons postos.",
  },
  "relatorios.executivo": {
    titulo: "Relatório Executivo",
    texto: "Resumo em PDF com os principais KPIs, economia (savings) e riscos do período — pronto pra compartilhar com a diretoria ou o cliente.",
  },
  "relatorios.personalizados": {
    titulo: "Relatórios Personalizados",
    texto: "Monte seu próprio relatório: escolha a fonte de dados (abastecimentos, manutenções ou custos fixos), as dimensões (linhas) e as métricas (números) que quer ver.",
  },

  // ── Assinatura ─────────────────────────────────────────────────────
  "assinatura.plano_atual": {
    titulo: "Plano atual",
    texto: "O plano contratado hoje. Cada plano tem limites diferentes de usuários e veículos cadastrados — veja em \"Planos disponíveis\" abaixo.",
  },
  "assinatura.saldo_uso": {
    titulo: "Usuários / Veículos",
    texto: "Quanto do limite do seu plano já está em uso. Ao atingir o limite, não é possível cadastrar novos até fazer upgrade de plano.",
  },
  "assinatura.termo_adesao": {
    titulo: "Termo de Adesão",
    texto: "Antes de qualquer assinatura, é preciso aceitar eletronicamente o Termo de Adesão à plataforma — um comprovante em PDF é gerado e enviado por e-mail após a confirmação do pagamento.",
  },

  // ── Chamados ───────────────────────────────────────────────────────
  "chamados.status": {
    titulo: "Status do chamado",
    texto: "Aberto: aguardando primeira resposta. Em andamento: nosso time já está tratando. Resolvido: chamado concluído (pode ser reaberto respondendo na thread).",
  },

  // ── Avaliações ─────────────────────────────────────────────────────
  "avaliacoes.nota": {
    titulo: "Nota de avaliação",
    texto: "Nota de 1 a 5 dada pelo cliente sobre a experiência com a plataforma, junto com um comentário opcional.",
  },

  // ── Inteligência de Rede (admin) ──────────────────────────────────
  "inteligencia_rede.visao_geral": {
    titulo: "Visão Geral da Rede",
    texto: "KPIs consolidados de todos os postos da rede FNI (não só de um cliente) — visão de time interno.",
  },
  "inteligencia_rede.saving_acumulado": {
    titulo: "Saving Mensal Acumulado",
    texto: "Quanto a rede de postos GF economizou (ou custou a mais) em relação à referência ANP, acumulado mês a mês.",
  },

  // ── Assistente IA FNI ──────────────────────────────────────────────
  "assistente.pergunta": {
    titulo: "Como funciona",
    texto: "Digite uma pergunta em português sobre os dados da sua frota (ex.: \"qual veículo mais gastou com combustível esse mês?\"). O assistente monta e roda uma consulta segura (somente leitura) no banco pra responder — só enxerga os dados da empresa que você tem acesso.",
  },

  // ── Cadastros (cobertura leve) ────────────────────────────────────
  "veiculos.pagina": {
    titulo: "Veículos",
    texto: "Cadastro da frota com especificações técnicas e centro de custo. Use \"Importar planilha\" pra cadastrar vários veículos de uma vez, em vez de um por um.",
  },
  "motoristas.pagina": {
    titulo: "Motoristas",
    texto: "Cadastro dos motoristas, incluindo CNH e validade — o Dashboard avisa automaticamente quando uma CNH está perto de vencer.",
  },
  "usuarios.pagina": {
    titulo: "Usuários",
    texto: "Pessoas com acesso à plataforma e seu perfil (o que cada perfil pode ver/fazer é definido em Permissões por Perfil, no menu Administração).",
  },
  "clientes.pagina": {
    titulo: "Clientes",
    texto: "Empresas atendidas pela FNI — cada cliente é isolado dos demais (dados de um cliente nunca aparecem pra outro), exceto quando ligados por um Grupo Econômico.",
  },
  "grupo_economico.pagina": {
    titulo: "Grupo Econômico",
    texto: "Liga duas ou mais empresas (clientes) que pertencem ao mesmo grupo, pra que os mesmos usuários possam alternar entre elas sem precisar de um login separado por empresa.",
  },
  // Fase 27.87 — mesma mecânica do Grupo Econômico, só que pro lado dos
  // postos revendedores.
  "rede_postos.pagina": {
    titulo: "Rede de Postos",
    texto: "Liga dois ou mais postos revendedores que pertencem à mesma Rede, pra que os mesmos usuários possam alternar entre eles sem precisar de um login separado por posto.",
  },

  // ── Integrações ────────────────────────────────────────────────────
  "integracoes.chave_api": {
    titulo: "Chave de API",
    texto: "O valor completo da chave só é mostrado uma vez, no momento da criação — depois disso só o hash fica salvo, por segurança. Guarde a chave em local seguro.",
  },
  "integracoes.sync_manual": {
    titulo: "Sincronizar agora",
    texto: "Busca imediatamente os dados mais recentes do sistema integrado (ex.: PróFrotas), sem esperar a sincronização automática agendada.",
  },
};
