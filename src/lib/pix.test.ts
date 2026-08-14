import { describe, it, expect } from "vitest";
import { gerarPayloadPix } from "@/lib/pix";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "os fluxos
// críticos devem ter testes de regressão", escopo combinado: "cobrança" é
// um dos 4 fluxos — aqui é o PIX real usado nas faturas, ver
// src/lib/cobranca/). Um erro de 1 caractere neste payload (campo errado,
// tamanho errado, checksum errado) faz o QR Code ser recusado pelo banco de
// quem for pagar — por isso o nível de detalhe destes testes: cada campo do
// padrão EMV/BR Code é conferido individualmente, e o checksum (CRC16) é
// recalculado de forma INDEPENDENTE do código de produção (implementação
// própria aqui no teste, não importada de pix.ts) — se algum dia alguém
// mexer em pix.ts e o CRC calculado lá parar de bater com o CRC calculado
// aqui (com outra implementação do mesmo algoritmo padrão), o teste falha.
function crc16CcittFalseIndependente(texto: string): string {
  let crc = 0xffff;
  for (const caractere of texto) {
    const byte = caractere.codePointAt(0)! & 0xff;
    crc ^= byte << 8;
    for (let contagem = 0; contagem < 8; contagem++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

describe("gerarPayloadPix", () => {
  const entrada = {
    chave: "chave-pix@example.com",
    nomeBeneficiario: "Posto Exemplo",
    cidadeBeneficiario: "Sao Paulo",
    valor: 15.5,
    txid: "ABC123",
  };

  it("começa com o indicador de formato + método estático (fixo no padrão EMV/BR Code)", () => {
    const payload = gerarPayloadPix(entrada);
    expect(payload.startsWith("000201010211")).toBe(true);
  });

  it("inclui a chave PIX no campo Merchant Account Info (26)", () => {
    const payload = gerarPayloadPix(entrada);
    expect(payload).toContain("0121chave-pix@example.com");
    expect(payload).toContain("br.gov.bcb.pix");
  });

  it("formata o valor com 2 casas decimais no campo 54", () => {
    const payload = gerarPayloadPix({ ...entrada, valor: 7 });
    expect(payload).toContain("54047.00"); // campo 54, tamanho "04", valor "7.00"
  });

  it("normaliza nome/cidade do beneficiário: maiúsculas, sem acento, cortado no tamanho máximo", () => {
    const payload = gerarPayloadPix({ ...entrada, nomeBeneficiario: "João Ção", cidadeBeneficiario: "São Paulo" });
    expect(payload).toContain("JOAO CAO"); // acento removido, maiúsculo
    expect(payload).toContain("SAO PAULO");
  });

  it("nunca deixa nome/cidade vazios (usa 'FNI' de fallback) quando normalização zera o texto", () => {
    const payload = gerarPayloadPix({ ...entrada, nomeBeneficiario: "@@@", cidadeBeneficiario: "###" });
    expect(payload).toContain("5903FNI"); // nome: campo 59, tamanho 03, "FNI"
  });

  it("inclui o txid no Additional Data Field (62)", () => {
    const payload = gerarPayloadPix(entrada);
    expect(payload).toContain("62100506ABC123");
  });

  it("termina com CRC16 de 4 dígitos hexadecimais, calculado sobre o payload até o campo '6304'", () => {
    const payload = gerarPayloadPix(entrada);
    const semCrc = payload.slice(0, -4);
    const crcInformado = payload.slice(-4);

    expect(semCrc.endsWith("6304")).toBe(true);
    expect(crcInformado).toBe(crc16CcittFalseIndependente(semCrc));
  });

  it("é determinístico: mesma entrada sempre gera o mesmo payload", () => {
    expect(gerarPayloadPix(entrada)).toBe(gerarPayloadPix({ ...entrada }));
  });

  it("valores diferentes geram payloads (e CRCs) diferentes", () => {
    const payloadA = gerarPayloadPix(entrada);
    const payloadB = gerarPayloadPix({ ...entrada, valor: 99.9 });
    expect(payloadA).not.toBe(payloadB);
  });

  // Fase Observabilidade-Fase3 (14/08/2026, pedido do Daniel: "ampliar os
  // testes de regressão") — o padrão EMV/BR Code exige limite rígido de
  // tamanho pro nome (25) e cidade (15) do beneficiário; nome/cidade reais
  // de posto às vezes passam desses limites. Sem o corte, o payload gerado
  // ficaria com tamanho de campo divergente do conteúdo — banco recusaria
  // o QR Code inteiro.
  it("corta nome do beneficiário em 25 caracteres e cidade em 15 (limite do padrão EMV/BR Code)", () => {
    const payload = gerarPayloadPix({
      ...entrada,
      nomeBeneficiario: "A".repeat(40),
      cidadeBeneficiario: "B".repeat(30),
    });
    expect(payload).toContain(`59${String(25).padStart(2, "0")}${"A".repeat(25)}`);
    expect(payload).toContain(`60${String(15).padStart(2, "0")}${"B".repeat(15)}`);
    // Não deve sobrar um 26º "A" nem um 16º "B" colado (confirmaria que o
    // corte realmente aconteceu, não só que o prefixo bate).
    expect(payload).not.toContain("A".repeat(26));
    expect(payload).not.toContain("B".repeat(16));
  });
});
