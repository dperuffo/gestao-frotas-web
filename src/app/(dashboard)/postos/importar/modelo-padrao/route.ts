import { gerarXlsxModelo } from "@/lib/xlsx";

// Fase template-padrao-planilhas — pedido do Daniel: modelo (template) de
// planilha GENÉRICO para importação da rede de postos, pensado para
// qualquer sistema externo que não seja o Pró-Frotas (ver comentário em
// src/app/api/postos/importar/route.ts). Cabeçalho por NOME de coluna —
// qualquer ordem funciona, o parser mapeia pelo nome normalizado; só a
// coluna "CNPJ" é obrigatória. Aba com nome diferente de "Ponto de Venda"
// de propósito, para não ser confundida com o layout posicional fixo do
// Pró-Frotas.
export async function GET() {
  const cabecalho = [
    "CNPJ",
    "Razão Social",
    "Município",
    "UF",
    "Bairro",
    "CEP",
    "Logradouro",
    "Número",
    "Complemento",
    "Latitude",
    "Longitude",
    "Bandeira",
    "Rede",
    "Telefone",
    "E-mail",
    "Horário de Funcionamento",
    "Funciona 24h?",
    "Pista para Caminhão?",
    "Possui Conveniência?",
    "Possui Restaurante?",
    "Possui Banheiro?",
    "Possui Estacionamento?",
    "Possui Troca de Óleo?",
    "Possui Arla 32?",
    "Possui Internet?",
    "Ativo?",
  ];
  const linhas = [
    [
      "11222333000144", "Posto Central", "São Paulo", "SP", "Bela Vista", "01310-100",
      "Av. Paulista", "1000", "", -23.55052, -46.633309, "Ipiranga", "Ipiranga",
      "(11) 3000-0000", "contato@postocentral.com.br", "24 horas", "Sim", "Sim",
      "Sim", "Não", "Sim", "Sim", "Sim", "Não", "Sim", "Sim",
    ],
    [
      "55666777000188", "Posto Rodovia Sul", "Curitiba", "PR", "", "",
      "", "", "", -25.429596, -49.271272, "", "",
      "", "", "06h às 22h", "Não", "Sim",
      "Não", "Não", "Não", "Sim", "Não", "Não", "Não", "Sim",
    ],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Postos");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_padrao_postos.xlsx"',
    },
  });
}
