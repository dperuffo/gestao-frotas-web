import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ReactNode } from "react";
import type { ConsultaExecutada } from "@/lib/assistenteIA";

export type MensagemPdf = {
  role: "user" | "assistant";
  content: string;
  consultas?: ConsultaExecutada[];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  tituloPrincipal: { fontSize: 18, fontWeight: 700, marginBottom: 2, color: "#1A237E" },
  subtitulo: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  bloco: { marginBottom: 10, borderRadius: 4, padding: 8 },
  blocoUsuario: { backgroundColor: "#EEF2FF", borderWidth: 1, borderStyle: "solid", borderColor: "#C7D2FE" },
  blocoAssistente: { backgroundColor: "#F1F5F9", borderWidth: 1, borderStyle: "solid", borderColor: "#E2E8F0" },
  autor: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", marginBottom: 4, color: "#475569" },
  paragrafo: { fontSize: 10, lineHeight: 1.4, marginBottom: 3 },
  linhaVazia: { height: 4 },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid", marginVertical: 4 },
  tabelaLinhaHeader: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    borderBottomStyle: "solid",
  },
  tabelaLinha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderBottomStyle: "solid" },
  tabelaCelulaHeader: { flex: 1, padding: 4, fontSize: 7.5, fontWeight: 700, color: "#334155" },
  tabelaCelula: { flex: 1, padding: 4, fontSize: 7.5 },
  consultasBox: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#CBD5E1" },
  consultasTitulo: { fontSize: 7.5, fontWeight: 700, color: "#64748b", marginBottom: 3, textTransform: "uppercase" },
  consultaItem: { fontSize: 7, color: "#64748b", marginBottom: 3, fontFamily: "Courier" },
  rodape: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

// Interpretador bem simples do markdown que o Claude costuma devolver nas
// respostas (**negrito** e tabelas em pipe "| col | col |") — @react-pdf/
// renderer não entende markdown, só JSX, então precisamos converter na mão.
// Não tenta cobrir markdown completo (listas, links, etc.), só o suficiente
// pra sair legível: negrito inline e tabelas viram tabelas de verdade em vez
// de texto corrido com barras.
function ehLinhaDeTabela(linha: string): boolean {
  const l = linha.trim();
  return l.startsWith("|") && l.endsWith("|") && l.length > 1;
}

function ehLinhaSeparadoraDeTabela(linha: string): boolean {
  const l = linha.trim();
  return ehLinhaDeTabela(l) && /^[|\-:\s]+$/.test(l) && l.includes("-");
}

function celulasDaLinha(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function TextoComNegrito({ linha, style }: { linha: string; style: Style }) {
  const partes = linha.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return (
    <Text style={style}>
      {partes.map((parte, i) => {
        const m = parte.match(/^\*\*(.+)\*\*$/);
        return m ? (
          <Text key={i} style={{ fontWeight: 700 }}>
            {m[1]}
          </Text>
        ) : (
          <Text key={i}>{parte}</Text>
        );
      })}
    </Text>
  );
}

function TabelaMarkdown({ linhas }: { linhas: string[] }) {
  const linhasValidas = linhas.filter((l) => !ehLinhaSeparadoraDeTabela(l));
  const linhasCelulas = linhasValidas.map(celulasDaLinha);
  const [cabecalho, ...corpo] = linhasCelulas;
  if (!cabecalho) return null;

  return (
    <View style={styles.tabela}>
      <View style={styles.tabelaLinhaHeader} wrap={false}>
        {cabecalho.map((c, i) => (
          <Text key={i} style={styles.tabelaCelulaHeader}>
            {c}
          </Text>
        ))}
      </View>
      {corpo.map((linha, i) => (
        <View key={i} style={styles.tabelaLinha} wrap={false}>
          {linha.map((c, j) => (
            <Text key={j} style={styles.tabelaCelula}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// Converte o texto de uma mensagem em blocos: parágrafos com negrito inline
// e tabelas markdown viram tabelas de verdade. Cada "bloco" pode quebrar de
// página normalmente (sem wrap={false} no nível do bloco inteiro) — respostas
// longas (ex.: tabela com 139 linhas) precisam poder continuar na página
// seguinte, senão o react-pdf sobrepõe o conteúdo em vez de paginar.
function ConteudoMensagem({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const blocos: ReactNode[] = [];
  let bufferTabela: string[] = [];
  let chave = 0;

  function flushTabela() {
    if (bufferTabela.length > 0) {
      blocos.push(<TabelaMarkdown key={`tabela-${chave++}`} linhas={bufferTabela} />);
      bufferTabela = [];
    }
  }

  for (const linha of linhas) {
    if (ehLinhaDeTabela(linha)) {
      bufferTabela.push(linha);
      continue;
    }
    flushTabela();
    if (!linha.trim()) {
      blocos.push(<View key={`vazio-${chave++}`} style={styles.linhaVazia} />);
    } else {
      blocos.push(<TextoComNegrito key={`linha-${chave++}`} linha={linha} style={styles.paragrafo} />);
    }
  }
  flushTabela();

  return <View>{blocos}</View>;
}

// Exportação em PDF do histórico de conversa do Assistente FNI (chat de
// perguntas/respostas). Mesmo padrão 100% client-side de @react-pdf/renderer
// já usado no Rotograma e nos Relatórios — sem dependência nova.
export function AssistentePdf({
  mensagens,
  geradoEm,
  usuarioEmail,
}: {
  mensagens: MensagemPdf[];
  geradoEm: string;
  usuarioEmail?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.tituloPrincipal}>Assistente FNI — Histórico da conversa</Text>
        <Text style={styles.subtitulo}>
          Fleet Network Intelligence — Gestão de Frotas{usuarioEmail ? ` · ${usuarioEmail}` : ""}
        </Text>

        {mensagens.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#94a3b8", fontStyle: "italic" }}>Nenhuma mensagem na conversa.</Text>
        ) : (
          mensagens.map((m, i) => (
            <View key={i} style={[styles.bloco, m.role === "user" ? styles.blocoUsuario : styles.blocoAssistente]}>
              <Text style={styles.autor}>{m.role === "user" ? "Você" : "Assistente FNI"}</Text>
              <ConteudoMensagem texto={m.content} />
              {m.consultas && m.consultas.length > 0 && (
                <View style={styles.consultasBox}>
                  <Text style={styles.consultasTitulo}>
                    {m.consultas.length} consulta{m.consultas.length > 1 ? "s" : ""} ao banco
                  </Text>
                  {m.consultas.map((c, j) => (
                    <Text key={j} style={styles.consultaItem}>
                      {c.erro ? `Erro: ${c.erro}` : `${c.linhas} linha(s)`} — {c.sql}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        <Text style={styles.rodape} fixed>
          Gerado em {geradoEm} · Fleet Network Intelligence — Gestão de Frotas FNI
        </Text>
      </Page>
    </Document>
  );
}
