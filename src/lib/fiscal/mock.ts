import type {
  AmbienteFiscal,
  DadosEmitente,
  ProvedorFiscal,
  ResultadoCadastroEmitente,
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

function refDeterministica(empresaId: string): string {
  // Referência estável por empresa (8 primeiros chars do uuid) — reemitir o
  // cadastro não cria "outra empresa" no provedor, igual ao upsert real.
  return `mock-${empresaId.slice(0, 8)}`;
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
};
