import type {
  AmbienteFiscal,
  DadosEmissaoCte,
  DadosEmissaoMdfe,
  DadosEmitente,
  ProvedorFiscal,
  ResultadoCadastroEmitente,
  ResultadoCancelamentoCte,
  ResultadoCancelamentoMdfe,
  ResultadoCartaCorrecaoCte,
  ResultadoConsultaCte,
  ResultadoConsultaMdfe,
  ResultadoEmissaoCte,
  ResultadoEmissaoMdfe,
  ResultadoEncerramentoMdfe,
  ResultadoEnvioCertificado,
  ResultadoTesteConexao,
} from "./provider";

// Fase P0.1 — provedor MOCK: o "simulador de SEFAZ" do motor de testes
// (decisão do Daniel: desenvolver as fases P0 inteiras sem empresa
// registrada, sem certificado A1 e sem cliente-piloto — QA com massa
// sintética, mesmo espírito do gerar-exemplos-cte-teste.mjs).
//
// Comportamento determinístico, sem rede, sem estado externo. Cenários de
// erro são disparados por VALORES ESPECIAIS de entrada (documentados
// abaixo e na tela /fiscal), pra QA exercitar os caminhos tristes sem
// depender de sorte:
//
//   - senha do certificado "senha-errada"  -> erro de senha inválida
//   - arquivo .pfx com menos de 100 bytes  -> erro de arquivo corrompido
//   - ambiente "producao"                  -> teste de conexão FALHA
//     (produção real exige certificado de verdade — o mock nunca deixa
//     "passar" em produção, de propósito, pra ninguém esquecer que ele é
//     um simulador)
export const MOCK_SENHA_ERRADA = "senha-errada";
const MOCK_PFX_TAMANHO_MINIMO = 100;

// Fase P0.2 — trigger values do CT-e, mesmo espírito dos de P0.1 acima:
// valores especiais de entrada que disparam os caminhos tristes de
// propósito, pra QA não depender de sorte.
export const MOCK_CNPJ_REJEITAR_CTE = "11111111111111";
const CC_E_TAMANHO_MINIMO = 15; // regra real da SEFAZ pra carta de correção
const JUSTIFICATIVA_CANCELAMENTO_TAMANHO_MINIMO = 15; // idem, regra real de cancelamento

function refDeterministica(empresaId: string): string {
  // Referência estável por empresa (8 primeiros chars do uuid) — reemitir o
  // cadastro não cria "outra empresa" no provedor, igual ao upsert real.
  return `mock-${empresaId.slice(0, 8)}`;
}

