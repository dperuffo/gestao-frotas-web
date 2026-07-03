import { gerarXlsxModelo } from "@/lib/xlsx";

// Disponibiliza o modelo (template) de planilha XLSX para importação em lote de usuários.
export async function GET() {
  const cabecalho = ["nome", "email", "cpf", "telefone", "perfil", "segmento", "cnpj_cliente"];
  const linhas = [
    ["João da Silva", "joao.silva@exemplo.com", "", "", "gestor_frota", "Frota", "12345678000199"],
    ["Maria Souza", "maria.souza@exemplo.com", "", "", "analista", "Frota", "12345678000199"],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Usuários");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_usuarios.xlsx"',
    },
  });
}
