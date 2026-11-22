import { Circle, G, Path, Rect, Svg, Text as SvgText, Line as SvgLine, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BlocoVisual } from "@/lib/assistenteIA";
import { formatarValor } from "@/lib/assistenteFormato";

// Desenha no PDF o mesmo gráfico/tabela mostrado na tela (barras, linhas, pizza, tabela),
// com primitivas SVG do @react-pdf/renderer — vetorial, nítido e sem capturar a tela.
const CORES = ["#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
const LARGURA = 500;
const MAX_CATEGORIAS = 40;

const st = StyleSheet.create({
  caixa: { marginTop: 6, marginBottom: 4, padding: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderStyle: "solid", borderColor: "#CBD5E1", borderRadius: 4 },
  titulo: { fontSize: 9, fontWeight: 700, color: "#0f172a", marginBottom: 6 },
  nota: { fontSize: 7, color: "#94a3b8", marginTop: 3 },
  tabela: { borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "solid" },
  linhaHeader: { flexDirection: "row", backgroundColor: "#e2e8f0" },
  linha: { flexDirection: "row", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#e2e8f0" },
  celulaItem: { flex: 2, padding: 3, fontSize: 7.5 },
  celula: { flex: 1, padding: 3, fontSize: 7.5, textAlign: "right" },
});

const corta = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function Legenda({ nomes }: { nomes: string[] }) {
  return (
    <G>
      {nomes.map((n, i) => (
        <G key={n}>
          <Rect x={i * 120} y={0} width={8} height={8} fill={CORES[i % CORES.length]} />
          <SvgText x={i * 120 + 12} y={7} style={{ fontSize: 7, fill: "#475569" }}>
            {corta(n, 20)}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

function Barras({ bloco }: { bloco: BlocoVisual }) {
  const cats = bloco.categorias.slice(0, MAX_CATEGORIAS);
  const n = bloco.series.length;
  const rowH = Math.max(n * 8 + 6, cats.length > 25 ? 14 : 20);
  const rotuloW = 120;
  const valorW = 70;
  const areaW = LARGURA - rotuloW - valorW;
  const topo = n > 1 ? 16 : 0;
  const max = Math.max(1, ...bloco.series.flatMap((s) => s.valores.slice(0, MAX_CATEGORIAS).map((v) => Math.max(0, v))));
  const altura = topo + cats.length * rowH + 4;
  return (
    <Svg width={LARGURA} height={altura} viewBox={`0 0 ${LARGURA} ${altura}`}>
      {n > 1 && <Legenda nomes={bloco.series.map((s) => s.nome)} />}
      {cats.map((c, i) => {
        const y0 = topo + i * rowH;
        const h = (rowH - 6) / n;
        return (
          <G key={`${c}-${i}`}>
            <SvgText x={rotuloW - 6} y={y0 + rowH / 2 + 2} style={{ fontSize: 7.5, fill: "#334155" }} textAnchor="end">
              {corta(c, 24)}
            </SvgText>
            {bloco.series.map((s, k) => {
              const v = Math.max(0, s.valores[i] ?? 0);
              const w = (v / max) * areaW;
              return (
                <G key={s.nome}>
                  <Rect x={rotuloW} y={y0 + 2 + k * h} width={Math.max(w, 0.5)} height={Math.max(h - 1, 2)} fill={CORES[k % CORES.length]} />
                  <SvgText x={rotuloW + w + 4} y={y0 + 2 + k * h + Math.max(h - 1, 2) - 1} style={{ fontSize: 7, fill: "#475569" }}>
                    {formatarValor(s.valores[i] ?? 0, bloco.formato)}
                  </SvgText>
                </G>
              );
            })}
          </G>
        );
      })}
    </Svg>
  );
}

function Linhas({ bloco }: { bloco: BlocoVisual }) {
  const altura = 230;
  const esq = 70;
  const dir = 26;
  const topo = bloco.series.length > 1 ? 20 : 8;
  const base = 36;
  const w = LARGURA - esq - dir;
  const h = altura - topo - base;
  const todos = bloco.series.flatMap((s) => s.valores);
  const max = Math.max(1, ...todos);
  const min = Math.min(0, ...todos);
  const faixa = max - min || 1;
  const nCat = bloco.categorias.length;
  const x = (i: number) => esq + (nCat <= 1 ? w / 2 : (i / (nCat - 1)) * w);
  const y = (v: number) => topo + h - ((v - min) / faixa) * h;
  const passo = Math.max(1, Math.ceil(nCat / 8));
  const ticks = [0, 1, 2, 3, 4].map((t) => min + (faixa * t) / 4);
  return (
    <Svg width={LARGURA} height={altura} viewBox={`0 0 ${LARGURA} ${altura}`}>
      {bloco.series.length > 1 && <Legenda nomes={bloco.series.map((s) => s.nome)} />}
      {ticks.map((t, i) => (
        <G key={i}>
          <SvgLine x1={esq} y1={y(t)} x2={esq + w} y2={y(t)} stroke="#e2e8f0" strokeWidth={0.5} />
          <SvgText x={esq - 4} y={y(t) + 2.5} style={{ fontSize: 7, fill: "#64748b" }} textAnchor="end">
            {formatarValor(t, bloco.formato)}
          </SvgText>
        </G>
      ))}
      {bloco.categorias.map((c, i) =>
        i % passo === 0 ? (
          <SvgText key={i} x={x(i)} y={altura - base + 12} style={{ fontSize: 7, fill: "#64748b" }} textAnchor="middle">
            {corta(c, 12)}
          </SvgText>
        ) : null
      )}
      {bloco.series.map((s, k) => {
        const d = s.valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        return (
          <G key={s.nome}>
            <Path d={d} stroke={CORES[k % CORES.length]} strokeWidth={1.6} fill="none" />
            {nCat <= 24 && s.valores.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={1.8} fill={CORES[k % CORES.length]} />)}
          </G>
        );
      })}
    </Svg>
  );
}

function Pizza({ bloco }: { bloco: BlocoVisual }) {
  const cats = bloco.categorias.slice(0, 12);
  const valores = cats.map((_, i) => Math.max(0, bloco.series[0]?.valores[i] ?? 0));
  const total = valores.reduce((a, b) => a + b, 0) || 1;
  const cx = 100;
  const cy = 100;
  const r = 90;
  let ang = -Math.PI / 2;
  const fatias = valores.map((v, i) => {
    const frac = v / total;
    const ini = ang;
    ang += frac * Math.PI * 2;
    return { i, v, frac, ini, fim: ang };
  });
  const altura = Math.max(200, cats.length * 14 + 8);
  return (
    <Svg width={LARGURA} height={altura} viewBox={`0 0 ${LARGURA} ${altura}`}>
      {fatias.map((f) =>
        f.frac >= 0.9999 ? (
          <Circle key={f.i} cx={cx} cy={cy} r={r} fill={CORES[f.i % CORES.length]} />
        ) : f.frac > 0 ? (
          <Path
            key={f.i}
            d={`M${cx} ${cy} L${(cx + r * Math.cos(f.ini)).toFixed(2)} ${(cy + r * Math.sin(f.ini)).toFixed(2)} A${r} ${r} 0 ${f.frac > 0.5 ? 1 : 0} 1 ${(cx + r * Math.cos(f.fim)).toFixed(2)} ${(cy + r * Math.sin(f.fim)).toFixed(2)} Z`}
            fill={CORES[f.i % CORES.length]}
            stroke="#FFFFFF"
            strokeWidth={0.8}
          />
        ) : null
      )}
      {fatias.map((f) => (
        <G key={`l${f.i}`}>
          <Rect x={230} y={4 + f.i * 14} width={8} height={8} fill={CORES[f.i % CORES.length]} />
          <SvgText x={244} y={11 + f.i * 14} style={{ fontSize: 7.5, fill: "#334155" }}>
            {`${corta(cats[f.i], 26)} — ${formatarValor(f.v, bloco.formato)} (${(f.frac * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

function Tabela({ bloco }: { bloco: BlocoVisual }) {
  const cats = bloco.categorias.slice(0, 200);
  return (
    <View style={st.tabela}>
      <View style={st.linhaHeader} wrap={false}>
        <Text style={[st.celulaItem, { fontWeight: 700 }]}>Item</Text>
        {bloco.series.map((s) => (
          <Text key={s.nome} style={[st.celula, { fontWeight: 700 }]}>
            {s.nome}
          </Text>
        ))}
      </View>
      {cats.map((c, i) => (
        <View key={`${c}-${i}`} style={st.linha} wrap={false}>
          <Text style={st.celulaItem}>{c}</Text>
          {bloco.series.map((s) => (
            <Text key={s.nome} style={st.celula}>
              {formatarValor(s.valores[i] ?? 0, bloco.formato)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function GraficoPdf({ bloco }: { bloco: BlocoVisual }) {
  const truncado = bloco.tipo !== "tabela" && bloco.categorias.length > (bloco.tipo === "pizza" ? 12 : MAX_CATEGORIAS) && bloco.tipo !== "linhas";
  return (
    // Tabela pode atravessar páginas; gráficos (SVG) ficam inteiros na mesma página.
    <View style={st.caixa} wrap={bloco.tipo === "tabela"}>
      <Text style={st.titulo}>{bloco.titulo}</Text>
      {bloco.tipo === "tabela" ? <Tabela bloco={bloco} /> : bloco.tipo === "pizza" ? <Pizza bloco={bloco} /> : bloco.tipo === "linhas" ? <Linhas bloco={bloco} /> : <Barras bloco={bloco} />}
      {truncado && <Text style={st.nota}>Exibindo os primeiros itens de {bloco.categorias.length}. A lista completa está na tela.</Text>}
    </View>
  );
}
