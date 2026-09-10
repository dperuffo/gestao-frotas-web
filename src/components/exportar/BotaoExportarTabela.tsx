"use client";

import { useState } from "react";

// Fase Exportar-Cadastros — pedido do Daniel: "No menu Cadastro, em todas as
// abas, o usuário ter a opção de gerar PDF e XLSX para impressão e
// manipulação de planilhas". Componente único e reaproveitável nas 7 telas
// do menu Cadastros (Clientes, Grupo Econômico, Usuários, Motoristas,
// Veículos, Centros de Custo, Postos Revendedores) — cada tela só passa
// título/colunas/linhas já formatadas em texto (mesmos valores exibidos na
// tabela em tela), sem precisar montar PDF/XLSX na mão.
//
// @react-pdf/renderer e a lib "xlsx" (SheetJS) são pesadas e só rodam no
// browser (Blob/Canvas) — por isso os dois só são importados dinamicamente
// dentro do onClick de cada botão (nunca no topo do arquivo), mesmo padrão
// já usado em relatorios/_components/BotaoBaixarPdfPersonalizado.tsx. Assim
// nenhuma das duas libs entra no bundle inicial das telas de Cadastro; só
// carrega quando o usuário efetivamente clica em exportar.
export type ColunaExportacao = { header: string; chave: string };
export type LinhaExportacao = Record<string, string | number | null | undefined>;

function linhasParaTexto(colunas: ColunaExportacao[], linhas: LinhaExportacao[]): string[][] {
  return linhas.map((linha) => colunas.map((c) => (linha[c.chave] ?? "").toString()));
}

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function BotaoExportarTabela({
  nomeArquivo,
  titulo,
  subtitulo = "Fleet Network Intelligence",
  colunas,
  linhas,
  carregarLinhas,
}: {
  nomeArquivo: string;
  titulo: string;
  subtitulo?: string;
  colunas: ColunaExportacao[];
  // Fase Pente-Fino-Performance (10/09/2026) — telas com paginação real no
  // banco (ex. /veiculos) não têm mais a lista completa já carregada na
  // página pra passar aqui como prop. Pra essas, `carregarLinhas` busca a
  // lista completa (Server Action) só quando o usuário clica em exportar,
  // em vez de em todo carregamento de página. `linhas` continua funcionando
  // como antes pras telas que já têm os dados prontos (mais simples).
  linhas?: LinhaExportacao[];
  carregarLinhas?: () => Promise<LinhaExportacao[]>;
}) {
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoXlsx, setGerandoXlsx] = useState(false);

  async function obterLinhas(): Promise<LinhaExportacao[]> {
    return carregarLinhas ? await carregarLinhas() : (linhas ?? []);
  }

  async function exportarPdf() {
    setGerandoPdf(true);
    try {
      const [{ pdf }, { TabelaGenericaPdf }, dados] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./TabelaGenericaPdf"),
        obterLinhas(),
      ]);
      const geradoEm = new Date().toLocaleString("pt-BR");
      const blob = await pdf(
        <TabelaGenericaPdf
          titulo={titulo}
          subtitulo={subtitulo}
          colunas={colunas.map((c) => c.header)}
          linhas={linhasParaTexto(colunas, dados)}
          geradoEm={geradoEm}
        />
      ).toBlob();
      baixarBlob(blob, `${nomeArquivo}.pdf`);
    } catch (e) {
      console.error("[BotaoExportarTabela] falha ao gerar PDF:", e);
    } finally {
      setGerandoPdf(false);
    }
  }

  async function exportarXlsx() {
    setGerandoXlsx(true);
    try {
      const [{ gerarXlsxModelo }, dados] = await Promise.all([import("@/lib/xlsx"), obterLinhas()]);
      const buffer = gerarXlsxModelo(
        colunas.map((c) => c.header),
        linhasParaTexto(colunas, dados),
        titulo.slice(0, 31) || "Dados"
      );
      baixarBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${nomeArquivo}.xlsx`);
    } catch (e) {
      console.error("[BotaoExportarTabela] falha ao gerar XLSX:", e);
    } finally {
      setGerandoXlsx(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={exportarPdf} disabled={gerandoPdf} className="btn-secondary text-sm">
        {gerandoPdf ? "Gerando PDF..." : "📄 Exportar PDF"}
      </button>
      <button type="button" onClick={exportarXlsx} disabled={gerandoXlsx} className="btn-secondary text-sm">
        {gerandoXlsx ? "Gerando XLSX..." : "📊 Exportar XLSX"}
      </button>
    </div>
  );
}
