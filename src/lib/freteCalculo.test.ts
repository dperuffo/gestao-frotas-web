import { describe, it, expect } from "vitest";
import { encontrarFaixaPeso, calcularFretePeso, calcularFrete, calcularPisoAntt, verificarAlertaPiso, type FaixaPesoFrete } from "@/lib/freteCalculo";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "os fluxos
// críticos devem ter testes de regressão", escopo combinado: "cálculos
// financeiros" é um dos 4 fluxos). freteCalculo.ts já nasceu como função
// pura pensada pra ser testada (ver comentário original no topo do
// arquivo) — usado em /cotacoes pra simular o preço de um frete pro
// cliente. Um erro aqui cobra errado (a mais ou a menos) de quem está
// simulando um frete de verdade.
describe("encontrarFaixaPeso", () => {
  const faixas: FaixaPesoFrete[] = [
    { pesoMinKg: 0, pesoMaxKg: 500, valorPorKg: 1, valorMinimo: 50 },
    { pesoMinKg: 501, pesoMaxKg: 1000, valorPorKg: 0.8, valorMinimo: 100 },
  ];

  it("sem faixa nenhuma cadastrada, devolve null", () => {
    expect(encontrarFaixaPeso(100, [])).toBeNull();
  });

  it("encontra a faixa exata que contém o peso", () => {
    expect(encontrarFaixaPeso(300, faixas)?.pesoMinKg).toBe(0);
    expect(encontrarFaixaPeso(700, faixas)?.pesoMinKg).toBe(501);
  });

  it("com faixa aberta (pesoMaxKg null) disponível, usa ela pra peso acima de todo o resto", () => {
    const comAberta: FaixaPesoFrete[] = [...faixas, { pesoMinKg: 1001, pesoMaxKg: null, valorPorKg: 0.5, valorMinimo: 200 }];
    expect(encontrarFaixaPeso(5000, comAberta)?.pesoMinKg).toBe(1001);
  });

  it("sem faixa aberta, peso acima de tudo cai na faixa de MAIOR pesoMinKg disponível (nunca fica sem frete-peso)", () => {
    expect(encontrarFaixaPeso(999999, faixas)?.pesoMinKg).toBe(501);
  });
});

describe("calcularFretePeso", () => {
  it("sem faixa, devolve 0", () => {
    expect(calcularFretePeso(500, null)).toBe(0);
  });

  it("usa o maior entre (peso × valor por kg) e o valor mínimo da faixa", () => {
    const faixa: FaixaPesoFrete = { pesoMinKg: 0, pesoMaxKg: 1000, valorPorKg: 0.5, valorMinimo: 100 };
    expect(calcularFretePeso(1000, faixa)).toBe(500); // 1000*0.5=500 > mínimo 100
    expect(calcularFretePeso(50, faixa)).toBe(100); // 50*0.5=25 < mínimo 100 → usa o mínimo
  });
});

describe("calcularPisoAntt", () => {
  it("piso = distância × coeficiente de deslocamento + coeficiente de carga/descarga", () => {
    expect(calcularPisoAntt(100, { coeficienteDeslocamento: 2.5, coeficienteCargaDescarga: 50 })).toBe(300);
  });
});

describe("verificarAlertaPiso", () => {
  it("alerta (true) quando o frete cotado fica abaixo do piso mínimo", () => {
    expect(verificarAlertaPiso(300, 400)).toBe(true);
  });

  it("sem alerta quando o frete está no piso ou acima", () => {
    expect(verificarAlertaPiso(400, 400)).toBe(false);
    expect(verificarAlertaPiso(500, 400)).toBe(false);
  });

  it("sem piso cadastrado (null), nunca alerta", () => {
    expect(verificarAlertaPiso(0, null)).toBe(false);
  });
});

