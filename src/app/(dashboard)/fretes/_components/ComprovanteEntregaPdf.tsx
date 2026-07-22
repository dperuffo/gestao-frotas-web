import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Fase P0.4 — comprovante de entrega (canhoto digital), mesmo padrão visual
// de NotaFiscalPdf.tsx (Fase 27.94): PDF simplificado gerado a partir dos
// dados já confirmados pelo motorista, pra quem precisa de uma cópia
// imprimível/arquivável do canhoto + assinatura.

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  titulo: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 12 },
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  infoBox: { flex: 1, minWidth: 100, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  infoValor: { fontSize: 11, fontWeight: 700, color: "#1e293b" },
  secao: { fontSize: 12, fontWeight: 700, marginTop: 6, marginBottom: 8, color: "#283593" },
  imagensRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  imagemBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4, padding: 8 },
  imagemLabel: { fontSize: 7, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700 },
  imagem: { width: "100%", height: 160, objectFit: "contain" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

export function ComprovanteEntregaPdf({
  freteTitulo,
  origemLabel,
  destinoLabel,
  nomeRecebedor,
  documentoRecebedor,
  dataConfirmacao,
  fotoCanhotoUrl,
  assinaturaUrl,
  geradoEm,
}: {
  freteTitulo: string;
  origemLabel: string;
  destinoLabel: string;
  nomeRecebedor: string;
  documentoRecebedor: string | null;
  dataConfirmacao: string;
  fotoCanhotoUrl: string | null;
  assinaturaUrl: string | null;
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>Comprovante de Entrega</Text>
        <Text style={styles.subtitulo}>Canhoto digital — Fleet Network Intelligence</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Frete</Text>
            <Text style={styles.infoValor}>{freteTitulo}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Entregue em</Text>
            <Text style={styles.infoValor}>{dataConfirmacao}</Text>
          </View>
        </View>

        <Text style={styles.secao}>Rota</Text>
        <Text style={{ fontSize: 9, color: "#475569", marginBottom: 14 }}>
          {origemLabel} → {destinoLabel}
        </Text>

        <Text style={styles.secao}>Recebedor</Text>
        <Text style={{ fontSize: 9, color: "#475569", marginBottom: 14 }}>
          {nomeRecebedor}
          {documentoRecebedor ? `  ·  Documento: ${documentoRecebedor}` : ""}
        </Text>

        <Text style={styles.secao}>Evidências</Text>
        <View style={styles.imagensRow}>
          <View style={styles.imagemBox}>
            <Text style={styles.imagemLabel}>Foto do canhoto</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não HTML <img> */}
            {fotoCanhotoUrl ? <Image style={styles.imagem} src={fotoCanhotoUrl} /> : <Text style={{ fontSize: 8, color: "#94a3b8" }}>Sem foto</Text>}
          </View>
          <View style={styles.imagemBox}>
            <Text style={styles.imagemLabel}>Assinatura do recebedor</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não HTML <img> */}
            {assinaturaUrl ? <Image style={styles.imagem} src={assinaturaUrl} /> : <Text style={{ fontSize: 8, color: "#94a3b8" }}>Sem assinatura</Text>}
          </View>
        </View>

        <Text style={styles.rodape}>
          Documento informativo gerado a partir da confirmação de entrega registrada pelo motorista no aplicativo.
          Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
