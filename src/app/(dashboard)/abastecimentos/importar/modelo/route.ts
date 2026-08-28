import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de
// abastecimentos — fallback para clientes sem integração automática com o
// meio de pagamento (ex: PróFrotas).
export async function GET() {
  const cabecalho = [
    "data_abastecimento",
    "veiculo_placa",
    "motorista_nome",
    "motorista_cpf",
    "hodometro",
    "produto",
    "litros",
    "preco_litro",
    "valor_total",
    "posto_nome",
    "posto_municipio",
    "posto_uf",
    "cnpj_cliente",
  ];
  const linhas = [
    [
      "2026-06-20 08:30", "ABC1D23", "José Pereira", "12345678901", 45210, "Diesel S10", 180.5, 6.29, 1135.35,
      "Posto Central", "São Paulo", "SP", "12345678000199",
    ],
    [
      "2026-06-20 14:10", "XYZ9K88", "Ana Lima", "", "", "Gasolina Comum", 40.2, 5.99, 240.80,
      "", "", "", "12345678000199",
    ],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Abastecimentos");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_abastecimentos.xlsx"',
    },
  });
}
