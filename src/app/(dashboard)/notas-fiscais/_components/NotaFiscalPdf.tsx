import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

function formatarMoedaPdf(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarCnpjPdf(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  titulo: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 12 },

  partesRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  parteBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4, padding: 8 },
  parteLabel: { fontSize: 7, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700 },
  parteNome: { fontSize: 10, fontWeight: 700, color: "#1e293b", marginBottom: 2 },
  parteLinha: { fontSize: 8, color: "#475569" },

  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  infoBox: { flex: 1, minWidth: 100, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  infoValor: { fontSize: 11, fontWeight: 700, color: "#1e293b" },

  secao: { fontSize: 12, fontWeight: 700, marginTop: 6, marginBottom: 8, color: "#283593" },
  tabela: { borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4 },
  linhaCabecalho: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 6 },
  linha: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6 },
  colProduto: { width: "34%" },
  colAnp: { width: "30%" },
  colQtd: { width: "12%", textAlign: "right" },
  colPreco: { width: "12%", textAlign: "right" },
  colValor: { width: "12%", textAlign: "right" },
  cabecalhoTexto: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: "#64748b" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

// Fase 27.94 — pedido do Daniel: PDF simplificado (mesmo estilo do
// documento de cobrança da Fase 27.92) com os dados da NF-e já validada e
// vinculada ao abastecimento — cópia informativa pra conferência/impressão,
// não um DANFE oficial (a nota já foi autorizada pela SEFAZ; isto aqui só
// reúne os campos pra quem não tem o XML original em mãos).
export function NotaFiscalPdf({
  numeroNf,
  serieNf,
  chaveAcesso,
  dataEmissao,
  emitente,
  destinatario,
  produtoNome,
  produtoCodigoAnp,
  produtoDescricaoAnp,
  quantidade,
  valorUnitario,
  valorTotal,
  abastecimentoData,
  veiculoPlaca,
  motoristaNome,
  geradoEm,
}: {
  numeroNf: number;
  serieNf: string;
  chaveAcesso: string;
  dataEmissao: string;
  emitente: { nome: string; cnpj: string };
  destinatario: { nome: string; cnpj: string };
  produtoNome: string;
  produtoCodigoAnp: string;
  produtoDescricaoAnp: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  abastecimentoData: string;
  veiculoPlaca: string | null;
  motoristaNome: string | null;
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>NF-e — Venda de Combustível</Text>
        <Text style={styles.subtitulo}>
          Cópia informativa gerada a partir do XML autorizado pela SEFAZ — Fleet Network Intelligence
        </Text>

        <View style={styles.partesRow}>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Emitente (posto)</Text>
            <Text style={styles.parteNome}>{emitente.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {formatarCnpjPdf(emitente.cnpj)}</Text>
          </View>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Destinatário (cliente)</Text>
            <Text style={styles.parteNome}>{destinatario.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {formatarCnpjPdf(destinatario.cnpj)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Nº / Série</Text>
            <Text style={styles.infoValor}>
              {String(numeroNf).padStart(6, "0")} / {serieNf}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Emissão</Text>
            <Text style={styles.infoValor}>{dataEmissao}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Valor total</Text>
            <Text style={styles.infoValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 7, color: "#94a3b8", marginTop: -10, marginBottom: 14 }}>
          Chave de acesso: {chaveAcesso}
        </Text>

        <Text style={styles.secao}>Item de combustível</Text>
        <View style={styles.tabela}>
          <View style={styles.linhaCabecalho}>
            <Text style={[styles.cabecalhoTexto, styles.colProduto]}>Produto</Text>
            <Text style={[styles.cabecalhoTexto, styles.colAnp]}>Código ANP</Text>
            <Text style={[styles.cabecalhoTexto, styles.colQtd]}>Litros</Text>
            <Text style={[styles.cabecalhoTexto, styles.colPreco]}>Preço/L</Text>
            <Text style={[styles.cabecalhoTexto, styles.colValor]}>Valor</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.colProduto}>{produtoNome}</Text>
            <Text style={styles.colAnp}>
              {produtoCodigoAnp} — {produtoDescricaoAnp}
            </Text>
            <Text style={styles.colQtd}>{quantidade.toLocaleString("pt-BR")}</Text>
            <Text style={styles.colPreco}>{formatarMoedaPdf(valorUnitario)}</Text>
            <Text style={styles.colValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        <Text style={styles.secao}>Abastecimento documentado</Text>
        <Text style={{ fontSize: 9, color: "#475569" }}>
          Data: {abastecimentoData}
          {veiculoPlaca ? `  ·  Placa: ${veiculoPlaca}` : ""}
          {motoristaNome ? `  ·  Motorista: ${motoristaNome}` : ""}
        </Text>

        <Text style={styles.rodape}>
          Documento informativo, gerado a partir de uma NF-e modelo 55 já autorizada pela SEFAZ — não
          substitui o XML original. Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
