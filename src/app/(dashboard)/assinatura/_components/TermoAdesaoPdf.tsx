import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { TERMO_ADESAO_PARAGRAFOS, VERSAO_TERMO_ADESAO } from "@/lib/termoAdesao";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 9, color: "#64748b", marginBottom: 14 },
  capa: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid", borderRadius: 4, padding: 10, marginBottom: 14 },
  capaLinha: { flexDirection: "row", marginBottom: 3 },
  capaLabel: { width: 130, fontSize: 8, fontWeight: 700, color: "#475569" },
  capaValor: { flex: 1, fontSize: 8, color: "#1e293b" },
  secaoTitulo: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4, color: "#283593" },
  paragrafo: { fontSize: 8.5, lineHeight: 1.5, marginBottom: 5, textAlign: "justify" },
  rodape: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#94a3b8", textAlign: "center" },
});

// Comprovante de adesão em PDF — gerado no client (mesmo padrão de todos os
// outros PDFs do app, via @react-pdf/renderer) no momento em que o cliente
// clica "Aceito os Termos de Adesão", ANTES de seguir pro checkout do
// Stripe. É personalizado por adesão: razão social, CNPJ, e-mail, plano
// escolhido, data/hora, IP e o hash do texto aceito ficam registrados na
// "capa" do documento, seguidos do texto integral do Termo de Adesão.
export function TermoAdesaoPdf({
  nomeEmpresa,
  cnpj,
  email,
  planoLabel,
  precoLabel,
  dataHoraAceite,
  ip,
  hashTermo,
}: {
  nomeEmpresa: string;
  cnpj: string | null;
  email: string;
  planoLabel: string;
  precoLabel: string;
  dataHoraAceite: string;
  ip: string | null;
  hashTermo: string;
}) {
  // Cada item de TERMO_ADESAO_PARAGRAFOS que começa com "PARTE" é tratado
  // como um título de seção (fonte maior, cor de destaque); os demais são
  // parágrafos normais. Linhas vazias viram um pequeno espaçamento.
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tituloPrincipal}>Comprovante de Adesão Eletrônica</Text>
        <Text style={styles.subtitulo}>FNI Gestão de Frotas · Fleet Network Intelligence LTDA.</Text>

        <View style={styles.capa}>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Razão social / Nome</Text>
            <Text style={styles.capaValor}>{nomeEmpresa}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>CNPJ / CPF</Text>
            <Text style={styles.capaValor}>{cnpj ?? "—"}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>E-mail de acesso</Text>
            <Text style={styles.capaValor}>{email}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Plano escolhido</Text>
            <Text style={styles.capaValor}>{planoLabel} — {precoLabel}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Data e hora da adesão</Text>
            <Text style={styles.capaValor}>{dataHoraAceite}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Endereço IP</Text>
            <Text style={styles.capaValor}>{ip ?? "—"}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Versão do termo aceito</Text>
            <Text style={styles.capaValor}>{VERSAO_TERMO_ADESAO}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Hash do termo (SHA-256)</Text>
            <Text style={styles.capaValor}>{hashTermo}</Text>
          </View>
          <View style={styles.capaLinha}>
            <Text style={styles.capaLabel}>Aceite eletrônico</Text>
            <Text style={styles.capaValor}>Registrado automaticamente pela plataforma FNI</Text>
          </View>
        </View>

        {TERMO_ADESAO_PARAGRAFOS.map((p, i) =>
          p === "" ? (
            <View key={i} style={{ height: 4 }} />
          ) : p.startsWith("PARTE") ? (
            <Text key={i} style={styles.secaoTitulo}>{p}</Text>
          ) : (
            <Text key={i} style={styles.paragrafo}>{p}</Text>
          )
        )}

        <Text style={styles.rodape}>
          Comprovante gerado eletronicamente pela plataforma FNI Gestão de Frotas em {dataHoraAceite} · fxgestaodefrotasonline.com
        </Text>
      </Page>
    </Document>
  );
}
