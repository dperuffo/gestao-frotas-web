import { describe, it, expect } from "vitest";
import { agruparPorPosto, agruparPorSemana, inicioSemana, maioresDesvios, resumir, sugerirPostosMelhores, type RegistroAnp } from "./precoAnpDetalhe";

const r = (o: Partial<RegistroAnp>): RegistroAnp => ({
  id: "1", d: "2026-11-02", pl: "AAA1A11", mo: "X", pc: "P1", pn: "Posto 1", mu: "SAO PAULO", uf: "SP",
  pr: "Gasolina Comum", ct: "GASOLINA COMUM", l: 100, v: 600, rf: 5.5, nv: "municipio", ...o,
});

describe("precoAnpDetalhe", () => {
  it("resume impacto: pago 600 vs ref 550 => +50 (acima)", () => {
    const s = resumir([r({})]);
    expect(s.impacto).toBeCloseTo(50);
    expect(s.pct).toBeCloseTo(9.09, 1);
  });
  it("agrupa por posto e ordena pelo maior impacto", () => {
    const l = agruparPorPosto([r({ pc: "P1", pn: "A" }), r({ pc: "P2", pn: "B", v: 700 })]);
    expect(l[0].rotulo).toBe("B");
    expect(l[0].impacto).toBeCloseTo(150);
  });
  it("semana começa na segunda", () => {
    expect(inicioSemana("2026-11-02")).toBe("2026-11-02"); // segunda
    expect(inicioSemana("2026-11-08")).toBe("2026-11-02"); // domingo
  });
  it("agrupa por semana em ordem cronológica", () => {
    const l = agruparPorSemana([r({ d: "2026-11-10" }), r({ d: "2026-11-03" })]);
    expect(l.map((x) => x.chave)).toEqual(["2026-11-02", "2026-11-09"]);
  });
  it("maiores desvios ignora quem pagou abaixo da ANP", () => {
    const d = maioresDesvios([r({ v: 500 }), r({ id: "2", v: 650 })]);
    expect(d).toHaveLength(1);
    expect(d[0].id).toBe("2");
  });
  it("sugere o posto mais barato da mesma cidade", () => {
    const s = sugerirPostosMelhores([r({ pc: "P1", pn: "Caro", v: 650 }), r({ id: "2", pc: "P2", pn: "Barato", v: 550 })]);
    expect(s).toHaveLength(1);
    expect(s[0].melhorPosto).toBe("Barato");
    expect(s[0].economia).toBeCloseTo(100);
  });
  it("não sugere quando a amostra do melhor posto é pequena", () => {
    const s = sugerirPostosMelhores([r({ pc: "P1", v: 650 }), r({ id: "2", pc: "P2", l: 10, v: 50 })]);
    expect(s).toHaveLength(0);
  });
});
