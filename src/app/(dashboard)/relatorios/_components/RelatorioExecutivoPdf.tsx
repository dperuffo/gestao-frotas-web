import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type KpiExecutivo = { label: string; valor: string };
export type SavingLinha = { combustivel: string; precoGf: string; refMercado: string; saving: string; postos: string };
export type RiscoLinha = { tipo: string; qtd: string; detalhe: string };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  secao: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8, color: "#283593" },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  kpiBox: { flex: 1, backgroundColor: "#E8EAF6", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: "#3949AB", marginBottom: 2 },
  kpiValor: { fontSize: 14, fontWeight: 700, color: "#1A237E" },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", borderStyle: "solid" },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderStyle: "solid" },
  celulaHeader: { flex: 1, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569" },
  celula: { flex: 1, padding: 5, fontSize: 9 },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
});

// Documento PDF do Relatório Executivo Mensal — gerado 100% no client via
// @react-pdf/renderer (sem headless browser, funciona em qualquer host
// serverless). Todo o cálculo (KPIs, savings, riscos) já vem pronto da tela,
// esse componente só formata pra impressão.
export function RelatorioExecutivoPdf({
  nomeEmpresa,
  periodo,
  kpis,
  savings,
  riscos,
  geradoEm,
}: {
  nomeEmpresa: string;
  periodo: string;
  kpis: KpiExecutivo[];
  savings: SavingLinha[];
  riscos: RiscoLinha[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Relatório Executivo — {periodo}</Text>
        <Text style={styles.subtitulo}>{nomeEmpresa} · Fleet Network Intelligence</Text>

        <Text style={styles.secao}>KPIs do período</Text>
        <View style={styles.kpiRow}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={styles.kpiValor}>{k.valor}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.secao}>Savings estimados vs mercado</Text>
        {savings.length === 0 ? (
          <Text style={styles.semDados}>Sem dados suficientes para estimar savings neste período.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader}>
              <Text style={styles.celulaHeader}>Combustível</Text>
              <Text style={styles.celulaHeader}>Preço GF</Text>
              <Text style={styles.celulaHeader}>Ref. mercado (p75)</Text>
              <Text style={styles.celulaHeader}>Saving</Text>
              <Text style={styles.celulaHeader}>Postos</Text>
            </View>
            {savings.map((s) => (
              <View key={s.combustivel} style={styles.linha}>
                <Text style={styles.celula}>{s.combustivel}</Text>
                <Text style={styles.celula}>{s.precoGf}</Text>
                <Text style={styles.celula}>{s.refMercado}</Text>
                <Text style={styles.celula}>{s.saving}</Text>
                <Text style={styles.celula}>{s.postos}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.secao}>Alertas de risco</Text>
        {riscos.length === 0 ? (
          <Text style={styles.semDados}>Nenhum alerta de risco identificado para o período.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader}>
              <Text style={styles.celulaHeader}>Tipo</Text>
              <Text style={styles.celulaHeader}>Qtd</Text>
              <Text style={[styles.celulaHeader, { flex: 3 }]}>Detalhe</Text>
            </View>
            {riscos.map((r, i) => (
              <View key={`${r.tipo}__${i}`} style={styles.linha}>
                <Text style={styles.celula}>{r.tipo}</Text>
                <Text style={styles.celula}>{r.qtd}</Text>
                <Text style={[styles.celula, { flex: 3 }]}>{r.detalhe}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape}>Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI</Text>
      </Page>
    </Document>
  );
}
