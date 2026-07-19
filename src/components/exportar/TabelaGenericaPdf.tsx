import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Fase Exportar-Cadastros — pedido do Daniel: "No menu Cadastro, em todas as
// abas, o usuário ter a opção de gerar PDF e XLSX para impressão e
// manipulação de planilhas". Documento PDF genérico (qualquer tabela vira um
// PDF em paisagem, uma linha por registro) — reaproveitado nas 7 telas do
// menu Cadastros em vez de duplicar um componente de PDF por tela, como
// RelatorioPersonalizadoPdf.tsx faz para o caso mais específico de
// Relatórios Personalizados. Mesmo padrão de geração (@react-pdf/renderer,
// só no client) e mesmo motivo pra paisagem: tabelas de cadastro têm de 4 a
// 9 colunas, retrato ficaria apertado demais pra caber sem quebrar texto.
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 15, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 9, color: "#64748b", marginBottom: 10 },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    borderStyle: "solid",
  },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderStyle: "solid" },
  celulaHeader: { flex: 1, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569" },
  celula: { flex: 1, padding: 5, fontSize: 8 },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
  rodape: { position: "absolute", bottom: 18, left: 28, right: 28, fontSize: 7, color: "#94a3b8", textAlign: "center" },
});

export function TabelaGenericaPdf({
  titulo,
  subtitulo,
  colunas,
  linhas,
  geradoEm,
}: {
  titulo: string;
  subtitulo: string;
  colunas: string[];
  linhas: string[][];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.tituloPrincipal}>{titulo}</Text>
        <Text style={styles.subtitulo}>{subtitulo} · Gerado em {geradoEm}</Text>

        {linhas.length === 0 ? (
          <Text style={styles.semDados}>Nenhum registro encontrado.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader} fixed>
              {colunas.map((c, i) => (
                <Text key={i} style={styles.celulaHeader}>
                  {c}
                </Text>
              ))}
            </View>
            {linhas.map((linha, i) => (
              <View key={i} style={styles.linha} wrap={false}>
                {linha.map((v, j) => (
                  <Text key={j} style={styles.celula}>
                    {v || "—"}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape} fixed>
          Fleet Network Intelligence — Gestão de Frotas FNI · {linhas.length} registro{linhas.length === 1 ? "" : "s"}
        </Text>
      </Page>
    </Document>
  );
}
