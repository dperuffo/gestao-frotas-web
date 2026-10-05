// Catálogo de funcionalidades da matriz de /permissoes (05/10/2026, pedido do
// Daniel: "cada funcionalidade deveria ter uma descrição detalhada para o
// usuário compreender o que está permitindo aos níveis inferiores"). Só texto de
// apresentação — não muda nenhuma regra. Chave = nome gravado em
// permissoes_perfil.funcionalidade. Funcionalidade sem entrada aqui cai no
// rótulo humanizado antigo (ver formatarFuncionalidade em permissoes/page.tsx).

export type GrupoPermissao =
  | "Visão geral"
  | "Cadastros"
  | "Abastecimento"
  | "PDV FNI"
  | "Fretes e transporte"
  | "Manutenção e ativos"
  | "Financeiro e fiscal"
  | "Inteligência e relatórios"
  | "Fidelidade e engajamento"
  | "Postos e rede"
  | "Equipe, conta e segurança"
  | "Funções gerais"
  | "Administração (time interno)";

export type ItemCatalogo = {
  nome: string;
  grupo: GrupoPermissao;
  // O que o nível inferior poderá ver e fazer se você ligar o interruptor.
  descricao: string;
  // Marca funcionalidades que mexem com dinheiro, dados pessoais, acessos ou
  // configuração — pede atenção extra antes de liberar.
  sensivel?: boolean;
};

export const ORDEM_GRUPOS: GrupoPermissao[] = [
  "Visão geral",
  "Cadastros",
  "Abastecimento",
  "PDV FNI",
  "Fretes e transporte",
  "Manutenção e ativos",
  "Financeiro e fiscal",
  "Inteligência e relatórios",
  "Fidelidade e engajamento",
  "Postos e rede",
  "Equipe, conta e segurança",
  "Funções gerais",
  "Administração (time interno)",
];

