import type { ProvedorFiscal, ProvedorNome } from "./provider";
import { provedorMock } from "./mock";

// Fase P0.1 — resolve a implementação do provedor fiscal a partir do valor
// gravado em empresas_fiscal.provedor. Os provedores reais entram na P0.2+
// (a integração de emissão vem junto com o primeiro CT-e real) — até lá,
// selecionar um deles na tela avisa que ainda não está disponível.
export function obterProvedorFiscal(nome: ProvedorNome): ProvedorFiscal {
  switch (nome) {
    case "mock":
      return provedorMock;
    case "focusnfe":
    case "plugnotas":
      throw new Error(
        `Provedor "${nome}" ainda não implementado — a integração real chega na Fase P0.2 (emissão de CT-e). Use o provedor simulado por enquanto.`
      );
  }
}

export type {
  AmbienteFiscal,
  DadosEmissaoCte,
  DadosEmissaoMdfe,
  DadosEmitente,
  DadosEndereco,
  DadosParceiro,
  PapelTomador,
  ProvedorFiscal,
  ProvedorNome,
  ResultadoCadastroEmitente,
  ResultadoCancelamentoCte,
  ResultadoCancelamentoMdfe,
  ResultadoCartaCorrecaoCte,
  ResultadoConsultaCte,
  ResultadoConsultaMdfe,
  ResultadoEmissaoCte,
  ResultadoEmissaoMdfe,
  ResultadoEncerramentoMdfe,
} from "./provider";
