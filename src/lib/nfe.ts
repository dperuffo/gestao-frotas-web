import { XMLParser } from "fast-xml-parser";

// Fase 27.94 — pedido do Daniel: upload do XML da NF-e (modelo 55, venda de
// combustível) emitida pelo posto ao cliente, pra documentar o abastecimento
// que ela cobre. Este módulo só faz a leitura/crítica ESTRUTURAL do XML —
// nenhuma consulta ao banco acontece aqui (isso é feito depois, nas RPCs
// buscar_abastecimentos_candidatos_nota_fiscal/inserir_nota_fiscal_abastecimento,
// que revalidam tudo de novo server-side).
//
// Estrutura real conferida no XML de exemplo que o Daniel anexou (NFe de um
// posto real, Rede Dom Pedro, autorizada pela SEFAZ-MG): a nota vem
// envelopada em <nfeProc><NFe><infNFe>..., com o protocolo de autorização em
// <protNFe><infProt> (cStat 100 = autorizada). O grupo de combustível
// (<det><prod><comb>) é obrigatório na NF-e de venda de combustível — é dali
// que sai o cProdANP/descANP usados na crítica rígida contra a tabela ANP
// (Fase 27.94, decisão do Daniel via AskUserQuestion).

export type NfeExtraida = {
  chaveAcesso: string;
  numeroNf: number;
  serieNf: string;
  modelo: string;
  dataEmissao: string; // ISO 8601, com timezone (vem direto de <dhEmi>)
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  produtoNomeXml: string;
  produtoCodigoAnp: string;
  produtoDescricaoAnp: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorNfTotal: number;
};

export type ResultadoParseNfe = { ok: true; nfe: NfeExtraida } | { ok: false; erro: string };

// Fase 27.94 — achado real testando com o XML de exemplo do Daniel:
// fast-xml-parser, por padrão, converte texto "numérico" pra JS `number`
// (parseTagValue: true) — isso CORROMPE a chave de acesso (44 dígitos) por
// perda de precisão de ponto flutuante (virou notação científica,
// "3.126072...e+43", em vez dos 44 dígitos exatos) e comeria zeros à
// esquerda de CNPJ/código ANP. parseTagValue/parseAttributeValue: false
// mantém tudo como string; a conversão pros campos que REALMENTE precisam
// virar número (litros, preço, valor) é feita manualmente por numero().
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (nome) => nome === "det" || nome === "origComb" || nome === "autXML",
});

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function apenasDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

