import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type KpiRota = { label: string; valor: string };
export type ComparativoLinhaPdf = { nome: string; custo: string; paradas: string; litros: string; grade: string };
export type ParadaLinhaPdf = {
  numero: string;
  posto: string;
  municipioUf: string;
  km: string;
  precoLitro: string;
  litros: string;
  custo: string;
  nivelApos: string;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  secao: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8, color: "#283593" },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 4, flexWrap: "wrap" },
  kpiBox: { flex: 1, minWidth: 100, backgroundColor: "#E8EAF6", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: "#3949AB", marginBottom: 2 },
  kpiValor: { fontSize: 13, fontWeight: 700, color: "#1A237E" },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", borderStyle: "solid" },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderStyle: "solid" },
  celulaHeader: { flex: 1, padding: 5, fontSize: 8, fontWeight: 700, color: "#475569" },
  celula: { flex: 1, padding: 5, fontSize: 8 },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
});

// Documento PDF do relatório de rota (aba Roteirização → Resumo) — mesma
// técnica do Relatório Executivo (Fase 15): @react-pdf/renderer 100%
// client-side, sem headless browser.
export function RelatorioRotaPdf({
  origemLabel,
  destinoLabel,
  placa,
  kpis,
  comparativo,
  paradas,
  geradoEm,
}: {
  origemLabel: string;
  destinoLabel: string;
  placa?: string;
  kpis: KpiRota[];
  comparativo: ComparativoLinhaPdf[];
  paradas: ParadaLinhaPdf[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Relatório de Roteirização</Text>
        <Text style={styles.subtitulo}>
          {origemLabel} → {destinoLabel}
          {placa ? ` · Veículo ${placa}` : ""} · Fleet Network Intelligence
        </Text>

        <Text style={styles.secao}>Resumo da viagem</Text>
        <View style={styles.kpiRow}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={styles.kpiValor}>{k.valor}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.secao}>Comparativo de estratégias</Text>
        {comparativo.length === 0 ? (
          <Text style={styles.semDados}>Sem dados suficientes para comparar estratégias.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader}>
              <Text style={styles.celulaHeader}>Estratégia</Text>
              <Text style={styles.celulaHeader}>Custo</Text>
              <Text style={styles.celulaHeader}>Paradas</Text>
              <Text style={styles.celulaHeader}>Litros</Text>
              <Text style={styles.celulaHeader}>Grade média</Text>
            </View>
            {comparativo.map((c) => (
              <View key={c.nome} style={styles.linha}>
                <Text style={styles.celula}>{c.nome}</Text>
                <Text style={styles.celula}>{c.custo}</Text>
                <Text style={styles.celula}>{c.paradas}</Text>
                <Text style={styles.celula}>{c.litros}</Text>
                <Text style={styles.celula}>{c.grade}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.secao}>Paradas de abastecimento sugeridas</Text>
        {paradas.length === 0 ? (
          <Text style={styles.semDados}>Alcance do veículo cobre a rota sem precisar abastecer.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaHeader}>
              <Text style={[styles.celulaHeader, { flex: 0.4 }]}>#</Text>
              <Text style={[styles.celulaHeader, { flex: 2 }]}>Posto</Text>
              <Text style={styles.celulaHeader}>Município/UF</Text>
              <Text style={styles.celulaHeader}>Km</Text>
              <Text style={styles.celulaHeader}>R$/L</Text>
              <Text style={styles.celulaHeader}>Litros</Text>
              <Text style={styles.celulaHeader}>Custo</Text>
              <Text style={styles.celulaHeader}>Nível após</Text>
            </View>
            {paradas.map((p) => (
              <View key={p.numero} style={styles.linha}>
                <Text style={[styles.celula, { flex: 0.4 }]}>{p.numero}</Text>
                <Text style={[styles.celula, { flex: 2 }]}>{p.posto}</Text>
                <Text style={styles.celula}>{p.municipioUf}</Text>
                <Text style={styles.celula}>{p.km}</Text>
                <Text style={styles.celula}>{p.precoLitro}</Text>
                <Text style={styles.celula}>{p.litros}</Text>
                <Text style={styles.celula}>{p.custo}</Text>
                <Text style={styles.celula}>{p.nivelApos}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape}>Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI</Text>
      </Page>
    </Document>
  );
}
