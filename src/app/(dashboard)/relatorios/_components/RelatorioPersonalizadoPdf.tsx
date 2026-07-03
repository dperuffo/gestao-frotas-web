import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ColunaPdf = { id: string; label: string };
export type LinhaPdf = { chave: string; valores: string[]; registros: string };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 4 },
  meta: { fontSize: 9, color: "#64748b", marginBottom: 16 },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", borderStyle: "solid" },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderStyle: "solid" },
  celulaHeaderChave: { flex: 2, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569" },
  celulaHeader: { flex: 1, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569", textAlign: "right" },
  celulaChave: { flex: 2, padding: 5, fontSize: 9 },
  celula: { flex: 1, padding: 5, fontSize: 9, textAlign: "right" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
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
export function RelatorioPersonalizadoPdf({
  nomeEmpresa,
  titulo,
  subtitulo,
  colunaChave,
  colunas,
  linhas,
  geradoEm,
}: {
  nomeEmpresa: string;
  titulo: string;
  subtitulo: string;
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
        <Text style={styles.meta}>{subtitulo}</Text>

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
