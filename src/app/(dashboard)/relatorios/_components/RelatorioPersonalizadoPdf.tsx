import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ColunaPdf = { id: string; label: string };
export type LinhaPdf = { chave: string; valores: string[]; registros: string };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 8 },
  tituloRelatorio: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#1e293b" },
  // Fase 27.32 — caixa de emissão: quem gerou (nome + cargo), quando, e a
  // combinação exata de fonte/dimensão/métricas usada — importante pra um
  // relatório que pode circular fora da plataforma (impresso, anexado a
  // e-mail etc.) sem perder o contexto de como foi gerado.
  caixaEmissao: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
  linhaEmissao: { flexDirection: "row", marginBottom: 3 },
  rotuloEmissao: { fontSize: 8, fontWeight: 700, color: "#64748b", width: 90 },
  valorEmissao: { fontSize: 8, color: "#334155", flex: 1 },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", borderStyle: "solid" },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderStyle: "solid" },
  celulaHeaderChave: { flex: 2, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569" },
  celulaHeader: { flex: 1, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569", textAlign: "right" },
  celulaChave: { flex: 2, padding: 5, fontSize: 9 },
  celula: { flex: 1, padding: 5, fontSize: 9, textAlign: "right" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
  // Fase 27.33 — imagem do gráfico (capturada da tela, ver
  // BotaoBaixarPdfPersonalizado.tsx), centralizada e com moldura leve.
  graficoWrap: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  grafico: { maxWidth: "100%", maxHeight: 260 },
});

// Documento PDF do "monte o seu relatório" (Relatórios Personalizados) —
// gerado 100% no client via @react-pdf/renderer, mesmo padrão do
// RelatorioExecutivoPdf. Como a combinação fonte/dimensão/métrica é livre
// (definida pelo usuário na tela), a tabela de colunas também é dinâmica:
// 1ª coluna é sempre a dimensão escolhida, as colunas seguintes são as
// métricas selecionadas (já formatadas em texto pela tela) e a última é a
// contagem de registros. Não tenta reproduzir o gráfico (recharts não
// renderiza dentro do @react-pdf/renderer) — só a tabela de resultados,
// igual ao que já acontece no CSV.
//
// Fase 27.32 — achado real: o cabeçalho não dizia QUEM emitiu o relatório
// (nome/cargo), nem trazia data/hora em destaque (só no rodapé, discreto),
// e o próprio `titulo` (que já continha a combinação dimensão+métricas)
// nem chegava a ser renderizado. Corrigido com uma caixa de emissão logo no
// topo, reunindo tudo o que precisa acompanhar o relatório fora da tela.
//
// Fase 27.33 — achado real: o PDF nunca trazia o gráfico da consulta, só a
// tabela. `imagemGraficoUrl` é um PNG (data URL) capturado do gráfico já
// desenhado na tela no momento da exportação (ver capturarGrafico em
// RelatoriosPersonalizados.tsx) — null quando o tipo de gráfico escolhido é
// "Tabela" (não existe gráfico pra capturar nesse caso).
export function RelatorioPersonalizadoPdf({
  nomeEmpresa,
  titulo,
  subtitulo,
  fonteLabel,
  dimensaoLabel,
  metricasLabels,
  nomeUsuario,
  cargoUsuario,
  imagemGraficoUrl,
  colunaChave,
  colunas,
  linhas,
  geradoEm,
}: {
  nomeEmpresa: string;
  titulo: string;
  subtitulo: string;
  fonteLabel: string;
  dimensaoLabel: string;
  metricasLabels: string[];
  nomeUsuario: string;
  cargoUsuario: string | null;
  imagemGraficoUrl: string | null;
  colunaChave: string;
  colunas: ColunaPdf[];
  linhas: LinhaPdf[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Relatório Personalizado</Text>
        <Text style={styles.subtitulo}>{nomeEmpresa} · Fleet Network Intelligence</Text>

        <Text style={styles.tituloRelatorio}>{titulo}</Text>

        <View style={styles.caixaEmissao}>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Emitido por</Text>
            <Text style={styles.valorEmissao}>
              {nomeUsuario}
              {cargoUsuario ? ` — ${cargoUsuario}` : ""}
            </Text>
          </View>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Data e hora</Text>
            <Text style={styles.valorEmissao}>{geradoEm}</Text>
          </View>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Fonte</Text>
            <Text style={styles.valorEmissao}>{fonteLabel}</Text>
          </View>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Dimensão</Text>
            <Text style={styles.valorEmissao}>{dimensaoLabel}</Text>
          </View>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Métricas</Text>
            <Text style={styles.valorEmissao}>{metricasLabels.join(", ")}</Text>
          </View>
          <View style={styles.linhaEmissao}>
            <Text style={styles.rotuloEmissao}>Resultado</Text>
            <Text style={styles.valorEmissao}>{subtitulo}</Text>
          </View>
        </View>

        {imagemGraficoUrl && (
          <View style={styles.graficoWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (documento PDF), não uma <img> HTML; não aceita prop "alt". */}
            <Image src={imagemGraficoUrl} style={styles.grafico} />
          </View>
        )}

        {linhas.length === 0 ? (
          <Text style={styles.semDados}>Nenhum dado encontrado para essa combinação de fonte/dimensão/métrica.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader} fixed>
              <Text style={styles.celulaHeaderChave}>{colunaChave}</Text>
              {colunas.map((c) => (
                <Text key={c.id} style={styles.celulaHeader}>
                  {c.label}
                </Text>
              ))}
              <Text style={styles.celulaHeader}>Registros</Text>
            </View>
            {linhas.map((l, i) => (
              <View key={`${l.chave}__${i}`} style={styles.linha} wrap={false}>
                <Text style={styles.celulaChave}>{l.chave}</Text>
                {l.valores.map((v, j) => (
                  <Text key={j} style={styles.celula}>
                    {v}
                  </Text>
                ))}
                <Text style={styles.celula}>{l.registros}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape} fixed>
          Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
