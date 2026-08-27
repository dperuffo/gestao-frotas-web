import { Circle, Document, G, Line, Page, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import {
  CONTATOS_EMERGENCIA,
  categoriaRiscoLabel,
  categoriaParadaLabel,
  resolverLinhaDoTempo,
  type RotogramaRisco,
  type RotogramaParada,
} from "../tipos";

const CORES_RISCO_HEX_PDF: Record<string, string> = {
  perigo: "#ef4444",
  crime: "#be123c",
  radar: "#f59e0b",
};
const COR_PARADA_HEX_PDF = "#06b6d4";

const CORES_RISCO_PDF: Record<RotogramaRisco["categoria"], { bg: string; borda: string; texto: string }> = {
  perigo: { bg: "#FEF2F2", borda: "#FECACA", texto: "#B91C1C" },
  crime: { bg: "#FFE4E6", borda: "#FDA4AF", texto: "#9F1239" },
  radar: { bg: "#FFFBEB", borda: "#FDE68A", texto: "#B45309" },
};
const COR_PARADA_PDF = { bg: "#F0F0F0", borda: "#CCCCCC", texto: "#404040" };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 16 },
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  infoBox: { flex: 1, minWidth: 100, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  infoValor: { fontSize: 10, fontWeight: 700, color: "#1e293b" },
  secao: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8, color: "#283593" },
  item: { borderRadius: 4, borderWidth: 1, borderStyle: "solid", padding: 8, marginBottom: 6 },
  itemLocal: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  itemDescricao: { fontSize: 9 },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
  emergenciaBox: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  emergenciaItem: { backgroundColor: "#0f172a", borderRadius: 4, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center" },
  emergenciaNome: { fontSize: 7, color: "#cbd5e1", textTransform: "uppercase" },
  emergenciaNumero: { fontSize: 14, fontWeight: 700, color: "#ffffff" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
  linhaDoTempoLegenda: { fontSize: 8, color: "#94a3b8", marginTop: 4, fontStyle: "italic" },
});

// Mesma técnica de layout (posição proporcional por Km, com fallback pra
// extrair do texto ou distribuir igualmente) do componente da tela
// (LinhaDoTempoRotograma.tsx) — via resolverLinhaDoTempo, pra ficar
// idêntico no PDF e na visualização.
function truncarPdf(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Documento PDF do Rotograma de Segurança — para o motorista levar impresso
// ou no celular durante a viagem. Mesma técnica 100% client-side de
// @react-pdf/renderer usada nas Fases 15/16.
function LinhaDoTempoPdf({
  origem,
  destino,
  riscos,
  paradas,
}: {
  origem: string;
  destino: string;
  riscos: RotogramaRisco[];
  paradas: RotogramaParada[];
}) {
  const pontos = resolverLinhaDoTempo(riscos, paradas);
  if (pontos.length === 0) return null;

  const kmMaximo = Math.max(...pontos.map((p) => p.km), 1);
  const largura = 531;
  const altura = 150;
  const margem = 50;
  const yLinha = altura / 2;
  const x = (km: number) => margem + Math.min(1, Math.max(0, km / kmMaximo)) * (largura - margem * 2);

  const riscosPontos = pontos.filter((p) => p.tipo === "risco");
  const paradasPontos = pontos.filter((p) => p.tipo === "parada");

  return (
    <View>
      <Text style={styles.secao}>🗺️ Linha do tempo da viagem</Text>
      <Svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: largura, height: altura }}>
        <Line x1={margem} y1={yLinha} x2={largura - margem} y2={yLinha} stroke="#cbd5e1" strokeWidth={2} />

        <Circle cx={margem} cy={yLinha} r={5} fill="#16a34a" />
        <Text x={margem} y={yLinha + 20} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700 }}>
          Origem
        </Text>
        <Text x={margem} y={yLinha + 31} textAnchor="middle" style={{ fontSize: 7, fill: "#64748b" }}>
          {truncarPdf(origem, 18)}
        </Text>

        <Circle cx={largura - margem} cy={yLinha} r={5} fill="#dc2626" />
        <Text x={largura - margem} y={yLinha + 20} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700 }}>
          Destino
        </Text>
        <Text x={largura - margem} y={yLinha + 31} textAnchor="middle" style={{ fontSize: 7, fill: "#64748b" }}>
          {truncarPdf(destino, 18)}
        </Text>

        {riscosPontos.map((p, i) => {
          const cx = x(p.km);
          const stem = 28 + (i % 2) * 16;
          const cor = CORES_RISCO_HEX_PDF[p.categoria] ?? CORES_RISCO_HEX_PDF.perigo;
          return (
            <G key={`r-${i}`}>
              <Line x1={cx} y1={yLinha} x2={cx} y2={yLinha - stem} stroke={cor} strokeWidth={1} />
              <Circle cx={cx} cy={yLinha - stem} r={4} fill={cor} />
              <Text x={cx} y={yLinha - stem - 6} textAnchor="middle" style={{ fontSize: 6.5, fontWeight: 700 }}>
                {truncarPdf(p.local, 14)}
              </Text>
            </G>
          );
        })}

        {paradasPontos.map((p, i) => {
          const cx = x(p.km);
          const stem = 28 + (i % 2) * 16;
          return (
            <G key={`p-${i}`}>
              <Line x1={cx} y1={yLinha} x2={cx} y2={yLinha + stem} stroke={COR_PARADA_HEX_PDF} strokeWidth={1} />
              <Circle cx={cx} cy={yLinha + stem} r={4} fill={COR_PARADA_HEX_PDF} />
              <Text x={cx} y={yLinha + stem + 12} textAnchor="middle" style={{ fontSize: 6.5, fontWeight: 700 }}>
                {truncarPdf(p.local, 14)}
              </Text>
            </G>
          );
        })}
      </Svg>
      {pontos.some((p) => p.kmEstimado) && (
        <Text style={styles.linhaDoTempoLegenda}>
          Alguns pontos tiveram o Km estimado por falta de preenchimento — posição aproximada.
        </Text>
      )}
    </View>
  );
}

