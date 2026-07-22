import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ItemFaturaFretePdf = {
  numeroCte: string | null;
  serie: string | null;
  dataEmissao: string | null;
  chaveAcesso: string | null;
  valor: number;
};

export type ParteFaturaFretePdf = { nome: string; cnpj: string; endereco: string };

function formatarMoedaPdf(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase P0.6 (plano FNI_Plano_Implementacao_P0.md) — mesmo layout de
// FaturaPdf.tsx (faturas-postos), adaptado pra fatura de frete: cedente é a
// transportadora, sacado é o tomador do CT-e; o detalhamento lista os CT-es
// incluídos em vez de abastecimentos.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 4 },
  numeroFatura: { fontSize: 10, color: "#283593", fontWeight: 700, marginBottom: 16 },

  partesRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  parteBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4, padding: 8 },
  parteLabel: { fontSize: 7, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700 },
  parteNome: { fontSize: 10, fontWeight: 700, color: "#1e293b", marginBottom: 2 },
  parteLinha: { fontSize: 8, color: "#475569" },

  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  infoBox: { flex: 1, minWidth: 100, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  infoValor: { fontSize: 11, fontWeight: 700, color: "#1e293b" },

  boletoBox: { marginBottom: 10, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  boletoLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", marginBottom: 2 },
  boletoLinha: { fontSize: 9, fontFamily: "Courier", color: "#1e293b" },

  pixRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 16, backgroundColor: "#F0FDF4", borderRadius: 4, padding: 10 },
  pixQr: { width: 80, height: 80 },
  pixLabel: { fontSize: 9, fontWeight: 700, color: "#166534", marginBottom: 2 },
  pixTexto: { fontSize: 8, color: "#166534" },

  secao: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8, color: "#283593" },
  tabela: { borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4 },
  linhaCabecalho: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 6 },
  linha: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderTopStyle: "solid" },
  colNumero: { width: "16%" },
  colData: { width: "16%" },
  colChave: { width: "48%", fontSize: 7 },
  colValor: { width: "20%", textAlign: "right" },
  cabecalhoTexto: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: "#64748b" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic", padding: 8 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 8, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderTopStyle: "solid" },
  totalLabel: { fontSize: 9, fontWeight: 700, color: "#1e293b", marginRight: 8 },
  totalValor: { fontSize: 11, fontWeight: 700, color: "#1A237E" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

export function FaturaFretePdf({
  numeroFatura,
  cedente,
  sacado,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  itens,
  linhaDigitavelSimulada,
  qrCodePixDataUrl,
  geradoEm,
}: {
  numeroFatura: number;
  cedente: ParteFaturaFretePdf;
  sacado: ParteFaturaFretePdf;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  itens: ItemFaturaFretePdf[];
  linhaDigitavelSimulada?: string | null;
  qrCodePixDataUrl?: string | null;
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Fatura de Frete</Text>
        <Text style={styles.subtitulo}>Fleet Network Intelligence — Gestão de Frotas FNI</Text>
        <Text style={styles.numeroFatura}>Nº da fatura: {String(numeroFatura).padStart(6, "0")}</Text>

        <View style={styles.partesRow}>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Cedente (transportadora)</Text>
            <Text style={styles.parteNome}>{cedente.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {cedente.cnpj || "—"}</Text>
            <Text style={styles.parteLinha}>{cedente.endereco || "—"}</Text>
          </View>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Sacado (tomador do frete)</Text>
            <Text style={styles.parteNome}>{sacado.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {sacado.cnpj || "—"}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Período</Text>
            <Text style={styles.infoValor}>
              {periodoInicio} – {periodoFim}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Vencimento</Text>
            <Text style={styles.infoValor}>{vencimento}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValor}>{status}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Valor cobrado</Text>
            <Text style={styles.infoValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        {linhaDigitavelSimulada && (
          <View style={styles.boletoBox}>
            <Text style={styles.boletoLabel}>Linha digitável (SIMULADA — sem registro bancário real)</Text>
            <Text style={styles.boletoLinha}>{linhaDigitavelSimulada}</Text>
          </View>
        )}

        {qrCodePixDataUrl ? (
          <View style={styles.pixRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> aqui é do @react-pdf/renderer, não é <img> do DOM (não tem prop alt) */}
            <Image src={qrCodePixDataUrl} style={styles.pixQr} />
            <View>
              <Text style={styles.pixLabel}>Pague com PIX</Text>
              <Text style={styles.pixTexto}>Aponte a câmera do app do seu banco pro QR Code ao lado.</Text>
              <Text style={styles.pixTexto}>Valor: {formatarMoedaPdf(valorTotal)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.pixRow, { backgroundColor: "#FEF3C7" }]}>
            <Text style={{ fontSize: 8, color: "#92400e" }}>
              Cobrança ainda não gerada — clique em &quot;Gerar cobrança&quot; na tela da fatura pra criar o PIX/boleto.
            </Text>
          </View>
        )}

        <Text style={styles.secao}>CT-es incluídos ({itens.length})</Text>

        <View style={styles.tabela}>
          <View style={styles.linhaCabecalho}>
            <Text style={[styles.cabecalhoTexto, styles.colNumero]}>Nº / Série</Text>
            <Text style={[styles.cabecalhoTexto, styles.colData]}>Emissão</Text>
            <Text style={[styles.cabecalhoTexto, styles.colChave]}>Chave de acesso</Text>
            <Text style={[styles.cabecalhoTexto, styles.colValor]}>Valor</Text>
          </View>
          {itens.length === 0 ? (
            <Text style={styles.semDados}>Nenhum CT-e nesta fatura.</Text>
          ) : (
            itens.map((item, i) => (
              <View key={i} style={styles.linha}>
                <Text style={styles.colNumero}>
                  {item.numeroCte ?? "—"} / {item.serie ?? "—"}
                </Text>
                <Text style={styles.colData}>{item.dataEmissao ?? "—"}</Text>
                <Text style={styles.colChave}>{item.chaveAcesso ?? "—"}</Text>
                <Text style={styles.colValor}>{formatarMoedaPdf(item.valor)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        <Text style={styles.rodape}>
          Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
