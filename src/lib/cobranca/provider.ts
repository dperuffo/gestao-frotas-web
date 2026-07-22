// Fase P0.6 (plano FNI_Plano_Implementacao_P0.md) — camada de provedor de
// cobrança. Mesmo raciocínio de src/lib/fiscal/provider.ts: o FNI não fala
// direto com o banco/gateway — boleto registrado e PIX dinâmico passam por
// um provedor (Asaas, Cora...). Esta interface é a fronteira; trocar de
// provedor (ou usar o simulador) não muda nada fora de src/lib/cobranca/.

export type ProvedorCobrancaNome = "mock" | "asaas" | "cora";

export type AmbienteCobranca = "homologacao" | "producao";

export type DadosCobranca = {
  provedorRef: string;
  ambiente: AmbienteCobranca;
  descricao: string;
  valor: number;
  vencimento: string; // ISO date (yyyy-mm-dd)
  devedorNome: string;
  devedorCpfCnpj: string;
  // Referência única do FNI (id da conta_receber) — é o que o webhook usa
  // pra casar o evento de pagamento de volta com o título certo.
  referenciaExterna: string;
  // Dados do beneficiário (credor) pro PIX — usado pelo provedor simulado
  // pra gerar um Pix Copia e Cola REAL (fallback estático, ver src/lib/pix.ts)
  // enquanto não há gateway de verdade plugado.
  pixChaveBeneficiario?: string | null;
  pixNomeBeneficiario?: string | null;
  pixCidadeBeneficiario?: string | null;
};

export type ResultadoGerarCobranca =
  | {
      ok: true;
      gatewayRef: string;
      linhaDigitavel: string | null;
      boletoUrl: string | null;
      pixCopiaCola: string | null;
    }
  | { ok: false; erro: string };

export type ResultadoConsultarCobranca =
  | { ok: true; situacao: "pendente" | "pago" | "vencido" | "cancelado"; pagoEm?: string }
  | { ok: false; erro: string };

export type ResultadoCancelarCobranca = { ok: true } | { ok: false; erro: string };

export interface ProvedorCobranca {
  nome: ProvedorCobrancaNome;

  // Gera o boleto registrado + PIX dinâmico da cobrança e devolve a
  // referência dela no gateway (gravada em contas_receber.gateway_ref).
  gerarCobranca(dados: DadosCobranca): Promise<ResultadoGerarCobranca>;

  // Consulta o status atual no gateway — usado como reconciliação manual
  // (fallback quando o webhook falha ou atrasa).
  consultarCobranca(provedorRef: string, gatewayRef: string): Promise<ResultadoConsultarCobranca>;

  cancelarCobranca(provedorRef: string, gatewayRef: string): Promise<ResultadoCancelarCobranca>;
}
