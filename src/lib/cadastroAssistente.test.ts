import { describe, expect, it } from "vitest";
import { calcularMudancas, cpfValido, normalizarPlaca, placaValida, validarCadastro } from "./cadastroAssistente";

describe("placa", () => {
  it("normaliza e valida os dois formatos", () => {
    expect(normalizarPlaca("abc-1234")).toBe("ABC1234");
    expect(placaValida("ABC1234")).toBe(true);
    expect(placaValida("ABC1D23")).toBe(true);
    expect(placaValida("AB12345")).toBe(false);
    expect(placaValida("ABC12")).toBe(false);
  });
});

describe("cpf", () => {
  it("valida dígitos verificadores", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("52998224726")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });
});

describe("validarCadastro — veículo", () => {
  it("criar exige placa válida e normaliza campos", () => {
    const v = validarCadastro({
      entidade: "veiculo",
      acao: "criar",
      campos: { placa: "abc-1d23", marca: "  Fiat ", ano_modelo: "2022", classificacao: "próprio", tanque: "50,5" },
    });
    expect(v).toEqual({
      entidade: "veiculo",
      acao: "criar",
      identificador: "ABC1D23",
      campos: { placa: "ABC1D23", marca: "Fiat", ano_modelo: 2022, classificacao: "Próprio", tanque: 50.5 },
    });
  });

  it("rejeita placa, ano, UF, chassi e classificação inválidos", () => {
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { placa: "123" } })).toMatch(/Placa inválida/);
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { marca: "Fiat" } })).toMatch(/placa/i);
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { placa: "ABC1234", ano_modelo: 1800 } })).toMatch(/inválido/);
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { placa: "ABC1234", uf_veiculo: "SPP" } })).toMatch(/UF/);
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { placa: "ABC1234", chassi: "123" } })).toMatch(/Chassi/);
    expect(validarCadastro({ entidade: "veiculo", acao: "criar", campos: { placa: "ABC1234", classificacao: "Outro" } })).toMatch(/Classificação/);
  });

  it("alterar exige a placa atual e ao menos um campo; ignora campos desconhecidos", () => {
    expect(validarCadastro({ entidade: "veiculo", acao: "alterar", campos: { cor: "Branca" } })).toMatch(/placa/i);
    expect(validarCadastro({ entidade: "veiculo", acao: "alterar", identificador: "ABC1234", campos: {} })).toMatch(/ao menos um campo/);
    expect(
      validarCadastro({ entidade: "veiculo", acao: "alterar", identificador: "ABC1234", campos: { empresa_id: "x", cnpj_frota: "y" } })
    ).toMatch(/ao menos um campo/);
    expect(validarCadastro({ entidade: "veiculo", acao: "alterar", identificador: "abc1234", campos: { cor: "Branca" } })).toMatchObject({
      identificador: "ABC1234",
      campos: { cor: "Branca" },
    });
  });

  it("inativar e reativar não carregam campos", () => {
    expect(validarCadastro({ entidade: "veiculo", acao: "inativar", identificador: "ABC1234", campos: { cor: "x" } })).toEqual({
      entidade: "veiculo",
      acao: "inativar",
      identificador: "ABC1234",
      campos: {},
    });
  });
});

describe("validarCadastro — motorista", () => {
  it("criar exige nome e CPF válido", () => {
    expect(validarCadastro({ entidade: "motorista", acao: "criar", campos: { nome_completo: "Maria Souza" } })).toMatch(/CPF/);
    expect(validarCadastro({ entidade: "motorista", acao: "criar", campos: { nome_completo: "Maria Souza", cpf: "111.111.111-11" } })).toMatch(/CPF inválido/);
    expect(
      validarCadastro({
        entidade: "motorista",
        acao: "criar",
        campos: { nome_completo: "  Maria   Souza ", cpf: "529.982.247-25", telefone: "(11) 91234-5678", cnh_vencimento: "31/12/2027" },
      })
    ).toMatchObject({
      identificador: "52998224725",
      campos: { nome_completo: "Maria Souza", cpf: "52998224725", telefone: "11912345678", cnh_vencimento: "2027-12-31" },
    });
  });

  it("valida data, e-mail e CNH", () => {
    const base = { nome_completo: "Maria Souza", cpf: "52998224725" };
    expect(validarCadastro({ entidade: "motorista", acao: "criar", campos: { ...base, cnh_vencimento: "31/02/2027" } })).toMatch(/inválido/);
    expect(validarCadastro({ entidade: "motorista", acao: "criar", campos: { ...base, email: "x" } })).toMatch(/E-mail/);
    expect(validarCadastro({ entidade: "motorista", acao: "criar", campos: { ...base, cnh: "123" } })).toMatch(/CNH/);
  });

  it("alterar aceita CPF (só dígitos) ou nome como identificador", () => {
    expect(validarCadastro({ entidade: "motorista", acao: "inativar", identificador: "529.982.247-25" })).toMatchObject({ identificador: "52998224725" });
    expect(validarCadastro({ entidade: "motorista", acao: "inativar", identificador: "  Maria  Souza " })).toMatchObject({ identificador: "Maria Souza" });
    expect(validarCadastro({ entidade: "motorista", acao: "inativar", identificador: "" })).toMatch(/CPF ou o nome/);
  });
});

describe("validarCadastro — entrada geral", () => {
  it("rejeita entidade e ação inválidas", () => {
    expect(validarCadastro({ entidade: "empresa", acao: "criar" })).toMatch(/Entidade/);
    expect(validarCadastro({ entidade: "veiculo", acao: "excluir" })).toMatch(/Ação/);
  });
});

describe("calcularMudancas", () => {
  it("devolve só o que muda, com rótulos", () => {
    const m = calcularMudancas("veiculo", { cor: "Branca", tanque: 50, marca: null }, { cor: "Branca", tanque: 60, marca: "Fiat" });
    expect(m).toEqual([
      { campo: "tanque", rotulo: "Tanque (L)", de: "50", para: "60" },
      { campo: "marca", rotulo: "Marca", de: "(vazio)", para: "Fiat" },
    ]);
  });
  it("trata vazio igual a vazio", () => {
    expect(calcularMudancas("motorista", { telefone: null }, { telefone: null })).toEqual([]);
    expect(calcularMudancas("motorista", { cnh_vencimento: "2027-12-31" }, { cnh_vencimento: "2027-12-31" })).toEqual([]);
  });
});
