import { gerarXlsxModelo } from "@/lib/xlsx";

// Modelo (template) de planilha XLSX para importação em lote de preços de
// combustíveis por posto. Reproduz o layout EXATO esperado pelo importador
// real (src/app/(dashboard)/postos/importar-precos/actions.ts): aba
// "Preços", 16 colunas na mesma posição/ordem do arquivo "preco_posto.xlsx"
// da integração Pró-Frotas. Assim como o modelo de postos_gf, esta rota não
// é usada no fluxo normal do app hoje (a importação real espera o arquivo
// já exportado da integração), mas fica disponível como referência de
// formato.
export async function GET() {
  const cabecalho = [
    "Data de Vigência", "Data de Atualização", "Código Pró-Frotas", "Ponto de Venda",
    "CNPJ do Ponto de Venda", "Cidade", "UF", "Código ABADI", "Produto",
    "Preço Posto (R$)", "Preço Anterior", "Preço Referência", "Status",
    "Status do Ponto de Venda", "Origem da Alteração Preço", "Bandeira",
  ];
  const linhas = [
    [
      "2026-07-01", "2026-07-01", "", "Posto Central", "11222333000144", "São Paulo", "SP",
      "", "Diesel S10", 6.29, 6.19, 6.35, "Ativo", "Ativo", "Tabela do posto", "Ipiranga",
    ],
    [
      "2026-07-01", "2026-07-01", "", "Posto Central", "11222333000144", "São Paulo", "SP",
      "", "Gasolina Comum", 5.99, 5.95, 6.05, "Ativo", "Ativo", "", "Ipiranga",
    ],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Preços");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_precos_postos.xlsx"',
    },
  });
}
