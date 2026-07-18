import { XMLParser } from "fast-xml-parser";

// Fase Fretes-CIOT-CTe (18/07) — pedido do Daniel: registrar o CT-e de um
// frete. Mesmo espírito de src/lib/nfe.ts (upload do XML já emitido pelo
// EMITENTE fora daqui — este app nunca emite CT-e, só lê/valida
// estruturalmente e vincula ao frete). CT-e é modelo 57, envelope nacional
// padronizado (mesma família de documento fiscal da NF-e, modelo 55):
// <cteProc><CTe><infCte Id="CTe" + chave de 44 dígitos><ide>.../<emit>.../
// <vPrest>...</CTe><protCTe><infProt><cStat>100 = autorizado o uso do CT-e.
//
// Diferente da NF-e (Fase 27.94), este parser ainda não foi conferido
// contra um XML real de CT-e do Daniel — a estrutura abaixo segue o layout
// nacional oficial (Manual de Orientação ao Contribuinte do CT-e, schema
// cteTiposBasico), mas se o primeiro upload real falhar por causa de algum
// campo com nome/aninhamento diferente do esperado, é o primeiro lugar pra
// ajustar (mesmo padrão de "achado real" já usado em nfe.ts).

export type CteExtraida = {
  chaveAcesso: string;
  numeroCte: string;
  serieCte: string;
  modelo: string;
  cfop: string;
  naturezaOperacao: string;
  dataEmissao: string; // ISO 8601, vem de <dhEmi>
  modal: string; // "01" = rodoviário
  municipioInicio: string;
  ufInicio: string;
  municipioFim: string;
  ufFim: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorPrestacao: number;
  valorReceber: number;
  protocoloAutorizacao: string | null;
  statusCodigo: string; // cStat — "100" = autorizado
  motivoStatus: string; // xMotivo
  dataAutorizacao: string | null;
};

export type ResultadoParseCte =
  | { ok: true; cte: CteExtraida }
  | { ok: false; erro: string; cnpjEmitenteParcial?: string };

// parseTagValue/parseAttributeValue: false — mesmo motivo crítico já
// documentado em nfe.ts: manter chave de acesso (44 dígitos) e CNPJ como
// string, senão fast-xml-parser corrompe por perda de precisão de ponto
// flutuante / corta zeros à esquerda.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
});

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
}

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function apenasDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function parsearXmlCte(xmlTexto: string): ResultadoParseCte {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xmlTexto);
  } catch (e) {
    return { ok: false, erro: `XML mal formado: ${e instanceof Error ? e.message : "erro desconhecido"}.` };
  }

  // Aceita tanto o envelope completo <cteProc><CTe>...</CTe><protCTe>...
  // quanto um <CTe> solto (sem o protocolo de autorização anexado) — neste
  // segundo caso a autorização não pode ser conferida, e o upload é
  // rejeitado (mesmo critério rígido já usado pra NF-e: só aceitamos
  // documento AUTORIZADO, nunca rascunho/rejeitado).
  const raiz = (doc.cteProc ?? doc.CTe) as Record<string, unknown> | undefined;
  if (!raiz) {
    return { ok: false, erro: "XML não parece ser um CT-e (tag raiz <cteProc> ou <CTe> não encontrada)." };
  }

  const cte = (raiz.CTe ?? raiz) as Record<string, unknown> | undefined;
  const infCte = cte?.infCte as Record<string, unknown> | undefined;
  if (!infCte) {
    return { ok: false, erro: "Estrutura do CT-e inválida: tag <infCte> não encontrada." };
  }

  const idAttr = texto(infCte["@_Id"]);
  const chaveAcesso = idAttr.replace(/^CTe/i, "").trim();
  if (chaveAcesso.length !== 44 || !/^\d{44}$/.test(chaveAcesso)) {
    return { ok: false, erro: `Chave de acesso inválida (esperado 44 dígitos, veio "${chaveAcesso}").` };
  }

  const ide = infCte.ide as Record<string, unknown> | undefined;
  const emit = infCte.emit as Record<string, unknown> | undefined;
  const vPrest = infCte.vPrest as Record<string, unknown> | undefined;

  if (!ide || !emit) {
    return { ok: false, erro: "Estrutura do CT-e inválida: faltam os grupos <ide> e/ou <emit>." };
  }

  const modelo = texto(ide.mod);
  if (modelo !== "57") {
    return { ok: false, erro: `Este XML não é um CT-e (modelo "${modelo}", esperado "57").`, cnpjEmitenteParcial: texto(emit.CNPJ) };
  }

  const cnpjEmitente = apenasDigitos(emit.CNPJ);
  const nomeEmitente = texto(emit.xNome);

  // Protocolo de autorização (protCTe/infProt) — mesmo critério da NF-e:
  // cStat 100 é a ÚNICA situação de "autorizado o uso do CT-e"; qualquer
  // outro código (rejeitado, denegado, cancelado depois) não é um
  // documento fiscal válido pra vincular ao frete.
  const protCte = raiz.protCTe as Record<string, unknown> | undefined;
  const infProt = protCte?.infProt as Record<string, unknown> | undefined;
  const statusCodigo = texto(infProt?.cStat);
  const motivoStatus = texto(infProt?.xMotivo);

  if (!infProt) {
    return {
      ok: false,
      erro: "Este XML não tem o protocolo de autorização da SEFAZ anexado (<protCTe>) — envie o XML completo (cteProc), não só o CT-e sem o protocolo.",
      cnpjEmitenteParcial: cnpjEmitente,
    };
  }

  if (statusCodigo !== "100") {
    return {
      ok: false,
      erro: `CT-e não autorizado pela SEFAZ (status ${statusCodigo || "desconhecido"}: ${motivoStatus || "sem motivo informado"}).`,
      cnpjEmitenteParcial: cnpjEmitente,
    };
  }

  const valorPrestacao = numero(vPrest?.vTPrest);
  const valorReceber = numero(vPrest?.vRec);

  return {
    ok: true,
    cte: {
      chaveAcesso,
      numeroCte: texto(ide.nCT),
      serieCte: texto(ide.serie),
      modelo,
      cfop: texto(ide.CFOP),
      naturezaOperacao: texto(ide.natOp),
      dataEmissao: texto(ide.dhEmi),
      modal: texto(ide.modal),
      municipioInicio: texto(ide.xMunIni),
      ufInicio: texto(ide.UFIni),
      municipioFim: texto(ide.xMunFim),
      ufFim: texto(ide.UFFim),
      cnpjEmitente,
      nomeEmitente,
      valorPrestacao: Number.isFinite(valorPrestacao) ? valorPrestacao : 0,
      valorReceber: Number.isFinite(valorReceber) ? valorReceber : 0,
      protocoloAutorizacao: texto(infProt.nProt) || null,
      statusCodigo,
      motivoStatus,
      dataAutorizacao: texto(infProt.dhRecbto) || null,
    },
  };
}
