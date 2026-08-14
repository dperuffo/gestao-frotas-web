import { defineConfig } from "vitest/config";
import path from "path";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "os fluxos
// críticos devem ter testes de regressão") — primeiro runner de teste do
// projeto (não existia nenhum antes). Escopo combinado com o Daniel:
// testes UNITÁRIOS (funções puras, sem banco/rede), não testes de tela —
// por isso não precisa de `environment: "jsdom"` nem de mock de Supabase.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Ver src/lib/__testes__/server-only-stub.ts — só pros testes.
      "server-only": path.resolve(__dirname, "./src/lib/__testes__/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
