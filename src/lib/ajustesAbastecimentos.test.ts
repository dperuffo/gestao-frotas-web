import { describe, it, expect } from "vitest";
import { validarCamposAjuste, caminhoAbastecimento } from "@/lib/ajustesAbastecimentos";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "os fluxos
// críticos devem ter testes de regressão", escopo combinado:
// "abastecimento e faturamento" é um dos 4 fluxos). `validarCamposAjuste` é
// a única barreira antes de uma proposta de ajuste (litros, preço, valor
// total etc.) ser enviada pra contraparte (cliente ⇄ posto) — se parar de
// pegar um valor inválido (ex.: litros negativo), um ajuste absurdo pode
// ser proposto e, se aceito do outro lado, aplicado direto em
// profrotas_abastecimentos.
describe("validarCamposAjuste", () => {
  it("rejeita quando nenhum campo foi preenchido", () => {
    expect(validarCamposAjuste({})).toBe("Preencha ao menos um campo para propor o ajuste.");
  });

  it("aceita quando ao menos um campo válido foi preenchido", () => {
    expect(validarCamposAjuste({ hodometro: 12345 })).toBeNull();
  });

  it("rejeita hodômetro negativo ou não numérico", () => {
    expect(validarCamposAjuste({ hodometro: -1 })).toBe("Hodômetro inválido.");
    expect(validarCamposAjuste({ hodometro: NaN })).toBe("Hodômetro inválido.");
  });

  it("hodômetro zero é válido (carro novo/zerado)", () => {
    expect(validarCamposAjuste({ hodometro: 0 })).toBeNull();
  });

  it("rejeita litros zero ou negativo", () => {
    expect(validarCamposAjuste({ item_quantidade: 0 })).toBe("Litros inválido.");
    expect(validarCamposAjuste({ item_quantidade: -5 })).toBe("Litros inválido.");
  });

  it("rejeita preço por litro zero ou negativo", () => {
    expect(validarCamposAjuste({ item_valor_unitario: 0 })).toBe("Preço por litro inválido.");
    expect(validarCamposAjuste({ item_valor_unitario: -0.01 })).toBe("Preço por litro inválido.");
  });

  it("rejeita valor total zero ou negativo", () => {
    expect(validarCamposAjuste({ item_valor_total: 0 })).toBe("Valor total inválido.");
  });

  it("rejeita data/hora inválida", () => {
    expect(validarCamposAjuste({ data_abastecimento: "não é uma data" })).toBe("Data/hora inválida.");
  });

  it("aceita uma proposta completa e coerente", () => {
    expect(
      validarCamposAjuste({
        data_abastecimento: "2026-08-14T10:00:00Z",
        hodometro: 50000,
        item_nome: "Diesel S10",
        item_quantidade: 100,
        item_valor_unitario: 5.89,
        item_valor_total: 589,
      })
    ).toBeNull();
  });

  it("campos ausentes (undefined) não travam a validação dos demais", () => {
    // undefined é "não informado" — diferente de um valor inválido.
    expect(validarCamposAjuste({ hodometro: 100, item_quantidade: undefined })).toBeNull();
  });
});

describe("caminhoAbastecimento", () => {
  it("monta o caminho de um abastecimento PróFrotas", () => {
    expect(caminhoAbastecimento({ tipo: "profrotas", id: 42 })).toBe("/abastecimentos/42");
  });

  it("monta o caminho de um abastecimento de provedor externo (rota diferente)", () => {
    expect(caminhoAbastecimento({ tipo: "externo", id: 42 })).toBe("/abastecimentos/externo/42");
  });
});
