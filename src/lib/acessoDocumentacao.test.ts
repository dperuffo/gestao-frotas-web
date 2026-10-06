import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
});
vi.mock("next/navigation", () => ({ redirect: (d: string) => redirectMock(d) }));

type Cenario = {
  user: { id: string } | null;
  fatorVerificado: boolean;
  nivelAtual: string;
  proximoNivel: string;
  perfil: string | null;
};
let cenario: Cenario;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: cenario.user } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: cenario.nivelAtual, nextLevel: cenario.proximoNivel },
        }),
        listFactors: async () => ({
          data: { totp: cenario.fatorVerificado ? [{ status: "verified" }] : [] },
        }),
      },
    },
    rpc: async () => ({ data: cenario.perfil }),
  }),
}));

import { bloquearSeNaoAutorizado } from "./acessoDocumentacao";

const base: Cenario = {
  user: { id: "u1" },
  fatorVerificado: true,
  nivelAtual: "aal2",
  proximoNivel: "aal2",
  perfil: "admin",
};

describe("bloquearSeNaoAutorizado (documentação técnica)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cenario = { ...base };
  });

  it("sem sessão vai para /login", async () => {
    cenario.user = null;
    await expect(bloquearSeNaoAutorizado()).rejects.toThrow("REDIRECT:/login");
  });

  it("sem fator MFA verificado vai para /mfa-setup", async () => {
    cenario.fatorVerificado = false;
    await expect(bloquearSeNaoAutorizado()).rejects.toThrow("REDIRECT:/mfa-setup");
  });

  it("com fator mas sessão ainda em aal1 vai para /mfa-setup", async () => {
    cenario.nivelAtual = "aal1";
    cenario.proximoNivel = "aal2";
    await expect(bloquearSeNaoAutorizado()).rejects.toThrow("REDIRECT:/mfa-setup");
  });

  it("perfil que não é admin recebe 403", async () => {
    for (const perfil of ["gestor_frota", "analista", "posto", "caixa", null]) {
      cenario.perfil = perfil;
      const r = await bloquearSeNaoAutorizado();
      expect(r?.status).toBe(403);
    }
  });

  it("admin com senha e MFA (aal2) passa", async () => {
    expect(await bloquearSeNaoAutorizado()).toBeNull();
  });
});
