import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de veículos.
export async function GET() {
  const cabecalho = [
    "placa",
    "marca",
    "modelo",
    "tipo_veiculo",
    "classificacao",
    "motor",
    "ano_modelo",
    "ano_fabricacao",
    "combustivel",
    "tanque",
    "autonomia",
    "numero_eixos",
    "cor",
    "chassi",
    "renavam",
    "municipio",
    "uf_veiculo",
    "centro_custo",
    "cnpj_cliente",
  ];
  const linhas = [
    [
      "ABC1D23", "Volvo", "FH 540", "Cavalo Mecânico", "Próprio", "D13", 2023, 2023,
      "Diesel S10", 400, 2.5, 6, "Branco", "", "", "São Paulo", "SP", "Matriz", "12345678000199",
    ],
    [
      "XYZ9K88", "Mercedes", "Actros", "Cavalo Mecânico", "Agregado", "", 2020, 2020,
      "Diesel S500", "", "", 6, "", "", "", "", "", "", "12345678000199",
    ],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Veículos");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_veiculos.xlsx"',
    },
  });
}