// Dígito verificador módulo 11 da chave de acesso (mesmo algoritmo real
// usado por NF-e/CT-e/MDF-e — pesos 2..9 cíclicos da direita pra esquerda).
function digitoVerificadorModulo11(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// Compartilhado entre CT-e (modelo 57) e MDF-e (modelo 58) — mesmo layout
// nacional de chave de 44 dígitos, só o código do modelo muda.
function construirChaveAcesso(params: { cnpjEmitente: string; modelo: "57" | "58"; serie: number; numero: number }): string {
  const agora = new Date();
  const aamm = `${String(agora.getFullYear()).slice(2)}${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const cUF = "35"; // código IBGE de UF — simulado (SP); não afeta a validação estrutural do mock
  const cnpj = params.cnpjEmitente.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const serie = String(params.serie).padStart(3, "0");
  const numero = String(params.numero).padStart(9, "0");
  const tpEmis = "1";
  const codigoAleatorio = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const chave43 = `${cUF}${aamm}${cnpj}${params.modelo}${serie}${numero}${tpEmis}${codigoAleatorio}`;
  const dv = digitoVerificadorModulo11(chave43);
  return `${chave43}${dv}`;
}

function gerarChaveAcessoCte(dados: DadosEmissaoCte): string {
  return construirChaveAcesso({ cnpjEmitente: dados.cnpjEmitente, modelo: "57", serie: dados.serie, numero: dados.numero });
}

// Fase P0.3 — trigger value do MDF-e: placa reservada pra QA exercitar a
// rejeição (mesmo espírito do CNPJ de teste do CT-e acima).
export const MOCK_PLACA_REJEITAR_MDFE = "REJ0000";
const JUSTIFICATIVA_CANCELAMENTO_MDFE_MINIMO = 15;

function motivoRejeicaoSimulado(dados: DadosEmissaoCte): string | null {
  if (dados.tomador.cnpjCpf.replace(/\D/g, "") === MOCK_CNPJ_REJEITAR_CTE) {
    return `Rejeição simulada: CNPJ do tomador consta como inapto perante a Receita Federal (CNPJ de teste "${MOCK_CNPJ_REJEITAR_CTE}").`;
  }
  if (dados.destinatario.cnpjCpf.replace(/\D/g, "") === MOCK_CNPJ_REJEITAR_CTE) {
    return `Rejeição simulada: CNPJ do destinatário consta como inapto perante a Receita Federal (CNPJ de teste "${MOCK_CNPJ_REJEITAR_CTE}").`;
  }
  if (dados.valorPrestacao <= 0) {
    return "Rejeição simulada: o valor da prestação do serviço deve ser maior que zero.";
  }
  return null;
}

export const provedorMock: ProvedorFiscal = {
  nome: "mock",

  async cadastrarEmitente(dados: DadosEmitente): Promise<ResultadoCadastroEmitente> {
    const cnpjDigitos = dados.cnpj.replace(/[^0-9A-Za-z]/g, "");
    if (cnpjDigitos.length !== 14) {
      return { ok: false, erro: `CNPJ do emitente inválido ("${dados.cnpj}") — esperado 14 caracteres.` };
    }
    if (!dados.razaoSocial.trim()) {
      return { ok: false, erro: "Razão social do emitente é obrigatória." };
    }
    return { ok: true, provedorRef: refDeterministica(dados.empresaId) };
  },

  async enviarCertificado(
    _provedorRef: string,
    arquivoPfx: ArrayBuffer,
    senha: string
  ): Promise<ResultadoEnvioCertificado> {
    if (senha === MOCK_SENHA_ERRADA) {
      return { ok: false, erro: "Senha do certificado incorreta (simulado — a senha de teste proibida é 'senha-errada')." };
    }
    if (arquivoPfx.byteLength < MOCK_PFX_TAMANHO_MINIMO) {
      return { ok: false, erro: "Arquivo de certificado inválido ou corrompido (simulado — mock exige pelo menos 100 bytes)." };
    }
    // Vencimento simulado: 1 ano a partir de hoje — igual a um A1 recém
    // emitido de verdade.
    const vencimento = new Date();
    vencimento.setFullYear(vencimento.getFullYear() + 1);
    return { ok: true, vencimento: vencimento.toISOString().slice(0, 10) };
  },

  async testarConexao(provedorRef: string, ambiente: AmbienteFiscal): Promise<ResultadoTesteConexao> {
    if (!provedorRef) {
      return { ok: false, erro: "Emitente ainda não cadastrado no provedor — salve os dados fiscais primeiro." };
    }
    if (ambiente === "producao") {
      return {
        ok: false,
        erro:
          "O provedor simulado não emite em PRODUÇÃO — de propósito. Para produção, configure um provedor real (Focus NFe/PlugNotas) com certificado A1 verdadeiro.",
      };
    }
    return { ok: true, mensagem: `Conexão OK (simulador, homologação) — emitente ${provedorRef} pronto para emitir CT-e de teste.` };
  },

  async emitirCte(dados: DadosEmissaoCte): Promise<ResultadoEmissaoCte> {
    if (dados.ambiente === "producao") {
      return {
        ok: false,
        erro:
          "O provedor simulado não emite em PRODUÇÃO — de propósito. Configure um provedor real (Focus NFe/PlugNotas) com certificado A1 verdadeiro.",
      };
    }

    const motivoRejeicao = motivoRejeicaoSimulado(dados);
    if (motivoRejeicao) {
      return { ok: true, situacao: "rejeitado", motivoRejeicao };
    }

    return {
      ok: true,
      situacao: "autorizado",
      chaveAcesso: gerarChaveAcessoCte(dados),
      numeroCte: String(dados.numero),
      serieCte: String(dados.serie),
      protocoloAutorizacao: `MOCK${Date.now()}`,
      dataAutorizacao: new Date().toISOString(),
    };
  },

  async consultarCte(provedorRef: string, chaveAcesso: string): Promise<ResultadoConsultaCte> {
    if (!provedorRef) {
      return { ok: false, erro: "Emitente ainda não cadastrado no provedor." };
    }
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    // Simulador sem estado externo — a situação "de verdade" já está no
    // nosso próprio banco (atualizada via webhook); esta consulta só serve
    // como fallback de reconciliação e aqui sempre confirma autorizado.
    return { ok: true, situacao: "autorizado" };
  },

  async cancelarCte(
    _provedorRef: string,
    chaveAcesso: string,
    justificativa: string
  ): Promise<ResultadoCancelamentoCte> {
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    if (justificativa.trim().length < JUSTIFICATIVA_CANCELAMENTO_TAMANHO_MINIMO) {
      return {
        ok: false,
        erro: `A justificativa do cancelamento precisa ter pelo menos ${JUSTIFICATIVA_CANCELAMENTO_TAMANHO_MINIMO} caracteres (regra real da SEFAZ).`,
      };
    }
    return { ok: true, protocoloCancelamento: `MOCKCANC${Date.now()}` };
  },

  async cartaCorrecaoCte(
    _provedorRef: string,
    chaveAcesso: string,
    textoCorrecao: string
  ): Promise<ResultadoCartaCorrecaoCte> {
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    if (textoCorrecao.trim().length < CC_E_TAMANHO_MINIMO) {
      return {
        ok: false,
        erro: `O texto da carta de correção precisa ter pelo menos ${CC_E_TAMANHO_MINIMO} caracteres (regra real da SEFAZ).`,
      };
    }
    return { ok: true, sequencia: 1, protocolo: `MOCKCCE${Date.now()}` };
  },

  async emitirMdfe(dados: DadosEmissaoMdfe): Promise<ResultadoEmissaoMdfe> {
    if (dados.ambiente === "producao") {
      return {
        ok: false,
        erro:
          "O provedor simulado não emite em PRODUÇÃO — de propósito. Configure um provedor real (Focus NFe/PlugNotas) com certificado A1 verdadeiro.",
      };
    }
    if (dados.chavesCte.length === 0) {
      return { ok: true, situacao: "rejeitado", motivoRejeicao: "MDF-e sem nenhum CT-e a bordo — inclua ao menos um CT-e autorizado." };
    }
    if (dados.placaVeiculo.trim().toUpperCase() === MOCK_PLACA_REJEITAR_MDFE) {
      return {
        ok: true,
        situacao: "rejeitado",
        motivoRejeicao: `Rejeição simulada: placa "${MOCK_PLACA_REJEITAR_MDFE}" consta com pendência no RENAVAM (placa de teste).`,
      };
    }

    // CNPJ do emitente do MDF-e (transportadora) vem embutido no
    // provedorRef no formato "mock-<8 primeiros chars do empresa_id>" — o
    // mock não conhece o CNPJ de verdade aqui, então usa a própria
    // provedorRef como semente da chave (mesma robustez, sem precisar
    // encanar mais um campo só pro simulador).
    return {
      ok: true,
      situacao: "autorizado",
      chaveAcesso: construirChaveAcesso({ cnpjEmitente: dados.provedorRef, modelo: "58", serie: dados.serie, numero: dados.numero }),
      numeroMdfe: String(dados.numero),
      serieMdfe: String(dados.serie),
      protocoloAutorizacao: `MOCKMDFE${Date.now()}`,
      dataAutorizacao: new Date().toISOString(),
    };
  },

  async consultarMdfe(provedorRef: string, chaveAcesso: string): Promise<ResultadoConsultaMdfe> {
    if (!provedorRef) return { ok: false, erro: "Emitente ainda não cadastrado no provedor." };
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    return { ok: true, situacao: "autorizado" };
  },

  async encerrarMdfe(_provedorRef: string, chaveAcesso: string): Promise<ResultadoEncerramentoMdfe> {
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    return { ok: true, protocoloEncerramento: `MOCKENC${Date.now()}` };
  },

  async cancelarMdfe(_provedorRef: string, chaveAcesso: string, justificativa: string): Promise<ResultadoCancelamentoMdfe> {
    if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
      return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
    }
    if (justificativa.trim().length < JUSTIFICATIVA_CANCELAMENTO_MDFE_MINIMO) {
      return {
        ok: false,
        erro: `A justificativa do cancelamento precisa ter pelo menos ${JUSTIFICATIVA_CANCELAMENTO_MDFE_MINIMO} caracteres (regra real da SEFAZ).`,
      };
    }
    return { ok: true, protocoloCancelamento: `MOCKMDFECANC${Date.now()}` };
  },
};
