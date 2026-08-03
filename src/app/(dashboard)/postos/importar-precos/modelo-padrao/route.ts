import { gerarXlsxModelo } from "@/lib/xlsx";

// Fase template-padrao-planilhas — pedido do Daniel: modelo (template) de
// planilha GENÉRICO para importação de preços por posto, pensado para
// qualquer sistema externo que não seja o Pró-Frotas (ver comentário em
// src/app/api/postos/importar-precos/route.ts). Cabeçalho por NOME de
// coluna — qualquer ordem funciona. Obrigatórias: "CNPJ", "Combustível",
// "Preço" e ao menos uma das duas datas ("Data de Vigência" ou "Data de
// Atualização"). Aba com nome diferente de "Preços" de propósito, para não
// ser confundida com o layout posicional fixo do Pró-Frotas.
export async function GET() {
  const cabecalho = [
    "CNPJ",
    "Combustível",
    "Preço",
    "Data de Vigência",
    "Data de Atualização",
    "Razão Social",
    "Município",
    "UF",
    "Bandeira",
  ];
  const linhas = [
    ["11222333000144", "Diesel S10", 6.29, "2026-07-01", "2026-07-01", "Posto Central", "São Paulo", "SP", "Ipiranga"],
    ["11222333000144", "Gasolina Comum", 5.99, "2026-07-01", "2026-07-01", "Posto Central", "São Paulo", "SP", "Ipiranga"],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Preços - Padrão");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_padrao_precos_postos.xlsx"',
    },
  });
}
