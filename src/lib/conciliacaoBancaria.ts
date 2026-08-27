import { createHash } from "crypto";

// Fase Grupo 1 Rodopar item 3 (03/08/2026, benchmark FNI vs Rodopar/Datapar)
// — Conciliação bancária simples. Gap identificado: Rodopar tem módulo
// "Banco" (conciliação de extrato); a FNI não tinha nenhum fluxo de extrato
// bancário. Escopo deliberadamente simples (sem Open Finance/API de banco):
// importa OFX ou CSV exportado do próprio internet banking, sugere vínculo
// com contas_pagar/contas_receber já existentes (por valor + proximidade de
// data) e confirma a baixa reaproveitando as RPCs baixar_conta_pagar/
// baixar_conta_receber já usadas em /financeiro — não duplica lógica de
// baixa, só alimenta ela a partir do extrato.

export type TipoLancamentoExtrato = "credito" | "debito";

export type LancamentoExtratoImportado = {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number; // sempre positivo aqui — o tipo (credito/debito) carrega o sinal
  tipo: TipoLancamentoExtrato;
  identificadorExterno: string | null; // FITID do OFX, quando existir
};

export const STATUS_EXTRATO_LABEL: Record<string, string> = {
  pendente: "Pendente",
  conciliado: "Conciliado",
  ignorado: "Ignorado",
};

export const STATUS_EXTRATO_COR: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  conciliado: "bg-green-100 text-green-800",
  ignorado: "bg-slate-100 text-slate-600",
};

// Hash de dedupe: mesmo empresa+data+valor+descricao normalizada não entra
// duas vezes, mesmo reimportando o mesmo período (comum quando o usuário
// baixa "últimos 90 dias" toda semana). Não usa o FITID como chave primária
// de dedupe porque CSVs exportados manualmente não têm FITID.
export function calcularHashDedupe(args: { empresaId: string; data: string; valor: number; descricao: string }): string {
  const chave = `${args.empresaId}|${args.data}|${args.valor.toFixed(2)}|${args.descricao.trim().toLowerCase().replace(/\s+/g, " ")}`;
  return createHash("sha256").update(chave).digest("hex");
}

