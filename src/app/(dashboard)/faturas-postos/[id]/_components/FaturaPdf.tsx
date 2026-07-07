import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ItemExtratoFaturaPdf = {
  data: string;
  motorista: string;
  placa: string;
  combustivel: string;
  litros: number;
  precoUnitario: number;
  valorTotal: number;
};

function formatarMoedaPdf(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 16 },
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  infoBox: { flex: 1, minWidth: 100, backgroundColor: "#F1F5F9", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  infoValor: { fontSize: 11, fontWeight: 700, color: "#1e293b" },
  secao: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8, color: "#283593" },
  tabela: { borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 4 },
  linhaCabecalho: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 6 },
  linha: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
  },
  colData: { width: "16%" },
  colMotorista: { width: "22%" },
  colPlaca: { width: "12%" },
  colCombustivel: { width: "18%" },
  colLitros: { width: "10%", textAlign: "right" },
  colPreco: { width: "11%", textAlign: "right" },
  colValor: { width: "11%", textAlign: "right" },
  cabecalhoTexto: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: "#64748b" },
  semDados: { fontSize: 9, color: "#94a3b8", fontStyle: "italic", padding: 8 },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

// Fase 27.76 — pedido do Daniel: cada fatura precisa trazer um extrato dos
// abastecimentos incluídos no período, e o usuário (cliente ou posto) pode
// gerar um PDF com os dados da fatura + abastecimentos. Mesma técnica
// 100% client-side de @react-pdf/renderer já usada em Rotograma/Roteirização/
// Relatórios/Assistente (Fases 15/16 em diante).
export function FaturaPdf({
  postoNome,
  clienteNome,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  volumeTotal,
  quantidadeAbastecimentos,
  itens,
  geradoEm,
}: {
  postoNome: string;
  clienteNome: string;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  volumeTotal: number;
  quantidadeAbastecimentos: number;
  itens: ItemExtratoFaturaPdf[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Fatura — {postoNome}</Text>
        <Text style={styles.subtitulo}>
          Cliente: {clienteNome} · Fleet Network Intelligence
        </Text>

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
            <Text style={styles.infoLabel}>Volume total</Text>
            <Text style={styles.infoValor}>{volumeTotal.toLocaleString("pt-BR")} L</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Valor total</Text>
            <Text style={styles.infoValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        <Text style={styles.secao}>
          Extrato de abastecimentos ({quantidadeAbastecimentos})
        </Text>

        <View style={styles.tabela}>
          <View style={styles.linhaCabecalho}>
            <Text style={[styles.cabecalhoTexto, styles.colData]}>Data</Text>
            <Text style={[styles.cabecalhoTexto, styles.colMotorista]}>Motorista</Text>
            <Text style={[styles.cabecalhoTexto, styles.colPlaca]}>Placa</Text>
            <Text style={[styles.cabecalhoTexto, styles.colCombustivel]}>Combustível</Text>
            <Text style={[styles.cabecalhoTexto, styles.colLitros]}>Litros</Text>
            <Text style={[styles.cabecalhoTexto, styles.colPreco]}>Preço/L</Text>
            <Text style={[styles.cabecalhoTexto, styles.colValor]}>Valor</Text>
          </View>
          {itens.length === 0 ? (
            <Text style={styles.semDados}>Nenhum abastecimento encontrado neste período.</Text>
          ) : (
            itens.map((item, i) => (
              <View key={i} style={styles.linha}>
                <Text style={styles.colData}>{item.data}</Text>
                <Text style={styles.colMotorista}>{item.motorista}</Text>
                <Text style={styles.colPlaca}>{item.placa}</Text>
                <Text style={styles.colCombustivel}>{item.combustivel}</Text>
                <Text style={styles.colLitros}>{item.litros.toLocaleString("pt-BR")}</Text>
                <Text style={styles.colPreco}>{formatarMoedaPdf(item.precoUnitario)}</Text>
                <Text style={styles.colValor}>{formatarMoedaPdf(item.valorTotal)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.rodape}>Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI</Text>
      </Page>
    </Document>
  );
}
