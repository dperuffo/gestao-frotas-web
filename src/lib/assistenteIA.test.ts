import { describe, expect, it } from "vitest";
import { validarBlocoVisual } from "./assistenteIA";

const base = { tipo: "barras", titulo: "Custo por veículo", formato: "moeda", categorias: ["A", "B"], series: [{ nome: "Custo", valores: [10, 20] }] };

describe("validarBlocoVisual", () => {
  it("aceita um gráfico válido", () => {
    const r = validarBlocoVisual(base);
    expect(typeof r).toBe("object");
  });
  it("rejeita tipo inválido, série com tamanho errado e valores não numéricos", () => {
    expect(typeof validarBlocoVisual({ ...base, tipo: "radar" })).toBe("string");
    expect(typeof validarBlocoVisual({ ...base, series: [{ nome: "x", valores: [1] }] })).toBe("string");
    expect(typeof validarBlocoVisual({ ...base, series: [{ nome: "x", valores: [1, "abc"] }] })).toBe("string");
    expect(typeof validarBlocoVisual({ ...base, titulo: "" })).toBe("string");
  });
  it("pizza mantém só a primeira série e formato desconhecido vira numero", () => {
    const r = validarBlocoVisual({ ...base, tipo: "pizza", formato: "xyz", series: [base.series[0], { nome: "2", valores: [1, 2] }] });
    expect(typeof r === "object" && r.series.length).toBe(1);
    expect(typeof r === "object" && r.formato).toBe("numero");
  });
});