// --- OFX (formato padrão de exportação de extrato de todo banco BR) -------
// OFX 1.x é SGML (tags sem fechamento obrigatório); OFX 2.x é XML puro. O
// parser abaixo lida com os dois: extrai cada bloco <STMTTRN>...</STMTTRN>
// e lê os campos com regex tolerante a quebra de linha e tag sem fechamento.
function extrairCampoOfx(bloco: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>\\s*([^\\r\\n<]*)`, "i");
  const m = bloco.match(re);
  return m ? m[1].trim() : null;
}

function parseDataOfx(bruto: string): string | null {
  // DTPOSTED costuma vir como "20260801120000[-03:GMT]" ou "20260801".
  const m = bruto.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOfx(conteudo: string): LancamentoExtratoImportado[] {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const lancamentos: LancamentoExtratoImportado[] = [];

  for (const bloco of blocos) {
    const dtPosted = extrairCampoOfx(bloco, "DTPOSTED");
    const trnAmt = extrairCampoOfx(bloco, "TRNAMT");
    const memo = extrairCampoOfx(bloco, "MEMO") ?? extrairCampoOfx(bloco, "NAME");
    const fitId = extrairCampoOfx(bloco, "FITID");

    if (!dtPosted || !trnAmt) continue;
    const data = parseDataOfx(dtPosted);
    const valorComSinal = Number(trnAmt.replace(",", "."));
    if (!data || !Number.isFinite(valorComSinal) || valorComSinal === 0) continue;

    lancamentos.push({
      data,
      descricao: memo?.trim() || "(sem descrição)",
      valor: Math.abs(valorComSinal),
      tipo: valorComSinal >= 0 ? "credito" : "debito",
      identificadorExterno: fitId,
    });
  }

  return lancamentos;
}

// --- CSV (fallback pra quem exporta em planilha) --------------------------
// Aceita ; ou , como separador e reconhece colunas por nome de cabeçalho
// (Data/Data Lançamento, Descrição/Histórico, Valor). Valor negativo (ou
// com sinal "-") vira débito; positivo vira crédito — mesma convenção do
// OFX. Não tenta adivinhar formato de data ambíguo: exige DD/MM/AAAA ou
// AAAA-MM-DD.
const CABECALHOS_DATA = ["data", "data lancamento", "data lançamento", "dt", "date"];
const CABECALHOS_DESCRICAO = ["descricao", "descrição", "historico", "histórico", "memo", "lancamento", "lançamento"];
const CABECALHOS_VALOR = ["valor", "valor (r$)", "amount", "vlr"];

const COMBINACOES_DIACRITICAS = new RegExp("[̀-ͯ]", "g");

function normalizarCabecalho(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(COMBINACOES_DIACRITICAS, "");
}

function parseDataCsv(bruto: string): string | null {
  const s = bruto.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function parseValorCsv(bruto: string): number | null {
  const limpo = bruto.trim().replace(/[R$\s]/g, "");
  // "1.234,56" (BR) vs "1234.56" (US) — se tem vírgula, ela é o separador
  // decimal e ponto é milhar.
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export function parseCsv(conteudo: string): LancamentoExtratoImportado[] {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const separador = linhas[0].includes(";") ? ";" : ",";
  const cabecalho = linhas[0].split(separador).map(normalizarCabecalho);

  const idxData = cabecalho.findIndex((c) => CABECALHOS_DATA.includes(c));
  const idxDescricao = cabecalho.findIndex((c) => CABECALHOS_DESCRICAO.includes(c));
  const idxValor = cabecalho.findIndex((c) => CABECALHOS_VALOR.includes(c));

  if (idxData === -1 || idxValor === -1) return [];

  const lancamentos: LancamentoExtratoImportado[] = [];
  for (const linha of linhas.slice(1)) {
    const colunas = linha.split(separador);
    const data = parseDataCsv(colunas[idxData] ?? "");
    const valorComSinal = parseValorCsv(colunas[idxValor] ?? "");
    if (!data || valorComSinal === null || valorComSinal === 0) continue;

    lancamentos.push({
      data,
      descricao: (idxDescricao >= 0 ? colunas[idxDescricao] : "")?.trim() || "(sem descrição)",
      valor: Math.abs(valorComSinal),
      tipo: valorComSinal >= 0 ? "credito" : "debito",
      identificadorExterno: null,
    });
  }

  return lancamentos;
}

export function parseExtrato(nomeArquivo: string, conteudo: string): LancamentoExtratoImportado[] {
  const ehOfx = /\.ofx$/i.test(nomeArquivo) || /<OFX>|<STMTTRN>/i.test(conteudo.slice(0, 2000));
  return ehOfx ? parseOfx(conteudo) : parseCsv(conteudo);
}

// --- Sugestão de vínculo ----------------------------------------------
// Sem RPC dedicada — a lista de contas em aberto já vem carregada pra tela
// (poucas dezenas/centenas de linhas), então o casamento é feito em memória:
// mesma faixa de valor (tolerância de 1 centavo) e vencimento dentro de uma
// janela de N dias da data do lançamento do extrato, ordenado pela menor
// diferença de dias (o "mais provável" primeiro).
export type ContaEmAberto = {
  id: string;
  nome: string; // credor_nome ou devedor_nome
  descricao: string | null;
  saldoEmAberto: number;
  vencimento: string; // YYYY-MM-DD
};

// Fase Conciliacao-IA (27/08/2026, pedido do Daniel: "treinar um matching
// automático (valor + data + fornecedor aproximado) com revisão humana só
// nas exceções") — achado real: o matching de hoje usava só valor+data, sem
// olhar pra descrição do extrato nem pro nome do credor/devedor (o
// "fornecedor aproximado" do pedido). Adiciona esse terceiro sinal (sem IA
// externa — comparação de tokens do nome normalizado contra a descrição do
// lançamento, mesma filosofia de heurística determinística já usada aqui em
// vez de chamada paga a LLM) e um nível de confiança por sugestão, que a UI
// usa tanto pra ordenar/destacar quanto pra decidir o que pode ser
// conciliado em lote sem revisão manual.
export type NivelConfianca = "alta" | "media" | "baixa";

export type SugestaoConciliacao = ContaEmAberto & {
  diferencaDias: number;
  similaridadeNome: number; // 0..1 — fração dos tokens do nome da conta encontrados na descrição do extrato
  confianca: NivelConfianca;
};

const JANELA_DIAS_SUGESTAO = 15;

function diferencaEmDias(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round(Math.abs(ta - tb) / (1000 * 60 * 60 * 24));
}

// Sufixos societários (LTDA, ME, S/A...) não ajudam a diferenciar um
// fornecedor de outro e raramente aparecem por extenso na descrição do
// extrato — remove antes de comparar.
const SUFIXOS_SOCIETARIOS = /\b(ltda|me|eireli|s\s?\/?\s?a|epp|mei)\b\.?/g;

function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINACOES_DIACRITICAS, "")
    .toLowerCase()
    .replace(SUFIXOS_SOCIETARIOS, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fração dos tokens "significativos" (3+ letras, pra não deixar "de"/"do"
// inflar o score) do nome da conta que aparecem na descrição do extrato.
// Ex.: descrição "TED FORNECEDOR POSTO BRASIL LTDA" x nome "Posto Brasil" →
// os 2 tokens de "posto brasil" aparecem inteiros na descrição → 1.0.
function similaridadeNomes(descricaoExtrato: string, nomeConta: string): number {
  const descricaoNorm = normalizarNome(descricaoExtrato);
  const nomeNorm = normalizarNome(nomeConta);
  if (!descricaoNorm || !nomeNorm) return 0;

  const tokensNome = nomeNorm.split(" ").filter((t) => t.length >= 3);
  if (tokensNome.length === 0) return 0;

  const tokensEncontrados = tokensNome.filter((t) => descricaoNorm.includes(t));
  return tokensEncontrados.length / tokensNome.length;
}

function calcularConfianca(diferencaDias: number, similaridadeNome: number): NivelConfianca {
  if (diferencaDias <= 3 && similaridadeNome >= 0.5) return "alta";
  if (diferencaDias <= 7 || similaridadeNome >= 0.3) return "media";
  return "baixa";
}

export function sugerirContas(
  lancamento: { data: string; valor: number; descricao?: string },
  contas: ContaEmAberto[],
  limite = 3
): SugestaoConciliacao[] {
  const ordemConfianca: Record<NivelConfianca, number> = { alta: 0, media: 1, baixa: 2 };

  return contas
    .filter((c) => Math.abs(c.saldoEmAberto - lancamento.valor) < 0.01)
    .map((c) => {
      const diferencaDias = diferencaEmDias(c.vencimento, lancamento.data);
      const similaridadeNome = lancamento.descricao ? similaridadeNomes(lancamento.descricao, c.nome) : 0;
      return { ...c, diferencaDias, similaridadeNome, confianca: calcularConfianca(diferencaDias, similaridadeNome) };
    })
    .filter((c) => c.diferencaDias <= JANELA_DIAS_SUGESTAO)
    .sort((a, b) => ordemConfianca[a.confianca] - ordemConfianca[b.confianca] || a.diferencaDias - b.diferencaDias)
    .slice(0, limite);
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataSemFuso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}