export function RotogramaPdf({
  origem,
  destino,
  motorista,
  placa,
  dataViagem,
  numero,
  riscos,
  paradas,
  geradoEm,
}: {
  origem: string;
  destino: string;
  motorista?: string;
  placa?: string;
  dataViagem?: string;
  numero: number;
  riscos: RotogramaRisco[];
  paradas: RotogramaParada[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Rotograma de Segurança #{numero}</Text>
        <Text style={styles.subtitulo}>
          {origem} → {destino} · Fleet Network Intelligence
        </Text>

        <View style={styles.infoRow}>
          {motorista && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Motorista</Text>
              <Text style={styles.infoValor}>{motorista}</Text>
            </View>
          )}
          {placa && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Placa</Text>
              <Text style={styles.infoValor}>{placa}</Text>
            </View>
          )}
          {dataViagem && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Data da viagem</Text>
              <Text style={styles.infoValor}>{dataViagem}</Text>
            </View>
          )}
        </View>

        <LinhaDoTempoPdf origem={origem} destino={destino} riscos={riscos} paradas={paradas} />

        <Text style={styles.secao}>⚠️ Pontos de risco</Text>
        {riscos.length === 0 ? (
          <Text style={styles.semDados}>Nenhum ponto de risco cadastrado.</Text>
        ) : (
          riscos.map((r, i) => {
            const cor = CORES_RISCO_PDF[r.categoria] ?? CORES_RISCO_PDF.perigo;
            return (
              <View key={i} style={[styles.item, { backgroundColor: cor.bg, borderColor: cor.borda }]}>
                <Text style={styles.itemLocal}>{r.local}</Text>
                <Text style={[styles.itemDescricao, { color: cor.texto }]}>
                  {categoriaRiscoLabel(r.categoria)}
                  {r.descricao ? ` · ${r.descricao}` : ""}
                </Text>
              </View>
            );
          })
        )}

        <Text style={styles.secao}>📍 Pontos de parada</Text>
        {paradas.length === 0 ? (
          <Text style={styles.semDados}>Nenhuma parada cadastrada.</Text>
        ) : (
          paradas.map((p, i) => (
            <View key={i} style={[styles.item, { backgroundColor: COR_PARADA_PDF.bg, borderColor: COR_PARADA_PDF.borda }]}>
              <Text style={styles.itemLocal}>{p.local}</Text>
              <Text style={[styles.itemDescricao, { color: COR_PARADA_PDF.texto }]}>
                {categoriaParadaLabel(p.categoria)}
                {p.descricao ? ` · ${p.descricao}` : ""}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.secao}>☎️ Contatos de emergência</Text>
        <View style={styles.emergenciaBox}>
          {CONTATOS_EMERGENCIA.map((c) => (
            <View key={c.nome} style={styles.emergenciaItem}>
              <Text style={styles.emergenciaNome}>{c.nome}</Text>
              <Text style={styles.emergenciaNumero}>{c.numero}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.rodape}>Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI</Text>
      </Page>
    </Document>
  );
}
