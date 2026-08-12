import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de veículos.
export async function GET() {
  // Fase Corrige-Reimportação-Veículos (12/08/2026, 4ª rodada) — o
  // template tinha ficado pra trás em relação ao formulário manual
  // (VeiculoForm.tsx): faltavam tipo (porte Leve/Pesado), hodometro_atual,
  // capacidade_kg e os campos de TCO/Patrimônio (valor_aquisicao,
  // data_aquisicao, valor_residual_estimado, vida_util_anos). Não incluídos
  // de propósito: os campos de FIPE (codigo_fipe, valor_fipe etc.) — esses
  // vêm só da vinculação FIPE (VincularFipe.tsx), não são digitados.
  const cabecalho = [
    "placa",
    "marca",
    "modelo",
    "tipo_veiculo",
    "tipo",
    "classificacao",
    "motor",
    "ano_modelo",
    "ano_fabricacao",
    "combustivel",
    "tanque",
    "autonomia",
    "hodometro_atual",
    "numero_eixos",
    "capacidade_kg",
    "cor",
    "chassi",
    "renavam",
    "municipio",
    "uf_veiculo",
    "centro_custo",
    "valor_aquisicao",
    "data_aquisicao",
    "valor_residual_estimado",
    "vida_util_anos",
    "cnpj_cliente",
  ];
  const linhas = [
    [
      "ABC1D23", "Volvo", "FH 540", "Cavalo Mecânico", "Pesado", "Próprio", "D13", 2023, 2023,
      "Diesel S10", 400, 2.5, 15000, 6, 25000, "Branco", "", "", "São Paulo", "SP", "Matriz",
      450000, "15/01/2023", 120000, 5, "12345678000199",
    ],
    [
      "XYZ9K88", "Mercedes", "Actros", "Cavalo Mecânico", "Pesado", "Agregado", "", 2020, 2020,
      "Diesel S500", "", "", "", 6, "", "", "", "", "", "", "", "", "", "", "", "12345678000199",
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
