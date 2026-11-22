import { describe, expect, it } from "vitest";
import { decidirAcesso, formatarTokens, mensagemErroChaveCliente } from "./assistenteConsumo";

describe("assistenteConsumo", () => {
  it("chave própria ignora a franquia; ilimitado (-1) sempre libera", () => {
    expect(decidirAcesso({ usado: 9_999_999, franquia: 100, chave_propria: true })).toBe("chave_cliente");
    expect(decidirAcesso({ usado: 9_999_999, franquia: -1, chave_propria: false })).toBe("franquia_ok");
  });
  it("bloqueia quando usado >= franquia", () => {
    expect(decidirAcesso({ usado: 99, franquia: 100, chave_propria: false })).toBe("franquia_ok");
    expect(decidirAcesso({ usado: 100, franquia: 100, chave_propria: false })).toBe("franquia_esgotada");
  });
  it("cliente com chave escolhe: franquia (se houver saldo) ou chave; sem saldo vai para a chave", () => {
    const base = { franquia: 100, chave_propria: true };
    expect(decidirAcesso({ ...base, usado: 10, preferencia: "franquia" })).toBe("franquia_ok");
    expect(decidirAcesso({ ...base, usado: 10 })).toBe("franquia_ok"); // padrão: franquia
    expect(decidirAcesso({ ...base, usado: 10, preferencia: "chave" })).toBe("chave_cliente");
    expect(decidirAcesso({ ...base, usado: 100, preferencia: "franquia" })).toBe("chave_cliente");
    expect(decidirAcesso({ ...base, usado: 9_999, franquia: -1, preferencia: "franquia" })).toBe("franquia_ok");
  });
  it("formata tokens e traduz erro de chave", () => {
    expect(formatarTokens(1500)).toBe("1,5 mil");
    expect(formatarTokens(2_000_000)).toBe("2 mi");
    expect(mensagemErroChaveCliente({ status: 401 })).toContain("recusou");
    expect(mensagemErroChaveCliente({ status: 500 })).toBeNull();
  });
});
