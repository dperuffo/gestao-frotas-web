import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ItemExtratoFaturaPdf = {
  data: string;
  motorista: string;
  placa: string;
  combustivel: string;
  litros: number;
  precoUnitario: number;
  valorTotal: number;
};

// Fase 27.92 — cedente (posto, credor) e sacado (cliente, devedor), com CNPJ
// e endereço completos — mesmos campos de um boleto bancário real, sem o
// código de barras/linha digitável (decisão do Daniel: documento
// informativo, não boleto bancário registrado).
export type ParteBoletoPdf = {
  nome: string;
  cnpj: string;
  endereco: string;
};

function formatarMoedaPdf(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

  pixRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 16, backgroundColor: "#F0FDF4", borderRadius: 4, padding: 10 },
  pixQr: { width: 80, height: 80 },
  pixLabel: { fontSize: 9, fontWeight: 700, color: "#166534", marginBottom: 2 },
  pixTexto: { fontSize: 8, color: "#166534" },

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
  totalRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 8, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderTopStyle: "solid" },
  totalLabel: { fontSize: 9, fontWeight: 700, color: "#1e293b", marginRight: 8 },
  totalValor: { fontSize: 11, fontWeight: 700, color: "#1A237E" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

// Fase 27.76 — pedido do Daniel: extrato dos abastecimentos incluídos na
// fatura, com PDF gerado 100% client-side (@react-pdf/renderer), mesma
// técnica já usada em Rotograma/Roteirização/Relatórios/Assistente.
//
// Fase 27.92 — pedido do Daniel: documento no estilo boleto (baseado num PDF
// de referência anexado), pra ficar disponível ao cliente ao fechar cada
// ciclo, pra download/pagamento/quitação: número da fatura, cedente (posto)
// e sacado (cliente) com CNPJ/endereço, e QR Code PIX pra pagamento — sem
// código de barras/linha digitável (documento informativo, não é um boleto
// bancário registrado; decisão tomada com o Daniel).
export function FaturaPdf({
  numeroFatura,
  cedente,
  sacado,
  periodoInicio,
  periodoFim,
  vencimento,
  status,
  valorTotal,
  volumeTotal,
  quantidadeAbastecimentos,
  itens,
  qrCodePixDataUrl,
  geradoEm,
}: {
  numeroFatura: number;
  cedente: ParteBoletoPdf;
  sacado: ParteBoletoPdf;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  status: string;
  valorTotal: number;
  volumeTotal: number;
  quantidadeAbastecimentos: number;
  itens: ItemExtratoFaturaPdf[];
  qrCodePixDataUrl?: string | null;
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Documento de Cobrança</Text>
        <Text style={styles.subtitulo}>Fleet Network Intelligence — Gestão de Frotas FNI</Text>
        <Text style={styles.numeroFatura}>Nº da fatura: {String(numeroFatura).padStart(6, "0")}</Text>

        <View style={styles.partesRow}>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Cedente (posto)</Text>
            <Text style={styles.parteNome}>{cedente.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {cedente.cnpj || "—"}</Text>
            <Text style={styles.parteLinha}>{cedente.endereco || "—"}</Text>
          </View>
          <View style={styles.parteBox}>
            <Text style={styles.parteLabel}>Sacado (cliente)</Text>
            <Text style={styles.parteNome}>{sacado.nome}</Text>
            <Text style={styles.parteLinha}>CNPJ: {sacado.cnpj || "—"}</Text>
            <Text style={styles.parteLinha}>{sacado.endereco || "—"}</Text>
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
            <Text style={styles.infoLabel}>Volume total</Text>
            <Text style={styles.infoValor}>{volumeTotal.toLocaleString("pt-BR")} L</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Valor cobrado</Text>
            <Text style={styles.infoValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

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
              O posto ainda não cadastrou uma chave PIX — pagamento a combinar diretamente com {cedente.nome}.
            </Text>
          </View>
        )}

        <Text style={styles.secao}>
          Detalhamento do abastecimento ({quantidadeAbastecimentos})
        </Text>
        <Text style={{ fontSize: 8, color: "#64748b", marginBottom: 8, marginTop: -4 }}>
          Abastecimentos realizados no período que justificam o valor total cobrado.
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
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValor}>{formatarMoedaPdf(valorTotal)}</Text>
          </View>
        </View>

        <Text style={styles.rodape}>
          Documento informativo — não é um boleto bancário registrado. Gerado em {geradoEm} · Fleet
          Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
