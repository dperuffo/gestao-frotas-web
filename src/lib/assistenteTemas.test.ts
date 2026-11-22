import { describe, expect, it } from "vitest";
import { sugestaoParaTela, caminhoAssistenteComPergunta, TEMAS_ASSISTENTE } from "./assistenteTemas";

describe("assistenteTemas", () => {
  it("sugere por prefixo de rota e tem padrão", () => {
    expect(sugestaoParaTela("/multas/123")).toContain("multas");
    expect(sugestaoParaTela("/dashboard")).toContain("acima da média");
    expect(sugestaoParaTela("/rota-desconhecida")).toContain("previsão");
  });
  it("codifica a pergunta na URL", () => {
    const c = caminhoAssistenteComPergunta("a & b?", "emp-1");
    expect(c.startsWith("/assistente?pergunta=")).toBe(true);
    expect(new URLSearchParams(c.split("?")[1]).get("pergunta")).toBe("a & b?");
    expect(c).toContain("empresa=emp-1");
  });
  it("todos os temas têm perguntas", () => {
    expect(TEMAS_ASSISTENTE.every((t) => t.perguntas.length > 0)).toBe(true);
  });
});