export const CATALOGO_PERMISSOES: Record<string, ItemCatalogo> = {
  // ───────────── Visão geral
  aba_dashboard: {
    nome: "Dashboard",
    grupo: "Visão geral",
    descricao:
      "Tela inicial com os indicadores da operação: gasto com combustível, abastecimentos, consumo e alertas. É só leitura, mas mostra valores e resultados da empresa.",
  },
  aba_assistente_ia: {
    nome: "Assistente FNI (IA)",
    grupo: "Visão geral",
    descricao:
      "Chat com inteligência artificial que responde perguntas sobre os dados da empresa (por exemplo, \"qual veículo gastou mais este mês?\"). Quem tem acesso consegue consultar qualquer dado que o assistente enxergue.",
  },
  aba_insights_ia: {
    nome: "Insights de IA",
    grupo: "Visão geral",
    descricao:
      "Painel em que a IA aponta sozinha o que está fora do padrão (consumo, atrasos, riscos) e sugere o que olhar. Disponível apenas em planos que incluem o recurso.",
  },
  aba_frotas: {
    nome: "Frotas",
    grupo: "Visão geral",
    descricao: "Visão agrupada dos veículos por frota. Permite consultar e navegar pelas frotas da empresa.",
  },

  // ───────────── Cadastros
  aba_veiculos: {
    nome: "Veículos",
    grupo: "Cadastros",
    descricao:
      "Cadastro da frota: placa, modelo, tanque, vínculo com motorista e documentos. Quem tem acesso pode consultar e também criar, editar e inativar veículos, inclusive importar por planilha.",
  },
  aba_motoristas: {
    nome: "Motoristas",
    grupo: "Cadastros",
    descricao:
      "Cadastro de motoristas com CPF, CNH, ASO e exame toxicológico. Contém dados pessoais: quem tem acesso vê e pode alterar essas informações e bloquear ou liberar motoristas.",
    sensivel: true,
  },
  aba_cadastros_pendentes: {
    nome: "Cadastros pendentes",
    grupo: "Cadastros",
    descricao:
      "Fila de veículos e motoristas cadastrados por outros canais (app do motorista, integrações) que aguardam aprovação. Permite aprovar ou recusar, o que decide o que entra oficialmente na frota.",
  },
  aba_centros_custo: {
    nome: "Centros de custo",
    grupo: "Cadastros",
    descricao:
      "Cadastro dos centros de custo usados para ratear despesas por área ou contrato. Permite criar e editar, alterando como os gastos são classificados.",
  },
  aba_clientes: {
    nome: "Clientes",
    grupo: "Cadastros",
    descricao: "Cadastro de clientes da transportadora, usado nos fretes e no faturamento. Inclui dados de contato e documentos.",
  },
  aba_grupo_economico: {
    nome: "Grupo econômico",
    grupo: "Cadastros",
    descricao:
      "Gestão das empresas que fazem parte do mesmo grupo (matriz e filiais). Permite ver e administrar o vínculo entre elas, com reflexo em assinatura e compartilhamento de cadastros.",
    sensivel: true,
  },
  aba_motoristas_parceiros: {
    nome: "Motoristas parceiros",
    grupo: "Cadastros",
    descricao:
      "Base de motoristas terceiros/agregados parceiros, com histórico e reputação. Permite consultar e gerenciar esses contatos para contratação de fretes.",
  },
  aba_oficinas: {
    nome: "Rede de oficinas",
    grupo: "Cadastros",
    descricao: "Lista de oficinas credenciadas e histórico de serviços por veículo. Permite consultar e registrar manutenção nelas.",
  },
  aba_postos: {
    nome: "Postos",
    grupo: "Cadastros",
    descricao:
      "Cadastro e consulta de postos de combustível (revendedores e postos internos): localização, preços e bandeira. Permite cadastrar e editar postos usados pela frota.",
  },
  aba_parametros_uso: {
    nome: "Parâmetros de uso",
    grupo: "Abastecimento",
    descricao:
      "Regras que a empresa impõe aos abastecimentos: limites de litros e valor, intervalos, horários, restrição de postos e Pré-Pedido. Mudar isso altera o que o PDV libera ou nega para os motoristas.",
    sensivel: true,
  },
  aba_parametros_nf: {
    nome: "Parâmetros de nota fiscal",
    grupo: "Financeiro e fiscal",
    descricao:
      "Define como a nota fiscal dos abastecimentos deve ser emitida (obrigatoriedade, dados do destinatário, prazos). Alterar muda a orientação mostrada ao posto no PDV.",
    sensivel: true,
  },

  // ───────────── Abastecimento
  aba_abastecimentos: {
    nome: "Abastecimentos",
    grupo: "Abastecimento",
    descricao:
      "Lista de todos os abastecimentos, de todos os canais, com filtros, importação por planilha e lançamentos manuais. Mostra valores, motoristas e postos.",
  },
  aba_abastecimentos_negados: {
    nome: "Abastecimentos negados (PDV)",
    grupo: "Abastecimento",
    descricao:
      "Abastecimentos feitos no PDV que quebraram alguma regra da empresa e aguardam decisão. Quem tem acesso pode LIBERAR ou recusar, e o motorista e o posto ficam esperando a resposta.",
    sensivel: true,
  },
  aba_abastecimentos_sem_motorista: {
    nome: "Abastecimentos sem motorista",
    grupo: "Abastecimento",
    descricao:
      "Fila de abastecimentos que chegaram sem identificar o motorista. Permite vincular o motorista correto, o que passa a valer nos relatórios, pontos de fidelidade e consumo.",
  },
  aba_ajustes_pdv: {
    nome: "Pedidos de ajuste (PDV)",
    grupo: "Abastecimento",
    descricao:
      "Correções de abastecimentos do PDV pedidas pelo posto ou pela empresa. Quem tem acesso pode pedir ajuste e APROVAR ou recusar o que a outra parte pediu; ao aprovar, o abastecimento e os pontos do motorista são corrigidos.",
    sensivel: true,
  },
  aba_ajustes_abastecimentos: {
    nome: "Ajustes de abastecimentos",
    grupo: "Abastecimento",
    descricao:
      "Ajustes de data, hodômetro e itens de abastecimentos de integração, negociados entre posto e cliente em rodadas até o acordo.",
  },
  aba_notas_fiscais: {
    nome: "Notas fiscais",
    grupo: "Financeiro e fiscal",
    descricao:
      "Notas fiscais dos abastecimentos: conferência entre posto e cliente, divergências e status de conclusão. Permite acompanhar e marcar a conclusão.",
  },
  aba_anomalias: {
    nome: "Ações sugeridas",
    grupo: "Abastecimento",
    descricao:
      "Alertas automáticos (CNH vencida, posto caro, hodômetro fora do padrão, abastecimento sem Pré-Pedido etc.) com botão para executar a ação sugerida, como bloquear um motorista ou limitar um veículo. Executar muda cadastros e regras.",
    sensivel: true,
  },
  aba_antifraude: {
    nome: "Antifraude",
    grupo: "Abastecimento",
    descricao:
      "Regras e ocorrências de suspeita de fraude em abastecimentos e rotas. Permite ver e tratar os alertas e ajustar as regras de detecção.",
    sensivel: true,
  },
  aba_pre_pedidos: {
    nome: "Pré-Pedidos",
    grupo: "Abastecimento",
    descricao:
      "Consulta de Pré-Pedidos: abastecimentos previamente autorizados com posto e limite de litros ou valor. O posto confere aqui o pedido do motorista; a frota acompanha o que foi criado.",
  },
  aba_jornada_motoristas: {
    nome: "Jornada dos motoristas",
    grupo: "Abastecimento",
    descricao:
      "Controle de tempo de direção e descanso dos motoristas, com alertas de jornada excessiva. Mostra dados individuais de cada motorista.",
  },
  aba_precos_postos: {
    nome: "Preços dos postos parceiros",
    grupo: "Postos e rede",
    descricao:
      "Tabela de preços praticados pelos postos parceiros. Quem tem acesso consulta e, no lado do posto, pode atualizar os preços informados.",
  },
  aba_conferencia_precos: {
    nome: "Conferência de preços",
    grupo: "Abastecimento",
    descricao:
      "Compara o preço pago em cada abastecimento com o preço combinado e com a tabela da ANP, apontando diferenças. Serve para contestar cobrança acima do acordado.",
  },
  aba_combustivel_ideal: {
    nome: "Combustível ideal",
    grupo: "Inteligência e relatórios",
    descricao:
      "Simulador que compara etanol e gasolina (ou diesel) por custo por quilômetro. Apenas consulta, sem alterar dados.",
  },
  aba_pegada_carbono: {
    nome: "Pegada de carbono",
    grupo: "Inteligência e relatórios",
    descricao: "Estimativa das emissões de CO2 da frota a partir do consumo. Relatório de leitura.",
  },

  // ───────────── PDV FNI
  aba_pdv_formas_pagamento: {
    nome: "Formas de pagamento aceitas no PDV",
    grupo: "PDV FNI",
    descricao:
      "Define quais meios de pagamento (dinheiro, cartão, PIX, voucher etc.) o PDV pode cobrar dos motoristas da empresa. Mudar altera o que o posto consegue aceitar.",
    sensivel: true,
  },
  aba_pdv_pre_pedido: {
    nome: "PDV: Pré-Pedido",
    grupo: "PDV FNI",
    descricao:
      "No caixa, digitar o OTP do motorista para liberar o abastecimento dentro do limite do Pré-Pedido. É a tela de entrada do motorista com Pré-Pedido; sem ela o operador não consegue atender esses motoristas.",
  },
  aba_pdv_resgates: {
    nome: "PDV: Resgate de pontos",
    grupo: "PDV FNI",
    descricao:
      "No caixa, validar e baixar os vouchers de fidelidade dos motoristas. Ao baixar, o valor passa a ser devido ao posto e o voucher não pode mais ser usado.",
    sensivel: true,
  },
  aba_pdv_extrato: {
    nome: "PDV: Extrato e pedido de ajuste",
    grupo: "PDV FNI",
    descricao:
      "Histórico dos abastecimentos feitos no PDV, com valores, motoristas e itens. Permite abrir um pedido de ajuste de abastecimento já confirmado.",
  },
  aba_pdv_dashboard: {
    nome: "PDV: Dashboard e caixa",
    grupo: "PDV FNI",
    descricao:
      "Fechamento de caixa por turno: volume vendido, valores e formas de pagamento, com filtros por cliente e placa. Mostra o faturamento do posto.",
    sensivel: true,
  },
  aba_pdv_produtos: {
    nome: "PDV: Produtos e serviços",
    grupo: "PDV FNI",
    descricao:
      "Catálogo de itens vendidos junto com o abastecimento (Arla, aditivos, lavagem etc.). Permite criar, editar preços e desativar itens.",
    sensivel: true,
  },
  aba_pdv_terminais: {
    nome: "PDV: Terminais (caixas)",
    grupo: "PDV FNI",
    descricao: "Cadastro dos caixas do posto. Permite criar e desativar terminais usados nos abastecimentos.",
  },
  aba_pdv_bicos_posto: {
    nome: "PDV: Bombas e bicos",
    grupo: "PDV FNI",
    descricao:
      "Configuração das bombas, bicos, combustíveis e preços do posto no PDV. Mudar preço aqui muda o valor cobrado nos abastecimentos.",
    sensivel: true,
  },

  // ───────────── Fretes e transporte
  aba_fretes: {
    nome: "Fretes (TMS)",
    grupo: "Fretes e transporte",
    descricao:
      "Gestão de fretes do início ao fim: publicar, negociar, acompanhar a entrega e concluir. Mexe com valores de frete e contratos.",
  },
  aba_torre_controle: {
    nome: "Torre de controle",
    grupo: "Fretes e transporte",
    descricao: "Painel com os fretes em andamento e a posição dos veículos em tempo real, com alerta de prazo estourado.",
  },
  aba_programacao_frota: {
    nome: "Programação da frota",
    grupo: "Fretes e transporte",
    descricao: "Quadro de quem está em viagem, até quando, quem está livre e quem ainda não tem motorista. Permite programar viagens.",
  },
  aba_agendamento_patio: {
    nome: "Agendamento de pátio",
    grupo: "Fretes e transporte",
    descricao: "Agenda de chegadas e saídas de veículos no pátio. Permite criar e alterar agendamentos.",
  },
  aba_cotacoes: {
    nome: "Cotações de frete",
    grupo: "Fretes e transporte",
    descricao: "Receber e responder cotações de frete de transportadoras parceiras. Envolve preços e prazos.",
  },
  aba_tabelas_frete: {
    nome: "Tabelas de frete",
    grupo: "Fretes e transporte",
    descricao:
      "Tabelas de preço de frete por rota/distância e verificação do piso mínimo da ANTT. Alterar muda o valor cobrado dos clientes.",
    sensivel: true,
  },
  aba_bolsa_fretes: {
    nome: "Bolsa de fretes do grupo",
    grupo: "Fretes e transporte",
    descricao: "Compartilha fretes entre as empresas do mesmo grupo econômico para aproveitar capacidade ociosa.",
  },
  aba_crm_comercial: {
    nome: "CRM comercial",
    grupo: "Fretes e transporte",
    descricao: "Funil de oportunidades comerciais com histórico de contatos. Contém dados de clientes e propostas.",
  },
  aba_roteirizacao: {
    nome: "Roteirização",
    grupo: "Fretes e transporte",
    descricao: "Traça rotas e mostra os melhores postos no caminho. Consulta e simulação, sem alterar cadastros.",
  },
  aba_rotograma: {
    nome: "Rotograma",
    grupo: "Fretes e transporte",
    descricao: "Mapa de rota com pontos de risco, paradas e telefones úteis para o motorista.",
  },
  aba_planos_viagem: {
    nome: "Planos de viagem",
    grupo: "Fretes e transporte",
    descricao: "Planejamento de viagens com paradas e estimativas. Permite criar e editar planos usados pelos motoristas.",
  },
  aba_faturas_fretes: {
    nome: "Faturas de frete",
    grupo: "Financeiro e fiscal",
    descricao: "Faturamento dos fretes concluídos: gerar, enviar e acompanhar faturas. Envolve cobrança aos clientes.",
    sensivel: true,
  },
  aba_fiscal: {
    nome: "Fiscal (CT-e / MDF-e)",
    grupo: "Financeiro e fiscal",
    descricao:
      "Emissão e consulta de documentos fiscais de transporte (CT-e e MDF-e). Emitir gera documento oficial junto à SEFAZ.",
    sensivel: true,
  },

  // ───────────── Manutenção e ativos
  aba_manutencao: {
    nome: "Manutenção preditiva",
    grupo: "Manutenção e ativos",
    descricao: "Prevê manutenções a partir da quilometragem e do histórico, e permite registrar ordens de serviço.",
  },
  aba_estoque_pecas: {
    nome: "Estoque de peças",
    grupo: "Manutenção e ativos",
    descricao: "Saldo e custo médio de peças, com baixa vinculada às ordens de serviço. Permite movimentar o estoque.",
  },
  aba_pneus: {
    nome: "Gestão de pneus",
    grupo: "Manutenção e ativos",
    descricao: "Vida útil, rodízio e troca de pneus por veículo. Permite registrar movimentações.",
  },
  aba_tco: {
    nome: "TCO (custo por veículo)",
    grupo: "Manutenção e ativos",
    descricao: "Custo total de propriedade por veículo (combustível, manutenção, depreciação). Leitura de custos da empresa.",
  },
  aba_patrimonio: {
    nome: "Patrimônio",
    grupo: "Manutenção e ativos",
    descricao: "Depreciação contábil dos veículos, reavaliação, melhoria e baixa. Alterar registros muda a contabilidade do ativo.",
    sensivel: true,
  },
  aba_indicadores_frota: {
    nome: "Indicadores da frota",
    grupo: "Manutenção e ativos",
    descricao: "KPIs operacionais: custo por km, disponibilidade e manutenção. Leitura.",
  },
  aba_checklist_veiculos: {
    nome: "Checklist de inspeção",
    grupo: "Manutenção e ativos",
    descricao: "Vistorias feitas pelos motoristas no app e itens não conformes. Permite acompanhar e tratar.",
  },
  aba_sinistros: {
    nome: "Sinistros",
    grupo: "Manutenção e ativos",
    descricao: "Registro e acompanhamento de acidentes e ocorrências por veículo e motorista, até a resolução.",
  },
  aba_multas: {
    nome: "Multas",
    grupo: "Manutenção e ativos",
    descricao:
      "Infrações vinculadas a veículos e motoristas, com indicação do condutor. Contém dados pessoais e valores.",
    sensivel: true,
  },
  aba_apolices_seguro: {
    nome: "Apólices de seguro",
    grupo: "Manutenção e ativos",
    descricao: "Controle de apólices e vencimentos por veículo, com alerta antes de vencer.",
  },

  // ───────────── Financeiro e fiscal
  aba_financeiro: {
    nome: "Painel financeiro",
    grupo: "Financeiro e fiscal",
    descricao:
      "Contas a pagar e a receber, fluxo de caixa e indicadores financeiros da empresa. Dados sensíveis e permite lançar e baixar títulos.",
    sensivel: true,
  },
  aba_conciliacao_bancaria: {
    nome: "Conciliação bancária",
    grupo: "Financeiro e fiscal",
    descricao:
      "Importa extratos bancários e concilia com contas a pagar e receber, inclusive sugestões por IA. Confirmar uma conciliação baixa títulos.",
    sensivel: true,
  },
  aba_apuracao_tributaria: {
    nome: "Apuração de crédito tributário",
    grupo: "Financeiro e fiscal",
    descricao: "Apura o crédito de ICMS sobre combustível a partir das notas fiscais. Envolve valores fiscais da empresa.",
    sensivel: true,
  },
  aba_financeiro_posto: {
    nome: "Financeiro do posto",
    grupo: "Financeiro e fiscal",
    descricao:
      "Contas a receber, inadimplência e faturas do posto com seus clientes. Dados financeiros sensíveis da revenda.",
    sensivel: true,
  },
  aba_aprovacoes: {
    nome: "Aprovações em níveis",
    grupo: "Financeiro e fiscal",
    descricao: "Alçadas de aprovação por valor para manutenção e outras despesas. Aprovar ou recusar autoriza o gasto.",
    sensivel: true,
  },
  aba_central_regras: {
    nome: "Central de regras e alertas",
    grupo: "Financeiro e fiscal",
    descricao:
      "Cria regras que geram alertas automáticos para a equipe. Alterar muda o que será notificado e para quem.",
  },

  // ───────────── Inteligência e relatórios
  aba_relatorios: {
    nome: "Relatórios",
    grupo: "Inteligência e relatórios",
    descricao:
      "Relatórios de consumo, custo por km e ranking de postos, com exportação. Mostra dados consolidados da empresa.",
  },
  aba_inteligencia: {
    nome: "Inteligência de rede",
    grupo: "Inteligência e relatórios",
    descricao: "Análises da rede de postos: preços, cruzamentos, tendências e sazonalidade. Leitura.",
  },
  aba_relatorios_posto: {
    nome: "Relatórios personalizados (posto)",
    grupo: "Inteligência e relatórios",
    descricao: "Relatórios montados pelo posto sobre vendas, clientes e produtos, com exportação.",
  },
  aba_inteligencia_comercial_posto: {
    nome: "Inteligência comercial (posto)",
    grupo: "Inteligência e relatórios",
    descricao: "Visão comercial do posto: desempenho por cliente, preço e volume. Dados de vendas da revenda.",
  },

  // ───────────── Fidelidade e engajamento
  aba_fidelidade_motoristas: {
    nome: "Fidelidade dos motoristas",
    grupo: "Fidelidade e engajamento",
    descricao:
      "Programa de pontos: saldo, resgates e missões dos motoristas. Permite acompanhar e ajustar o programa.",
  },
  aba_parcerias_locais: {
    nome: "Parcerias locais (fidelidade)",
    grupo: "Fidelidade e engajamento",
    descricao:
      "Catálogo de benefícios dos parceiros, vouchers pendentes e queimados e missões. É a porta de entrada do programa Estrada que Cuida.",
  },
  aba_central_avisos: {
    nome: "Central de avisos",
    grupo: "Fidelidade e engajamento",
    descricao: "Comunicados internos para motoristas e equipe. Permite criar avisos que chegam ao app deles.",
  },

  // ───────────── Postos e rede
  aba_negociacoes: {
    nome: "Negociações com postos",
    grupo: "Postos e rede",
    descricao:
      "Propostas de preço e volume mínimo entre frota e posto. Aceitar ou propor altera condições comerciais.",
    sensivel: true,
  },
  aba_rede_postos: {
    nome: "Rede de postos",
    grupo: "Postos e rede",
    descricao: "Agrupa postos da mesma bandeira ou grupo em uma assinatura única, paga pela matriz.",
    sensivel: true,
  },
  aba_clientes_posto: {
    nome: "Clientes do posto",
    grupo: "Postos e rede",
    descricao: "Frotas atendidas pelo posto e suas condições. Contém dados comerciais dos clientes.",
  },

  // ───────────── Equipe, conta e segurança
  aba_usuarios: {
    nome: "Usuários",
    grupo: "Equipe, conta e segurança",
    descricao:
      "Cadastro de usuários e seus perfis de acesso. Quem tem acesso pode criar usuários e definir o nível deles.",
    sensivel: true,
  },
  aba_minha_equipe: {
    nome: "Minha equipe",
    grupo: "Equipe, conta e segurança",
    descricao: "Convida colegas para a sua empresa e acompanha quem já entrou. Permite dar acesso ao sistema a novas pessoas.",
    sensivel: true,
  },
  aba_permissoes: {
    nome: "Permissões",
    grupo: "Equipe, conta e segurança",
    descricao:
      "Esta própria tela: decide o que os níveis abaixo podem acessar. Quem recebe essa permissão consegue reconfigurar o acesso dos demais.",
    sensivel: true,
  },
  aba_lgpd: {
    nome: "Privacidade (LGPD)",
    grupo: "Equipe, conta e segurança",
    descricao: "Termos aceitos, solicitações de titulares e registros de consentimento. Dados de privacidade de pessoas.",
    sensivel: true,
  },
  aba_api_integracoes: {
    nome: "Integrações e API",
    grupo: "Equipe, conta e segurança",
    descricao:
      "Chaves de API, webhooks e conexões com sistemas externos (cartões de combustível, ERP, rastreadores). Quem tem acesso pode criar chaves que dão acesso aos dados.",
    sensivel: true,
  },
  aba_minha_assinatura: {
    nome: "Minha assinatura",
    grupo: "Equipe, conta e segurança",
    descricao: "Plano contratado, cobrança e limites de uso. Permite trocar de plano e ver pagamentos.",
    sensivel: true,
  },
  aba_meus_dados_pix: {
    nome: "Meus dados / PIX",
    grupo: "Equipe, conta e segurança",
    descricao: "Dados cadastrais da empresa e chave PIX para recebimento. Alterar muda para onde vão os pagamentos.",
    sensivel: true,
  },
  aba_chamados: {
    nome: "Chamados de suporte",
    grupo: "Equipe, conta e segurança",
    descricao: "Abrir e acompanhar chamados com o suporte da FNI.",
  },
  aba_avaliar_plataforma: {
    nome: "Avaliar a plataforma",
    grupo: "Equipe, conta e segurança",
    descricao: "Enviar nota e comentário sobre a FNI.",
  },

  // ───────────── Funções gerais
  func_exportar: {
    nome: "Exportar dados",
    grupo: "Funções gerais",
    descricao:
      "Botões de exportação para Excel/CSV em todas as telas liberadas. Permite levar os dados para fora do sistema.",
    sensivel: true,
  },
  func_upload_planilha: {
    nome: "Importar planilhas",
    grupo: "Funções gerais",
    descricao:
      "Importação em lote de veículos, motoristas e abastecimentos por planilha. Pode criar ou alterar muitos registros de uma vez.",
    sensivel: true,
  },
  func_gerenciar_users: {
    nome: "Gerenciar usuários",
    grupo: "Funções gerais",
    descricao: "Ações de administração de usuários: convidar, inativar, redefinir acesso e alterar perfil.",
    sensivel: true,
  },

  // ───────────── Administração (time interno) — só aparecem para o admin
  aba_admin: {
    nome: "Administração",
    grupo: "Administração (time interno)",
    descricao: "Área de administração da plataforma, restrita ao time interno da FNI.",
  },
  aba_assinaturas_clientes: {
    nome: "Assinaturas de todos os clientes",
    grupo: "Administração (time interno)",
    descricao: "Visão do time interno sobre planos, trials e saúde de todos os clientes.",
  },
  aba_avaliacoes_clientes: {
    nome: "Avaliações dos clientes",
    grupo: "Administração (time interno)",
    descricao: "Notas e comentários enviados pelos clientes sobre a plataforma.",
  },
  aba_configuracoes_sistema: {
    nome: "Configurações do sistema",
    grupo: "Administração (time interno)",
    descricao: "Parâmetros globais da plataforma.",
  },
  aba_log_auditoria: {
    nome: "Log de auditoria",
    grupo: "Administração (time interno)",
    descricao: "Registro de quem mudou o quê e quando nas ações mais sensíveis.",
  },
  aba_pdv_metricas: {
    nome: "Dashboard do PDV (piloto)",
    grupo: "Administração (time interno)",
    descricao: "Acompanhamento de uso do PDV em todas as revendas durante o piloto.",
  },
  aba_pdv_bicos: {
    nome: "Bicos e combustíveis do PDV (painel web)",
    grupo: "Administração (time interno)",
    descricao: "Catálogo de bombas e bicos de todas as revendas, mantido pelo time interno.",
  },
  aba_pisos_antt: {
    nome: "Piso mínimo ANTT",
    grupo: "Administração (time interno)",
    descricao: "Tabela oficial de piso de frete mantida pelo time interno.",
  },
  aba_oficinas_credenciadas: {
    nome: "Oficinas credenciadas",
    grupo: "Administração (time interno)",
    descricao: "Cadastro central de oficinas credenciadas, mantido pelo time interno.",
  },
};
