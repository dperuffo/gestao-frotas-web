import { gerarXlsxModelo } from "@/lib/xlsx";

// Modelo (template) de planilha XLSX para importar/atualizar o piso mínimo
// de frete da ANTT (Res. 5.867/2020). Layout esperado pelo importador real
// (src/app/(dashboard)/administracao/pisos-antt/actions.ts): aba
// "Piso ANTT", 5 colunas na ordem abaixo. Repita uma linha por combinação
// de tipo de carga × número de eixos — o import faz upsert por essa chave,
// então reenviar a planilha inteira a cada atualização da ANTT é seguro.
export async function GET() {
  const cabecalho = [
    "Tipo de Carga", "Nº de Eixos", "Coeficiente de Deslocamento (R$/km)", "Coeficiente de Carga/Descarga (R$)", "Vigência",
  ];
  const linhas = [
    ["Carga Geral", 2, 3.45, 150, "2026-01-01"],
    ["Carga Geral", 3, 4.1, 180, "2026-01-01"],
    ["Granel Sólido", 2, 3.2, 140, "2026-01-01"],
    ["Granel Líquido", 3, 4.35, 190, "2026-01-01"],
    ["Conteinerizada", 4, 4.6, 210, "2026-01-01"],
  ];
  const arquivo = gerarXlsxModelo(cabecalho, linhas, "Piso ANTT");

  return new Response(arquivo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_piso_antt.xlsx"',
    },
  });
}
