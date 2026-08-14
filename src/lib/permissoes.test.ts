import { describe, it, expect } from "vitest";
import { resolverFuncionalidadeDaRota, ehBypassPermissao, temAcesso, type MapaPermissoes } from "@/lib/permissoes";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "os fluxos
// críticos devem ter testes de regressão", escopo combinado: "login e
// permissões" é um dos 4 fluxos). Cobre a lógica que decide se alguém pode
// ou não acessar uma tela — se isso quebrar, um perfil pode ficar bloqueado
// de tudo (trava o sistema pra ele) ou liberado pra tudo (furo de
// segurança). Não testa login em si (isso é o Supabase Auth, fora do nosso
// código) nem faz requisição nenhuma — só a lógica pura de decisão.
describe("resolverFuncionalidadeDaRota", () => {
  it("resolve uma rota cadastrada exatamente", () => {
    expect(resolverFuncionalidadeDaRota("/financeiro")).toBe("aba_financeiro");
  });

  it("resolve uma sub-rota (ex.: /fretes/123) pela rota-pai cadastrada", () => {
    expect(resolverFuncionalidadeDaRota("/fretes/123")).toBe("aba_fretes");
  });

  it("NUNCA deixa uma rota parecida capturar por engano outra rota (bug real já corrigido)", () => {
    // "/postos" não pode capturar "/postos-duplicados" — são funcionalidades
    // diferentes. Ver comentário original em permissoes.ts sobre esse bug.
    expect(resolverFuncionalidadeDaRota("/postos-duplicados")).not.toBe("aba_postos");
    expect(resolverFuncionalidadeDaRota("/postos-duplicados")).toBeNull();
  });

  it("rota nunca cadastrada (ex.: /treinamento) fica sempre liberada (null)", () => {
    expect(resolverFuncionalidadeDaRota("/treinamento")).toBeNull();
  });

  it("rotas da lista de nunca-bloqueadas (ex.: /dashboard) sempre retornam null, mesmo estando na matriz", () => {
    // /dashboard TEM uma "aba_dashboard" cadastrada, mas é o próprio destino
    // do redirect de bloqueio — bloqueá-la causaria loop infinito.
    expect(resolverFuncionalidadeDaRota("/dashboard")).toBeNull();
  });

  it("resolve corretamente rotas aninhadas dentro de /administracao (várias cadastradas no mesmo prefixo)", () => {
    expect(resolverFuncionalidadeDaRota("/administracao/pisos-antt")).toBe("aba_pisos_antt");
    expect(resolverFuncionalidadeDaRota("/administracao/pisos-antt/editar")).toBe("aba_pisos_antt");
    expect(resolverFuncionalidadeDaRota("/administracao/central-avisos")).toBe("aba_central_avisos");
  });
});

describe("ehBypassPermissao", () => {
  it("perfil admin sempre passa, não importa o e-mail", () => {
    expect(ehBypassPermissao("admin", "qualquer@empresa.com")).toBe(true);
  });

  it("e-mail do Daniel sempre passa, não importa o perfil", () => {
    expect(ehBypassPermissao("colaborador", "d.peruffo@gmail.com")).toBe(true);
  });

  it("perfil comum com e-mail comum NÃO tem bypass", () => {
    expect(ehBypassPermissao("gestor_frota", "cliente@empresa.com")).toBe(false);
  });

  it("perfil/e-mail nulos ou ausentes não têm bypass (fail-safe, não fail-open)", () => {
    expect(ehBypassPermissao(null, null)).toBe(false);
    expect(ehBypassPermissao(undefined, undefined)).toBe(false);
  });
});

describe("temAcesso", () => {
  it("funcionalidade null (rota sem controle) sempre libera", () => {
    const mapa: MapaPermissoes = new Map();
    expect(temAcesso(mapa, null)).toBe(true);
  });

  it("funcionalidade sem linha cadastrada no mapa libera por padrão", () => {
    const mapa: MapaPermissoes = new Map([["aba_financeiro", false]]);
    expect(temAcesso(mapa, "aba_veiculos")).toBe(true);
  });

  it("funcionalidade explicitamente desligada (false) bloqueia", () => {
    const mapa: MapaPermissoes = new Map([["aba_financeiro", false]]);
    expect(temAcesso(mapa, "aba_financeiro")).toBe(false);
  });

  it("funcionalidade explicitamente ligada (true) libera", () => {
    const mapa: MapaPermissoes = new Map([["aba_financeiro", true]]);
    expect(temAcesso(mapa, "aba_financeiro")).toBe(true);
  });
});
