import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de motoristas.
export async function GET() {
  const cabecalho = [
    "nome_completo",
    "cpf",
    "telefone",
    "email",
    "classificacao",
    "cnh",
    "cnh_vencimento",
    "centro_custo",
    "cnpj_cliente",
  ];
  const linhas = [
    ["José Pereira", "11122233344", "", "", "Próprio", "", "2027-05-01", "Matriz", "12345678000199"],
    ["Ana Lima", "55566677788", "", "", "Agregado", "", "", "", "12345678000199"],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Motoristas");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_motoristas.xlsx"',
    },
  });
}
