// Fase P0.1 — camada de provedor fiscal (plano FNI_Plano_Implementacao_P0.md).
// O FNI NÃO fala com a SEFAZ diretamente: emissão de CT-e/MDF-e passa por um
// provedor de API fiscal (Focus NFe, PlugNotas...). Esta interface é a
// fronteira — telas e actions só conhecem estes tipos; trocar de provedor
// (ou usar o simulador de testes) não muda nada fora de src/lib/fiscal/.
//
// Lição do caso Nuvem Fiscal (desativação anunciada pra 31/07/2026, achado
// na pesquisa da P0): isolar o fornecedor atrás de uma interface própria
// não é luxo — é o que permite migrar sem reescrever o app.

export type ProvedorNome = "mock" | "focusnfe" | "plugnotas";

export type AmbienteFiscal = "homologacao" | "producao";

export type DadosEmitente = {
  empresaId: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoEstadual: string | null;
  regimeTributario: "simples" | "presumido" | "real";
  ambiente: AmbienteFiscal;
};

export type ResultadoCadastroEmitente =
  | { ok: true; provedorRef: string }
  | { ok: false; erro: string };

export type ResultadoEnvioCertificado =
  | { ok: true; vencimento: string } // ISO date (yyyy-mm-dd)
  | { ok: false; erro: string };

export type ResultadoTesteConexao =
  | { ok: true; mensagem: string }
  | { ok: false; erro: string };

export interface ProvedorFiscal {
  nome: ProvedorNome;

  // Cria/atualiza a empresa emitente no provedor e devolve a referência
  // (id) dela lá — gravada em empresas_fiscal.provedor_ref.
  cadastrarEmitente(dados: DadosEmitente): Promise<ResultadoCadastroEmitente>;

  // Envia o certificado A1 (.pfx + senha) DIRETO ao provedor. O arquivo
  // nunca é persistido no FNI — só o vencimento retornado.
  enviarCertificado(
    provedorRef: string,
    arquivoPfx: ArrayBuffer,
    senha: string
  ): Promise<ResultadoEnvioCertificado>;

  // Confere se o emitente está pronto pra emitir no ambiente configurado
  // (credenciais válidas, certificado aceito etc.).
  testarConexao(provedorRef: string, ambiente: AmbienteFiscal): Promise<ResultadoTesteConexao>;

  // P0.2 (próxima fase) estende esta interface com:
  // emitirCte / consultarCte / cancelarCte / cartaCorrecaoCte
  // P0.3: emitirMdfe / encerrarMdfe / cancelarMdfe
}
