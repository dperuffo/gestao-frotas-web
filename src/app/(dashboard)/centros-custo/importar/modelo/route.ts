import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de centros de custo.
export async function GET() {
  const cabecalho = ["nome", "codigo", "responsavel", "descricao", "cnpj_cliente"];
  const linhas = [
    ["Filial São Paulo", "CC-001", "Maria Souza", "Operação da filial de SP", "12345678000199"],
    ["Filial Curitiba", "CC-002", "João Silva", "", "12345678000199"],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Centros de Custo");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_centros_custo.xlsx"',
    },
  });
}
