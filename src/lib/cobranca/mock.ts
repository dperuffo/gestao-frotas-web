import type {
  DadosCobranca,
  ProvedorCobranca,
  ResultadoCancelarCobranca,
  ResultadoConsultarCobranca,
  ResultadoGerarCobranca,
} from "./provider";
import { gerarPayloadPix } from "@/lib/pix";

// Fase P0.6 — provedor MOCK de cobrança: mesmo espírito do simulador fiscal
// (src/lib/fiscal/mock.ts) — determinístico, sem rede, nunca "passa" em
// ambiente de produção. Duas peças bem diferentes:
//
//   - PIX: gera um Pix Copia e Cola DE VERDADE (BR Code padrão Bacen, via
//     src/lib/pix.ts) — não é fake, é o mesmo mecanismo estático que já
//     funciona em faturas_postos. O plano cita esse QR estático como
//     "fallback" do PIX dinâmico do gateway — aqui ele já nasce sendo usado,
//     porque é real e não depende de credencial nenhuma.
//   - Boleto registrado: ESSE sim é 100% simulado (linha digitável fake,
//     sem registro bancário nenhum) — um boleto registrado de verdade exige
//     conta em banco/gateway homologada, que não temos ainda. Fica marcado
//     "(simulado)" em todo lugar que aparece, de propósito.
//
// Trigger value de erro, mesmo padrão dos outros mocks do projeto:
export const MOCK_CPF_CNPJ_RECUSAR = "00000000000000";

function linhaDigitavelFake(seed: string): string {
  // Gera 47 dígitos pseudo-aleatórios, mas determinísticos a partir do seed
  // (mesma cobrança sempre gera a mesma linha) — só pra ter "cara" de boleto
  // na tela, nunca é enviado a banco nenhum.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let digitos = "";
  let x = h || 1;
  while (digitos.length < 47) {
    x = (x * 1103515245 + 12345) >>> 0;
    digitos += String(x % 10);
  }
  return digitos.slice(0, 47);
}

export const provedorCobrancaMock: ProvedorCobranca = {
  nome: "mock",

  async gerarCobranca(dados: DadosCobranca): Promise<ResultadoGerarCobranca> {
    if (dados.ambiente === "producao") {
      return {
        ok: false,
        erro:
          "O provedor simulado não gera cobrança em PRODUÇÃO — de propósito. Configure um gateway real (Asaas/Cora) pra produção.",
      };
    }
    const cpfCnpjDigitos = dados.devedorCpfCnpj.replace(/\D/g, "");
    if (!cpfCnpjDigitos || cpfCnpjDigitos === MOCK_CPF_CNPJ_RECUSAR) {
      return { ok: false, erro: `CPF/CNPJ do devedor inválido (simulado — "${MOCK_CPF_CNPJ_RECUSAR}" é o valor de teste que sempre recusa).` };
    }
    if (dados.valor <= 0) {
      return { ok: false, erro: "O valor da cobrança precisa ser maior que zero." };
    }

    const gatewayRef = `mock_${dados.referenciaExterna}`;

    let pixCopiaCola: string | null = null;
    if (dados.pixChaveBeneficiario) {
      pixCopiaCola = gerarPayloadPix({
        chave: dados.pixChaveBeneficiario,
        nomeBeneficiario: dados.pixNomeBeneficiario ?? "FNI",
        cidadeBeneficiario: dados.pixCidadeBeneficiario ?? "SAO PAULO",
        valor: dados.valor,
        txid: gatewayRef.slice(0, 25),
      });
    }

    return {
      ok: true,
      gatewayRef,
      linhaDigitavel: linhaDigitavelFake(gatewayRef),
      boletoUrl: null,
      pixCopiaCola,
    };
  },

  async consultarCobranca(_provedorRef: string, gatewayRef: string): Promise<ResultadoConsultarCobranca> {
    if (!gatewayRef.startsWith("mock_")) {
      return { ok: false, erro: "Referência de cobrança não pertence ao provedor simulado." };
    }
    // Simulador sem estado externo — a situação "de verdade" mora no nosso
    // banco (contas_receber, atualizado via botão manual ou webhook); esta
    // consulta é só reconciliação de fallback e aqui sempre devolve
    // "pendente" (quem quer testar a baixa usa o webhook ou o botão "Marcar
    // como paga").
    return { ok: true, situacao: "pendente" };
  },

  async cancelarCobranca(_provedorRef: string, gatewayRef: string): Promise<ResultadoCancelarCobranca> {
    if (!gatewayRef.startsWith("mock_")) {
      return { ok: false, erro: "Referência de cobrança não pertence ao provedor simulado." };
    }
    return { ok: true };
  },
};
