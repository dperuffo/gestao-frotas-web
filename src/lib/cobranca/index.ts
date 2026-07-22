import type { ProvedorCobranca, ProvedorCobrancaNome } from "./provider";
import { provedorCobrancaMock } from "./mock";

// Fase P0.6 — resolve a implementação do provedor de cobrança. Os
// provedores reais (Asaas/Cora) entram quando o Daniel conectar uma conta
// de gateway de verdade — até lá, o simulador cobre boleto (fake) + PIX
// (real, via src/lib/pix.ts) sem precisar de credencial nenhuma.
export function obterProvedorCobranca(nome: ProvedorCobrancaNome): ProvedorCobranca {
  switch (nome) {
    case "mock":
      return provedorCobrancaMock;
    case "asaas":
    case "cora":
      throw new Error(
        `Provedor "${nome}" ainda não implementado — conecte uma conta de gateway real pra habilitar. Use o provedor simulado por enquanto.`
      );
  }
}

export type {
  AmbienteCobranca,
  DadosCobranca,
  ProvedorCobranca,
  ProvedorCobrancaNome,
  ResultadoCancelarCobranca,
  ResultadoConsultarCobranca,
  ResultadoGerarCobranca,
} from "./provider";
