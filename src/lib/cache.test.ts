import { describe, it, expect, vi } from "vitest";
import { obterOuDefinir, invalidar, invalidarPrefixo, jaVisto } from "@/lib/cache";

// Fase Observabilidade-Fase3 (14/08/2026, pedido do Daniel: "ampliar os
// testes de regressão") — cache.ts virou peça central (permissoes.ts,
// configuracoesSistema.ts, planosPrecos.ts e alertas.ts dependem dele) sem
// ter teste próprio ainda. Usa chaves únicas por teste (prefixo do nome do
// teste) pra não vazar estado entre eles — o cache é um Map em módulo,
// compartilhado por todos os testes do processo.

describe("obterOuDefinir", () => {
  it("primeira chamada é sempre miss: roda `calcular` e guarda o resultado", async () => {
    const calcular = vi.fn(async () => "valor-a");
    const resultado = await obterOuDefinir("teste:miss-inicial", 60_000, calcular);
    expect(resultado).toBe("valor-a");
    expect(calcular).toHaveBeenCalledTimes(1);
  });

  it("segunda chamada com a MESMA chave, dentro do TTL, é hit: NÃO roda `calcular` de novo", async () => {
    const calcular = vi.fn(async () => "valor-b");
    await obterOuDefinir("teste:hit", 60_000, calcular);
    const resultado = await obterOuDefinir("teste:hit", 60_000, calcular);
    expect(resultado).toBe("valor-b");
    expect(calcular).toHaveBeenCalledTimes(1); // não a 2ª vez — veio do cache
  });

  it("chave vencida (TTL no passado) é miss de novo: roda `calcular` outra vez", async () => {
    const calcular = vi.fn(async () => "valor-c");
    await obterOuDefinir("teste:vencido", -1, calcular); // já nasce vencido
    const resultado = await obterOuDefinir("teste:vencido", 60_000, calcular);
    expect(resultado).toBe("valor-c");
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it("chaves diferentes nunca se confundem entre si", async () => {
    await obterOuDefinir("teste:chave-x", 60_000, async () => "x");
    await obterOuDefinir("teste:chave-y", 60_000, async () => "y");
    expect(await obterOuDefinir("teste:chave-x", 60_000, async () => "outro")).toBe("x");
    expect(await obterOuDefinir("teste:chave-y", 60_000, async () => "outro")).toBe("y");
  });
});

describe("invalidar", () => {
  it("depois de invalidar, a próxima chamada é miss (recalcula) mesmo dentro do TTL", async () => {
    const calcular = vi.fn(async () => "antes");
    await obterOuDefinir("teste:invalidar", 60_000, calcular);
    invalidar("teste:invalidar");

    const calcularNovo = vi.fn(async () => "depois");
    const resultado = await obterOuDefinir("teste:invalidar", 60_000, calcularNovo);
    expect(resultado).toBe("depois");
    expect(calcularNovo).toHaveBeenCalledTimes(1);
  });
});

describe("invalidarPrefixo", () => {
  it("remove só as chaves com o prefixo indicado, preserva as demais", async () => {
    await obterOuDefinir("teste:familia:a", 60_000, async () => "1");
    await obterOuDefinir("teste:familia:b", 60_000, async () => "2");
    await obterOuDefinir("teste:outra-familia:c", 60_000, async () => "3");

    invalidarPrefixo("teste:familia:");

    // As duas da família invalidada recalculam (miss).
    const calcularA = vi.fn(async () => "1-novo");
    expect(await obterOuDefinir("teste:familia:a", 60_000, calcularA)).toBe("1-novo");
    expect(calcularA).toHaveBeenCalledTimes(1);

    // A de fora da família continua com o valor antigo (hit).
    const calcularC = vi.fn(async () => "3-novo");
    expect(await obterOuDefinir("teste:outra-familia:c", 60_000, calcularC)).toBe("3");
    expect(calcularC).not.toHaveBeenCalled();
  });
});

describe("jaVisto", () => {
  it("primeira vez que vê uma chave devolve false (não é repetido)", () => {
    expect(jaVisto("teste:dedupe-a", 60_000)).toBe(false);
  });

  it("segunda vez, dentro da janela, devolve true (é repetido)", () => {
    jaVisto("teste:dedupe-b", 60_000);
    expect(jaVisto("teste:dedupe-b", 60_000)).toBe(true);
  });

  it("janela já vencida (negativa) volta a devolver false", () => {
    jaVisto("teste:dedupe-c", -1);
    expect(jaVisto("teste:dedupe-c", 60_000)).toBe(false);
  });
});
