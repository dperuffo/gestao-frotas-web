import { describe, expect, it } from "vitest";
import { validarRegraConsumo, descreverRegraConsumo } from "./regraConsumo";

describe("validarRegraConsumo", () => {
  it("aceita marca com faixa válida", () => {
    const r = validarRegraConsumo({ marcaContem: " Fiat ", consumoMinimo: 9, consumoMaximo: 12 });
    expect(typeof r).toBe("object");
    if (typeof r === "object") {
      expect(r.marcaContem).toBe("Fiat");
      expect(r.percentualTanqueMinimo).toBe(50);
      expect(descreverRegraConsumo(r)).toContain("9 a 12 km/l");
    }
  });
  it("exige marca OU placa", () => {
    expect(typeof validarRegraConsumo({ consumoMinimo: 9, consumoMaximo: 12 })).toBe("string");
    expect(typeof validarRegraConsumo({ marcaContem: "Fiat", placa: "ABC1D23", consumoMinimo: 9, consumoMaximo: 12 })).toBe("string");
  });
  it("normaliza placa e rejeita inválida", () => {
    const r = validarRegraConsumo({ placa: "abc-1d23", consumoMinimo: 8, consumoMaximo: 11 });
    expect(typeof r === "object" && r.placa).toBe("ABC1D23");
    expect(typeof validarRegraConsumo({ placa: "ABC", consumoMinimo: 8, consumoMaximo: 11 })).toBe("string");
  });
  it("rejeita faixa invertida, fora do limite e marca com curinga", () => {
    expect(typeof validarRegraConsumo({ marcaContem: "Fiat", consumoMinimo: 12, consumoMaximo: 9 })).toBe("string");
    expect(typeof validarRegraConsumo({ marcaContem: "Fiat", consumoMinimo: 1, consumoMaximo: 500 })).toBe("string");
    expect(typeof validarRegraConsumo({ marcaContem: "fi%at", consumoMinimo: 9, consumoMaximo: 12 })).toBe("string");
    expect(typeof validarRegraConsumo({ marcaContem: "Fiat", consumoMinimo: 9, consumoMaximo: 12, percentualTanqueMinimo: 150 })).toBe("string");
  });
});