// Fase 27.94 — a NF-e pode vir como <nfeProc><NFe>... (com protocolo de
// autorização anexado, o formato normal de download no portal do posto) ou,
// mais raramente, só <NFe>... (XML assinado mas sem o protocolo anexado
// ainda). Aceitamos os dois, mas exigimos o protocolo com cStat=100 mais
// abaixo — sem isso não dá pra confirmar que a nota foi de fato autorizada.
export function parsearXmlNfe(xmlTexto: string): ResultadoParseNfe {
  let doc: unknown;
  try {
    doc = parser.parse(xmlTexto);
  } catch {
    return { ok: false, erro: "O arquivo não é um XML válido." };
  }

  const raiz = doc as Record<string, unknown>;
  const nfeProc = raiz.nfeProc as Record<string, unknown> | undefined;
  const nfe = (nfeProc?.NFe ?? raiz.NFe) as Record<string, unknown> | undefined;
  const infNFe = nfe?.infNFe as Record<string, unknown> | undefined;

  if (!infNFe) {
    return { ok: false, erro: "O XML não parece ser uma NF-e (tag <infNFe> não encontrada)." };
  }

  const ide = infNFe.ide as Record<string, unknown> | undefined;
  const emit = infNFe.emit as Record<string, unknown> | undefined;
  const dest = infNFe.dest as Record<string, unknown> | undefined;
  const detBruto = infNFe.det;
  const total = infNFe.total as Record<string, unknown> | undefined;

  if (!ide || !emit || !dest || !total) {
    return { ok: false, erro: "O XML está incompleto — faltam informações obrigatórias da NF-e (ide/emit/dest/total)." };
  }

  const modelo = String(ide.mod ?? "");
  if (modelo !== "55") {
    return { ok: false, erro: `Este XML é modelo ${modelo || "desconhecido"} — só NF-e modelo 55 (venda de produto) é aceita.` };
  }

  const protNFe = nfeProc?.protNFe as Record<string, unknown> | undefined;
  const infProt = protNFe?.infProt as Record<string, unknown> | undefined;
  const cStat = infProt ? String(infProt.cStat ?? "") : "";
  if (!infProt) {
    return {
      ok: false,
      erro: "O XML não tem o protocolo de autorização da SEFAZ anexado (<protNFe>). Baixe o XML \"completo\" (com protocolo), não só o XML assinado.",
    };
  }
  if (cStat !== "100") {
    return {
      ok: false,
      erro: `Esta NF-e não está autorizada pela SEFAZ (status ${cStat || "?"}: ${infProt.xMotivo ?? "motivo não informado"}).`,
    };
  }

  const chaveAcesso = apenasDigitos(infProt.chNFe ?? (infNFe["@_Id"] as string | undefined)?.replace(/^NFe/, ""));
  if (!/^\d{44}$/.test(chaveAcesso)) {
    return { ok: false, erro: "Não foi possível identificar a chave de acesso (44 dígitos) desta NF-e." };
  }

  const dets = (Array.isArray(detBruto) ? detBruto : detBruto ? [detBruto] : []) as Record<string, unknown>[];
  const detsComCombustivel = dets.filter((d) => {
    const prod = d.prod as Record<string, unknown> | undefined;
    return !!prod?.comb;
  });

  if (detsComCombustivel.length === 0) {
    return { ok: false, erro: "Esta NF-e não tem nenhum item de venda de combustível (grupo <comb> ausente)." };
  }
  if (detsComCombustivel.length > 1) {
    return {
      ok: false,
      erro:
        "Esta NF-e tem mais de um item de combustível — nesta 1ª entrega só é aceita 1 NF-e por abastecimento (1 item de combustível por nota).",
    };
  }

  const prod = detsComCombustivel[0].prod as Record<string, unknown>;
  const comb = prod.comb as Record<string, unknown>;

  const cnpjEmitente = apenasDigitos(emit.CNPJ);
  const cnpjDestinatario = apenasDigitos(dest.CNPJ);
  if (cnpjEmitente.length !== 14) {
    return { ok: false, erro: "CNPJ do emitente inválido ou ausente no XML." };
  }
  if (cnpjDestinatario.length !== 14) {
    return { ok: false, erro: "CNPJ do destinatário inválido ou ausente no XML." };
  }

  const quantidade = numero(prod.qCom);
  const valorUnitario = numero(prod.vUnCom);
  const valorTotal = numero(prod.vProd);
  const valorNfTotal = numero((total.ICMSTot as Record<string, unknown> | undefined)?.vNF);
  const numeroNf = numero(ide.nNF);
  const dataEmissao = String(ide.dhEmi ?? "");

  if (!Number.isFinite(quantidade) || !Number.isFinite(valorUnitario) || !Number.isFinite(valorTotal)) {
    return { ok: false, erro: "Não foi possível ler quantidade/valor do item de combustível no XML." };
  }
  if (!Number.isFinite(numeroNf) || !dataEmissao) {
    return { ok: false, erro: "Não foi possível ler o número ou a data de emissão da NF-e." };
  }
  if (!comb.cProdANP || !comb.descANP) {
    return { ok: false, erro: "O item de combustível não traz o código ANP (cProdANP/descANP)." };
  }

  return {
    ok: true,
    nfe: {
      chaveAcesso,
      numeroNf,
      serieNf: String(ide.serie ?? ""),
      modelo,
      dataEmissao,
      cnpjEmitente,
      nomeEmitente: String(emit.xNome ?? ""),
      cnpjDestinatario,
      nomeDestinatario: String(dest.xNome ?? ""),
      produtoNomeXml: String(prod.xProd ?? ""),
      produtoCodigoAnp: String(comb.cProdANP),
      produtoDescricaoAnp: String(comb.descANP),
      quantidade,
      valorUnitario,
      valorTotal,
      valorNfTotal: Number.isFinite(valorNfTotal) ? valorNfTotal : valorTotal,
    },
  };
}

// Mensagens amigáveis pros códigos de pendência devolvidos pelas RPCs de
// inserção (inserir_nota_fiscal_abastecimento) — usadas tanto na Server
// Action (upload pelo navegador) quanto na API de integração (resposta JSON
// pro ERP do posto).
export function mensagemMotivoPendencia(motivo: string | undefined): string {
  switch (motivo) {
    case "modelo_invalido":
      return "O XML não é uma NF-e modelo 55.";
    case "posto_nao_encontrado":
      return "O CNPJ do emitente não corresponde a nenhum posto cadastrado na plataforma.";
    case "cliente_nao_encontrado":
      return "O CNPJ do destinatário não corresponde a nenhum cliente cadastrado na plataforma.";
    case "nao_autorizado":
      return "Você não tem permissão para vincular NF-e a este posto.";
    case "abastecimento_nao_encontrado":
      return "O abastecimento indicado não foi encontrado.";
    case "abastecimento_ja_tem_nota":
      return "Esse abastecimento já tem uma NF-e vinculada.";
    case "cnpj_nao_corresponde_ao_abastecimento":
      return "Os CNPJ da NF-e não correspondem aos do abastecimento selecionado.";
    case "fora_da_tolerancia":
      return "A quantidade ou o valor da NF-e estão fora da margem aceita em relação ao abastecimento (até 0,5 L ou 2% de diferença).";
    case "codigo_anp_invalido":
      return "O código ANP informado na NF-e não é um código ANP válido.";
    case "combustivel_sem_mapeamento_anp":
      return "Não há um código ANP cadastrado para o combustível deste abastecimento — avise o suporte da FNI.";
    case "codigo_anp_nao_corresponde":
      return "O código ANP da NF-e não corresponde ao combustível deste abastecimento.";
    case "chave_duplicada":
      return "Esta NF-e já foi cadastrada anteriormente.";
    default:
      return "Não foi possível validar esta NF-e.";
  }
}
