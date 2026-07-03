// Leitura de planilhas .xlsx (SheetJS) para as importações em lote recorrentes
// (postos ANP, rede de postos do cliente, preços). Cada linha vira um array
// de células "cruas" (string | number | Date | null) — cada importador sabe
// quais colunas esperar e usa os conversores abaixo para tipar cada célula.
import * as XLSX from "xlsx";

export function nomesDasAbas(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames;
}

// Lê uma aba como matriz de linhas (a primeira linha não é tratada como
// cabeçalho automaticamente — cada chamador decide onde o cabeçalho começa).
export function lerAba(buffer: ArrayBuffer, nomeAba?: string): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const aba = nomeAba ? wb.Sheets[nomeAba] : wb.Sheets[wb.SheetNames[0]];
  if (!aba) return [];
  return XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: null }) as unknown[][];
}

// Constrói um índice "nome da coluna normalizado -> posição" a partir de uma
// linha de cabeçalho, para não depender da ordem das colunas na planilha.
export function indiceColunas(cabecalho: unknown[]): Map<string, number> {
  const indice = new Map<string, number>();
  cabecalho.forEach((valor, i) => {
    const chave = normalizarCabecalho(valor);
    if (chave) indice.set(chave, i);
  });
  return indice;
}

export function normalizarCabecalho(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (marcas diacríticas combinantes)
    .replace(/[?\u00ba]/g, "") // remove "?" e o "º" de graus
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function textoOuNull(v: unknown): string | null {
  const t = texto(v);
  return t && t !== "-" ? t : null;
}

export function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v).trim();
  if (!t || t === "-") return null;
  // aceita tanto "1234.56" quanto "1.234,56" / "1234,56"
  const semMilhar = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(semMilhar);
  return Number.isFinite(n) ? n : null;
}

export function inteiro(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.trunc(n);
}

export function data(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  if (!t || t === "-") return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); // aceita "dd/mm/aaaa" com hora opcional depois
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = t.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  return null;
}

export function simNao(v: unknown): boolean {
  const t = texto(v).toLowerCase();
  return t === "sim" || t === "s" || t === "yes" || t === "true" || t === "1";
}

// Converte uma célula pra string, igual texto() acima, mas preservando a
// hora quando a célula é uma data/hora do Excel (não só a data) — usado nos
// importadores manuais (usuários/motoristas/veículos/abastecimentos), onde
// um campo como "data_abastecimento" precisa do horário. texto() (acima)
// descarta a hora de propósito, porque é usado nos importadores de preço/
// posto_gf, cujas colunas de data nunca têm horário relevante.
function celulaParaTextoImportacao(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const iso = v.toISOString();
    const temHora = v.getUTCHours() !== 0 || v.getUTCMinutes() !== 0 || v.getUTCSeconds() !== 0;
    return temHora ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
  }
  return String(v).trim();
}

// Lê uma planilha .xlsx inteira como matriz de strings (linha 0 = cabeçalho)
// — mesmo formato de saída que o antigo parseCSV() devolvia, pra poder
// substituir um pelo outro nos importadores manuais sem reescrever a lógica
// de parsing linha a linha que já existia (que sempre operou sobre string[]).
export function lerPlanilhaComoTexto(buffer: ArrayBuffer, nomeAba?: string): string[][] {
  const linhas = lerAba(buffer, nomeAba);
  return linhas
    .map((linha) => linha.map((celula) => celulaParaTextoImportacao(celula)))
    .filter((linha) => linha.some((valor) => valor.trim().length > 0));
}

// Gera um .xlsx (ArrayBuffer) a partir de um cabeçalho + linhas de exemplo — usado
// pelos endpoints "modelo" (template de planilha pra download). XLSX em vez
// de CSV porque abre direto no Excel com acentos/formatação corretos, sem o
// usuário precisar escolher separador/codificação (fonte de erro comum com
// CSV pra quem não é técnico).
export function gerarXlsxModelo(cabecalho: string[], linhasExemplo: (string | number)[][], nomeAba = "Modelo"): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhasExemplo]);
  ws["!cols"] = cabecalho.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  // Nesta versão do pacote "xlsx" (SheetJS), type: "array" devolve um
  // ArrayBuffer de verdade (apesar do nome da opção sugerir um array tipado)
  // — é exatamente o que o construtor de Response espera como corpo, sem
  // nenhuma cópia/conversão adicional. Já testamos: tentar "copiar" esse
  // buffer via new Uint8Array(x).set(bytes) com bytes sendo um ArrayBuffer
  // (em vez de um Uint8Array de fato) silenciosamente zera o conteúdo —
  // fica registrado aqui pra ninguém reintroduzir esse bug.
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

// Insere/atualiza em lotes para não estourar timeout em planilhas com
// dezenas de milhares de linhas.
export async function emLotes<T>(itens: T[], tamanho: number, fn: (lote: T[]) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await fn(itens.slice(i, i + tamanho));
  }
}

// O Postgres recusa um upsert (INSERT ... ON CONFLICT DO UPDATE) quando o
// MESMO comando tenta inserir duas linhas com a mesma chave de conflito
// ("ON CONFLICT DO UPDATE command cannot affect row a second time") — o que
// acontece sempre que a planilha de origem tem linhas repetidas (o mesmo
// CNPJ, ou o mesmo posto+combustível+data, aparecendo mais de uma vez).
// Aqui removemos as repetições ANTES de gravar, mantendo a ÚLTIMA
// ocorrência de cada chave (a mais recente na planilha "vence").
export function dedupePorChave<T>(itens: T[], chave: (item: T) => string): T[] {
  const porChave = new Map<string, T>();
  for (const item of itens) porChave.set(chave(item), item);
  return Array.from(porChave.values());
}
