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

// Fase P0.2 — tipos de emissão de CT-e. "Tomador" é quem PAGA o frete (nem
// sempre é o remetente nem o destinatário — pode ser um terceiro); por isso
// tem um campo `papel` próprio (CT-e chama isso de "toma" — 0 a 4).
export type DadosEndereco = {
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

export type DadosParceiro = {
  cnpjCpf: string;
  razaoSocial: string;
  ie?: string | null;
  endereco: DadosEndereco;
};

export type PapelTomador = "remetente" | "expedidor" | "recebedor" | "destinatario" | "outros";

export type DadosIcmsCte = {
  cst: string;
  baseCalculo: number;
  aliquota: number;
  valor: number;
};

export type DadosEmissaoCte = {
  provedorRef: string;
  ambiente: AmbienteFiscal;
  // CNPJ de quem EMITE o CT-e (a transportadora/empresa, não o remetente da
  // carga) — é esse CNPJ que compõe a chave de acesso, mesma regra da NF-e.
  cnpjEmitente: string;
  serie: number;
  numero: number;
  naturezaOperacao: string;
  cfop: string;
  municipioInicio: string;
  ufInicio: string;
  municipioFim: string;
  ufFim: string;
  valorPrestacao: number;
  valorReceber: number;
  remetente: DadosParceiro;
  destinatario: DadosParceiro;
  tomador: DadosParceiro & { papel: PapelTomador };
  chavesNfe: string[];
  icms: DadosIcmsCte;
};

// autorizado/rejeitado são os dois desfechos de NEGÓCIO (a SEFAZ recebeu e
// validou); `ok: false` é reservado pra falha de COMUNICAÇÃO/infra (fora do
// ar, timeout etc.) — distinção importante pra tela saber se pode tentar de
// novo (infra) ou se precisa corrigir os dados (rejeição).
export type ResultadoEmissaoCte =
  | {
      ok: true;
      situacao: "autorizado";
      chaveAcesso: string;
      numeroCte: string;
      serieCte: string;
      protocoloAutorizacao: string;
      dataAutorizacao: string;
    }
  | { ok: true; situacao: "rejeitado"; motivoRejeicao: string }
  | { ok: false; erro: string };

export type ResultadoConsultaCte =
  | { ok: true; situacao: "autorizado" | "cancelado" | "rejeitado" | "processando"; motivoRejeicao?: string }
  | { ok: false; erro: string };

export type ResultadoCancelamentoCte = { ok: true; protocoloCancelamento: string } | { ok: false; erro: string };

export type ResultadoCartaCorrecaoCte = { ok: true; sequencia: number; protocolo: string } | { ok: false; erro: string };

// Fase P0.3 — tipos de emissão de MDF-e. "1 viagem = 1 MDF-e por veículo,
// agrupando N CT-e" (e, quando a carga é fracionada, N NF-e também).
export type DadosEmissaoMdfe = {
  provedorRef: string;
  ambiente: AmbienteFiscal;
  serie: number;
  numero: number;
  ufCarregamento: string;
  ufDescarregamento: string;
  percursoUf: string[];
  placaVeiculo: string;
  condutorNome: string;
  condutorCpf: string;
  condutorAdicionalNome?: string | null;
  condutorAdicionalCpf?: string | null;
  chavesCte: string[];
  chavesNfe: string[];
};

export type ResultadoEmissaoMdfe =
  | {
      ok: true;
      situacao: "autorizado";
      chaveAcesso: string;
      numeroMdfe: string;
      serieMdfe: string;
      protocoloAutorizacao: string;
      dataAutorizacao: string;
    }
  | { ok: true; situacao: "rejeitado"; motivoRejeicao: string }
  | { ok: false; erro: string };

export type ResultadoConsultaMdfe =
  | { ok: true; situacao: "autorizado" | "encerrado" | "cancelado" | "rejeitado" | "processando" }
  | { ok: false; erro: string };

export type ResultadoEncerramentoMdfe = { ok: true; protocoloEncerramento: string } | { ok: false; erro: string };
export type ResultadoCancelamentoMdfe = { ok: true; protocoloCancelamento: string } | { ok: false; erro: string };

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

  // Fase P0.2 — emissão/consulta/cancelamento/carta de correção de CT-e.
  emitirCte(dados: DadosEmissaoCte): Promise<ResultadoEmissaoCte>;
  consultarCte(provedorRef: string, chaveAcesso: string): Promise<ResultadoConsultaCte>;
  cancelarCte(provedorRef: string, chaveAcesso: string, justificativa: string): Promise<ResultadoCancelamentoCte>;
  cartaCorrecaoCte(provedorRef: string, chaveAcesso: string, textoCorrecao: string): Promise<ResultadoCartaCorrecaoCte>;

  // Fase P0.3 — emissão/consulta/encerramento/cancelamento de MDF-e.
  emitirMdfe(dados: DadosEmissaoMdfe): Promise<ResultadoEmissaoMdfe>;
  consultarMdfe(provedorRef: string, chaveAcesso: string): Promise<ResultadoConsultaMdfe>;
  encerrarMdfe(provedorRef: string, chaveAcesso: string): Promise<ResultadoEncerramentoMdfe>;
  cancelarMdfe(provedorRef: string, chaveAcesso: string, justificativa: string): Promise<ResultadoCancelamentoMdfe>;
}