describe("calcularFrete", () => {
  it("compõe frete-peso + adicionais + ICMS 'por dentro' corretamente (exemplo conferido à mão)", () => {
    const resultado = calcularFrete({
      pesoKg: 1000,
      valorCarga: 10000,
      faixas: [{ pesoMinKg: 0, pesoMaxKg: 2000, valorPorKg: 0.5, valorMinimo: 100 }],
      percentualAdValorem: 0.3,
      percentualGris: 0.1,
      valorTde: 20,
      valorTda: 15,
      valorDespacho: 10,
      valorPedagio: 50,
      percentualIcms: 12,
    });

    expect(resultado.valorFretePeso).toBe(500); // max(1000*0.5, 100)
    expect(resultado.valorAdValorem).toBe(30); // 10000 * 0.3%
    expect(resultado.valorGris).toBe(10); // 10000 * 0.1%
    expect(resultado.subtotalAntesIcms).toBe(635); // 500+30+10+20+15+10+50
    // ICMS "por dentro": valorTotal = subtotal / (1 - alíquota)
    expect(resultado.valorTotal).toBe(721.59); // 635 / (1 - 0.12) = 721.590909... → 721.59
    expect(resultado.valorIcms).toBe(86.59); // 721.59 - 635
  });

  it("com alíquota de ICMS zero, o valor total é igual ao subtotal (sem gross-up)", () => {
    const resultado = calcularFrete({
      pesoKg: 100,
      valorCarga: 1000,
      faixas: [{ pesoMinKg: 0, pesoMaxKg: 1000, valorPorKg: 1, valorMinimo: 50 }],
      percentualAdValorem: 0,
      percentualGris: 0,
      valorTde: 0,
      valorTda: 0,
      valorDespacho: 0,
      valorPedagio: 0,
      percentualIcms: 0,
    });
    expect(resultado.valorTotal).toBe(resultado.subtotalAntesIcms);
    expect(resultado.valorIcms).toBe(0);
  });

  it("sem nenhuma faixa cadastrada, o frete-peso fica zerado mas o resto da composição continua funcionando", () => {
    const resultado = calcularFrete({
      pesoKg: 100,
      valorCarga: 1000,
      faixas: [],
      percentualAdValorem: 1,
      percentualGris: 0,
      valorTde: 10,
      valorTda: 0,
      valorDespacho: 0,
      valorPedagio: 0,
      percentualIcms: 0,
    });
    expect(resultado.faixaUsada).toBeNull();
    expect(resultado.valorFretePeso).toBe(0);
    expect(resultado.valorAdValorem).toBe(10); // 1000 * 1%
    expect(resultado.subtotalAntesIcms).toBe(20); // 0 + 10 + 0 + 10 + 0 + 0
  });

  // Fase Observabilidade-Fase3 (14/08/2026, pedido do Daniel: "ampliar os
  // testes de regressão") — caso de borda perigoso: com alíquota de ICMS em
  // 100%, a fórmula de gross-up (subtotal / (1 - alíquota)) divide por
  // ZERO — daria Infinity/NaN numa cotação real se não fosse tratado. O
  // código já trata isso (`aliquota < 1` na condição) — este teste existe
  // pra travar esse comportamento pra sempre, não pra descobri-lo de novo.
  it("com alíquota de ICMS em 100%, NÃO divide por zero — cai pro subtotal sem gross-up", () => {
    const resultado = calcularFrete({
      pesoKg: 100,
      valorCarga: 1000,
      faixas: [{ pesoMinKg: 0, pesoMaxKg: 1000, valorPorKg: 1, valorMinimo: 50 }],
      percentualAdValorem: 0,
      percentualGris: 0,
      valorTde: 0,
      valorTda: 0,
      valorDespacho: 0,
      valorPedagio: 0,
      percentualIcms: 100,
    });
    expect(Number.isFinite(resultado.valorTotal)).toBe(true);
    expect(resultado.valorTotal).toBe(resultado.subtotalAntesIcms);
  });
});
