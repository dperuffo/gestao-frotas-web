import { describe, expect, it } from "vitest";
import { hojeBrasilIso, mesAtualBrasil } from "./utils";

// 01/10/2026 — o servidor roda em UTC; "hoje" e "mês atual" precisam seguir
// o calendário de Brasília (-03:00).
describe("hojeBrasilIso / mesAtualBrasil", () => {
  it("às 22:00 de Brasília do dia 30/09 ainda é setembro (já é 01/10 em UTC)", () => {
    const agora = new Date("2026-10-01T01:00:00Z");
    expect(hojeBrasilIso(agora)).toBe("2026-09-30");
    const m = mesAtualBrasil(agora);
    expect(m.inicioData).toBe("2026-09-01");
    expect(m.inicioInstante).toBe("2026-09-01T03:00:00.000Z");
    expect(m.fimInstante).toBe("2026-10-01T02:59:59.999Z");
  });

  it("à 00:30 de Brasília do dia 01/10 já é outubro", () => {
    const agora = new Date("2026-10-01T03:30:00Z");
    expect(hojeBrasilIso(agora)).toBe("2026-10-01");
    expect(mesAtualBrasil(agora).inicioInstante).toBe("2026-10-01T03:00:00.000Z");
  });

  it("vira o ano em dezembro", () => {
    const m = mesAtualBrasil(new Date("2026-12-15T12:00:00Z"));
    expect(m.inicioData).toBe("2026-12-01");
    expect(m.fimInstante).toBe("2027-01-01T02:59:59.999Z");
  });
});
