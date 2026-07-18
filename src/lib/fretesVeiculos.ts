// Fase Fretes-Dados-Completos-2 — pedido do Daniel (inspirado em telas de
// outras plataformas de frete): cliente informa que tipo de veículo e
// carroceria servem pro frete, motorista filtra a lista pelo que ele tem.
// Categorias seguem o mesmo agrupamento leve/médio/pesado usado no
// mercado de fretes (bolsas de carga).

export const GRUPOS_VEICULO: { grupo: string; opcoes: string[] }[] = [
  { grupo: "Leves", opcoes: ["3/4", "Toco", "VLC", "Fiorino", "Van", "HR"] },
  { grupo: "Médios", opcoes: ["Bitruck", "Truck"] },
  { grupo: "Pesados", opcoes: ["Carreta", "Carreta LS", "Bitrem", "Rodotrem"] },
];

export const VEICULOS_FRETE: string[] = GRUPOS_VEICULO.flatMap((g) => g.opcoes);

export const CARROCERIAS_FRETE: string[] = [
  "Baú",
  "Sider",
  "Grade Baixa",
  "Graneleiro",
  "Caçamba",
  "Prancha",
  "Tanque",
  "Frigorífico/Refrigerado",
  "Bug/Porta Container",
];
