import { XMLParser } from "fast-xml-parser";

// Fase P0.4 (plano FNI_Plano_Implementacao_P0.md) — romaneio: NF-e do
// EMBARCADOR (a carga transportada no frete), não a NF-e de venda de
// combustível de src/lib/nfe.ts. São propósitos diferentes: nfe.ts exige o
// grupo <det><prod><comb> (obrigatório só em NF-e de combustível) e rejeita
// qualquer NF-e sem ele — ou seja, NÃO SERVE pra carga geral (eletrônicos,
// alimentos, peças etc.), mesmo sendo o mesmo modelo 55. Este parser lê
// peso/volume do grupo <transp><vol> (obrigatório em NF-e com transporte),
// que é exatamente o que alimenta o "manifesto de carga" do CT-e/MDF-e.

export type NfeCargaExtraida = {
  chaveAcesso: string;
  numeroNf: number;
  serieNf: string;
  naturezaOperacao: string;
  dataEmissao: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  valorNf: number;
  pesoBrutoKg: number | null;
  pesoLiquidoKg: number | null;
  quantidadeVolumes: number | null;
  especieVolume: string | null;
};

export type ResultadoParseNfeCarga = { ok: true; nfe: NfeCargaExtraida } | { ok: false; erro: string };

// Mesmo cuidado de nfe.ts/cte.ts: manter tudo como string (chave de acesso e
// CNPJ não podem passar por conversão numérica do parser).
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (nome) => nome === "vol",
});

function texto(v: unknown): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v);
}

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function apenasDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function parsearXmlNfeCarga(xmlTexto: string): ResultadoParseNfeCarga {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xmlTexto);
  } catch (e) {
    return { ok: false, erro: `XML mal formado: ${e instanceof Error ? e.message : "erro desconhecido"}.` };
  }

  const nfeProc = doc.nfeProc as Record<string, unknown> | undefined;
  const nfe = (nfeProc?.NFe ?? doc.NFe) as Record<string, unknown> | undefined;
  const infNFe = nfe?.infNFe as Record<string, unknown> | undefined;
  if (!infNFe) {
    return { ok: false, erro: "O XML não parece ser uma NF-e (tag <infNFe> não encontrada)." };
  }

  const ide = infNFe.ide as Record<string, unknown> | undefined;
  const emit = infNFe.emit as Record<string, unknown> | undefined;
  const dest = infNFe.dest as Record<string, unknown> | undefined;
  const total = infNFe.total as Record<string, unknown> | undefined;
  const transp = infNFe.transp as Record<string, unknown> | undefined;
  if (!ide || !emit || !dest || !total) {
    return { ok: false, erro: "O XML está incompleto — faltam informações obrigatórias da NF-e (ide/emit/dest/total)." };
  }

  const modelo = texto(ide.mod);
  if (modelo !== "55") {
    return { ok: false, erro: `Este XML é modelo ${modelo || "desconhecido"} — só NF-e modelo 55 é aceita.` };
  }

  const protNFe = nfeProc?.protNFe as Record<string, unknown> | undefined;
  const infProt = protNFe?.infProt as Record<string, unknown> | undefined;
  if (!infProt) {
    return {
      ok: false,
      erro: "O XML não tem o protocolo de autorização da SEFAZ anexado (<protNFe>) — envie o XML completo, não só o assinado.",
    };
  }
  const cStat = texto(infProt.cStat);
  if (cStat !== "100") {
    return { ok: false, erro: `Esta NF-e não está autorizada pela SEFAZ (status ${cStat || "?"}: ${texto(infProt.xMotivo) || "sem motivo"}).` };
  }

  const chaveAcesso = apenasDigitos(infProt.chNFe ?? texto(infNFe["@_Id"]).replace(/^NFe/i, ""));
  if (!/^\d{44}$/.test(chaveAcesso)) {
    return { ok: false, erro: "Não foi possível identificar a chave de acesso (44 dígitos) desta NF-e." };
  }

  const cnpjEmitente = apenasDigitos(emit.CNPJ);
  const cnpjDestinatario = apenasDigitos(dest.CNPJ);
  if (cnpjEmitente.length !== 14) return { ok: false, erro: "CNPJ do emitente inválido ou ausente no XML." };
  if (cnpjDestinatario.length !== 14) return { ok: false, erro: "CNPJ do destinatário inválido ou ausente no XML." };

  const valorNf = numero((total.ICMSTot as Record<string, unknown> | undefined)?.vNF);
  if (!Number.isFinite(valorNf)) return { ok: false, erro: "Não foi possível ler o valor total da NF-e (total.ICMSTot.vNF)." };

  // <transp><vol> é onde a NF-e declara peso/volume da carga pro
  // transporte — pode vir 1 ou vários volumes; somamos tudo (mesmo
  // critério que o CT-e/MDF-e usam pra compor o manifesto).
  const volBruto = transp?.vol;
  const vols = (Array.isArray(volBruto) ? volBruto : volBruto ? [volBruto] : []) as Record<string, unknown>[];
  let pesoBrutoKg: number | null = null;
  let pesoLiquidoKg: number | null = null;
  let quantidadeVolumes: number | null = null;
  let especieVolume: string | null = null;
  for (const v of vols) {
    const pesoB = numero(v.pesoB);
    const pesoL = numero(v.pesoL);
    const qVol = numero(v.qVol);
    if (Number.isFinite(pesoB)) pesoBrutoKg = (pesoBrutoKg ?? 0) + pesoB;
    if (Number.isFinite(pesoL)) pesoLiquidoKg = (pesoLiquidoKg ?? 0) + pesoL;
    if (Number.isFinite(qVol)) quantidadeVolumes = (quantidadeVolumes ?? 0) + qVol;
    if (!especieVolume && v.esp) especieVolume = texto(v.esp);
  }

  return {
    ok: true,
    nfe: {
      chaveAcesso,
      numeroNf: numero(ide.nNF),
      serieNf: texto(ide.serie),
      naturezaOperacao: texto(ide.natOp),
      dataEmissao: texto(ide.dhEmi),
      cnpjEmitente,
      nomeEmitente: texto(emit.xNome),
      cnpjDestinatario,
      nomeDestinatario: texto(dest.xNome),
      valorNf,
      pesoBrutoKg,
      pesoLiquidoKg,
      quantidadeVolumes,
      especieVolume,
    },
  };
}
