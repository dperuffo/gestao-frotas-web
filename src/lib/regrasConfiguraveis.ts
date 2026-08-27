// Fase Motor-de-Regras-Unico (27/08/2026, pedido do Daniel: "novas features
// de produto" + "unificar em um motor de regras único") — catálogo dos
// limites que hoje ficam hardcoded dentro das funções de detecção
// (detectar_anomalias_abastecimento e a camada de "mínimo de ocorrências"
// de acoes-sugeridas/actions.ts) e passam a ser configuráveis por empresa
// via a tabela configuracoes_regras. Fica em código (não em tabela de
// catálogo no banco) pelo mesmo motivo de PERFIS/tipos em constants.ts —
// é um conjunto fechado, versionado junto com o código que consome cada
// chave.
export type ChaveRegraConfiguravel =
  | "volume_tanque_percentual_max"
  | "geo_distancia_km_min"
  | "geo_distancia_velocidade_kmh_min"
  | "hodometro_dias_parado_max"
  | "preco_regiao_desvios_padrao_max"
  | "posto_acima_media_percentual_max"
  | "minimo_ocorrencias_hodometro"
  | "minimo_ocorrencias_volume_tanque"
  | "minimo_ocorrencias_geo_distancia"
  | "minimo_ocorrencias_preco_regiao"
  | "exame_toxicologico_dias_antecedencia"
  | "aso_dias_antecedencia";

export type DefinicaoRegraConfiguravel = {
  chave: ChaveRegraConfiguravel;
  grupo:
    | "Anomalias de abastecimento"
    | "Ações sugeridas — mínimo de ocorrências"
    | "Exame toxicológico e ASO — alerta antecipado";
  label: string;
  ajuda: string;
  padrao: number;
  passo: number;
  min: number;
};

export const CATALOGO_REGRAS_CONFIGURAVEIS: DefinicaoRegraConfiguravel[] = [
  {
    chave: "volume_tanque_percentual_max",
    grupo: "Anomalias de abastecimento",
    label: "Volume acima da capacidade do tanque",
    ajuda: "Abastecimento maior que capacidade do tanque × este valor vira anomalia. Padrão 1.15 = 15% acima.",
    padrao: 1.15,
    passo: 0.01,
    min: 1,
  },
  {
    chave: "geo_distancia_km_min",
    grupo: "Anomalias de abastecimento",
    label: "Distância mínima entre postos (km)",
    ajuda: "Só considera 'postos distantes' se a distância entre os 2 abastecimentos passar deste valor.",
    padrao: 25,
    passo: 1,
    min: 1,
  },
  {
    chave: "geo_distancia_velocidade_kmh_min",
    grupo: "Anomalias de abastecimento",
    label: "Velocidade implícita mínima (km/h)",
    ajuda: "Só considera anomalia se a velocidade média necessária entre os 2 postos passar deste valor.",
    padrao: 100,
    passo: 5,
    min: 1,
  },
  {
    chave: "hodometro_dias_parado_max",
    grupo: "Anomalias de abastecimento",
    label: "Dias com hodômetro parado",
    ajuda: "Hodômetro igual ao do abastecimento anterior por mais dias que este valor vira anomalia.",
    padrao: 2,
    passo: 1,
    min: 1,
  },
  {
    chave: "preco_regiao_desvios_padrao_max",
    grupo: "Anomalias de abastecimento",
    label: "Desvios-padrão do preço regional",
    ajuda: "Preço do litro que se afastar da média ANP da região por mais que este número de desvios-padrão vira anomalia.",
    padrao: 2,
    passo: 0.5,
    min: 0.5,
  },
  {
    chave: "posto_acima_media_percentual_max",
    grupo: "Anomalias de abastecimento",
    label: "Posto acima da média regional",
    ajuda: "Posto que cobrar mais que este percentual acima da média ANP vira sugestão de remoção da rede. Padrão 0.15 = 15%.",
    padrao: 0.15,
    passo: 0.01,
    min: 0.01,
  },
  {
    chave: "minimo_ocorrencias_hodometro",
    grupo: "Ações sugeridas — mínimo de ocorrências",
    label: "Hodômetro fora do padrão",
    ajuda: "Quantas anomalias de hodômetro na mesma placa antes de virar ação sugerida.",
    padrao: 2,
    passo: 1,
    min: 1,
  },
  {
    chave: "minimo_ocorrencias_volume_tanque",
    grupo: "Ações sugeridas — mínimo de ocorrências",
    label: "Volume acima do tanque",
    ajuda: "Quantas anomalias de volume na mesma placa antes de virar ação sugerida.",
    padrao: 1,
    passo: 1,
    min: 1,
  },
  {
    chave: "minimo_ocorrencias_geo_distancia",
    grupo: "Ações sugeridas — mínimo de ocorrências",
    label: "Postos distantes no mesmo dia",
    ajuda: "Quantas anomalias de distância na mesma placa antes de virar ação sugerida.",
    padrao: 1,
    passo: 1,
    min: 1,
  },
  {
    chave: "minimo_ocorrencias_preco_regiao",
    grupo: "Ações sugeridas — mínimo de ocorrências",
    label: "Preço fora da média regional",
    ajuda: "Quantas anomalias de preço na mesma placa antes de virar ação sugerida.",
    padrao: 3,
    passo: 1,
    min: 1,
  },
  {
    chave: "exame_toxicologico_dias_antecedencia",
    grupo: "Exame toxicológico e ASO — alerta antecipado",
    label: "Exame toxicológico — dias de antecedência",
    ajuda: "Avisa a partir de quantos dias antes do vencimento (exigido pela Lei do Motorista).",
    padrao: 30,
    passo: 1,
    min: 1,
  },
  {
    chave: "aso_dias_antecedencia",
    grupo: "Exame toxicológico e ASO — alerta antecipado",
    label: "ASO — dias de antecedência",
    ajuda: "Avisa a partir de quantos dias antes do vencimento do Atestado de Saúde Ocupacional.",
    padrao: 30,
    passo: 1,
    min: 1,
  },
];
