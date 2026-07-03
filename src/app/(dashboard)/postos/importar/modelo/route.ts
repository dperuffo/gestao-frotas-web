import { gerarXlsxModelo } from "@/lib/xlsx";

// Modelo (template) de planilha XLSX para importação em lote de postos
// revendedores. Reproduz o layout EXATO esperado pelo importador real
// (src/app/(dashboard)/postos/importar/actions.ts): aba "Ponto de Venda",
// 43 colunas na mesma posição/ordem do arquivo "postos_gf.xlsx" exportado
// do sistema de origem. Esta rota não é usada normalmente no fluxo do app
// hoje (a importação real espera o arquivo já exportado do sistema de
// origem, não um modelo preenchido à mão), mas fica disponível como
// referência de formato caso seja necessário montar a planilha manualmente.
export async function GET() {
  const cabecalho = [
    "CNPJ", "Nome", "Tipo de localização", "Perfil de venda", "Status", "Situação",
    "Status Ipiranga", "Código JDE Ipiranga", "Código JDE", "Rede", "Micromercado",
    "Bandeira", "Tipo de Bandeira", "Grupo Econômico", "Taxa de Administração Padrão",
    "CEP", "Logradouro", "Número", "Complemento", "Latitude", "Longitude", "Bairro",
    "Cidade", "UF", "Nome Contato", "Telefone (contato)", "E-mail (contato)",
    "Nome Responsável", "Telefone (responsável)", "E-mail (responsável)",
    "Possui conveniência?", "AM/PM?", "Restaurante?", "Banheiro?", "Cobrança banheiro?",
    "Estacionamento?", "Troca de óleo?", "Óleo a granel?", "Arla 32?", "Qual tipo?",
    "Internet?", "Outros serviços", "Data/hora de habilitação",
  ];
  const linhas = [
    [
      "11222333000144", "Posto Central", "Urbana", "Varejo", "Ativo", "Habilitado", "", "", "",
      "Ipiranga", "", "Ipiranga", "Própria", "", 1.5, "01310-100", "Av. Paulista", "1000", "",
      -23.55052, -46.633309, "Bela Vista", "São Paulo", "SP", "", "", "", "", "", "",
      "Sim", "Sim", "Não", "Sim", "Não", "Sim", "Não", "Não", "Sim", "A granel", "Sim", "", "2024-01-15",
    ],
    [
      "55666777000188", "Posto Rodovia Sul", "Rodoviária", "", "Ativo", "Habilitado", "", "", "",
      "", "", "", "", "", "", "", "", "", "", -25.429596, -49.271272, "", "Curitiba", "PR",
      "", "", "", "", "", "", "Não", "Não", "Não", "Sim", "Não", "Não", "Sim", "Não", "Não", "", "Não", "", "",
    ],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Ponto de Venda");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_postos_gf.xlsx"',
    },
  });
}
