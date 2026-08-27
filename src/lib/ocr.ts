import { createWorker } from "tesseract.js";

// Fase ocr-documentos (04/08/2026, item 8 do benchmark FNI vs KMM, Grupo 2)
// — "ler CT-e/canhoto automaticamente em vez de só foto". Decisão do
// Daniel: Tesseract OCR via tesseract.js (gratuito, sem API paga tipo
// Google Vision/AWS Textract) — roda em Node (esta função NUNCA deve ser
// chamada de um Edge Function/Route, ver `export const runtime = "nodejs"`
// nas rotas que a usam). Best-effort por natureza: OCR de foto de celular
// nunca é 100% confiável, então todo campo extraído aqui é só uma SUGESTÃO
// pra pré-preencher formulário — quem usa sempre pode revisar/corrigir
// antes de salvar. Não tentamos ler nome de recebedor do canhoto (letra
// manuscrita é o pior caso pra qualquer OCR, inclusive os pagos) — só o que
// é tipicamente IMPRESSO: chave de acesso da NF-e (44 dígitos), valor (R$)
// e o CPF/CNPJ do recebedor quando impresso no documento.
export type ResultadoOcrDocumento = {
  texto: string;
  chaveAcesso: string | null;
  numeroNf: string | null;
  valorNf: number | null;
  documentoRecebedor: string | null;
};

// A chave de acesso do DANFE normalmente aparece como 44 dígitos corridos,
// às vezes agrupados em blocos de 4 separados por espaço/ponto. Junta
// dígitos vizinhos (só separados por espaço) até achar um bloco de 44;
// desiste da sequência atual se aparecer um número solto grande demais
// (>6 dígitos) pra ser um bloco da chave, sinal de que é outro dado do
// documento (ex.: um CEP ou telefone concatenado por engano).
function extrairChaveAcesso(texto: string): string | null {
  const limpo = texto.replace(/[^\d\s.]/g, " ");
  const blocos = limpo.split(/\s+/).filter(Boolean);
  let acumulado = "";
  for (const bloco of blocos) {
    const digitos = bloco.replace(/\D/g, "");
    if (digitos.length === 0) continue;
    if (digitos.length > 6 && acumulado.length < 44) {
      acumulado = digitos.length >= 44 ? digitos.slice(0, 44) : "";
      if (acumulado.length === 44) return acumulado;
      continue;
    }
    acumulado += digitos;
    if (acumulado.length >= 44) return acumulado.slice(0, 44);
  }
  return null;
}

function extrairValor(texto: string): number | null {
  const match = texto.match(/R\$\s*([\d.,]+)/);
  if (!match) return null;
  const bruto = match[1].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numero = Number(bruto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function extrairNumeroNf(texto: string): string | null {
  const match = texto.match(/N[ºo°]\.?\s*(\d{1,9})/i);
  return match ? match[1] : null;
}

function extrairDocumento(texto: string): string | null {
  const match = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (!match) return null;
  const digitos = match[0].replace(/\D/g, "");
  return digitos.length === 11 ? digitos : null;
}

export async function extrairTextoDocumento(imagem: Buffer): Promise<ResultadoOcrDocumento> {
  const worker = await createWorker("por");
  try {
    const {
      data: { text },
    } = await worker.recognize(imagem);
    return {
      texto: text,
      chaveAcesso: extrairChaveAcesso(text),
      numeroNf: extrairNumeroNf(text),
      valorNf: extrairValor(text),
      documentoRecebedor: extrairDocumento(text),
    };
  } finally {
    await worker.terminate();
  }
}

// Fase OCR-Abastecimento-Externo (27/08/2026, pedido do Daniel: "estender a
// mesma capacidade pro cupom fiscal de abastecimento externo — o motorista
// tira foto, o sistema preenche litros/valor/posto sozinho"). Mesma
// filosofia best-effort do OCR de CT-e acima: cupom de posto tem formato
// MUITO menos padronizado que DANFE (cada rede imprime diferente, sem
// campo fixo), então cada extração aqui é sugestão pra pré-preencher o
// formulário — o motorista sempre revisa/corrige antes de enviar pra
// aprovação do gestor.
export type ResultadoOcrCupomAbastecimento = {
  texto: string;
  postoNome: string | null;
  combustivel: string | null;
  litros: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
};

// Ordem importa: variantes mais específicas ("Diesel S10") antes da genérica
// ("Diesel"), senão a genérica sempre casa primeiro.
const PALAVRAS_COMBUSTIVEL: Array<[string, RegExp]> = [
  ["Diesel S10", /diesel\s*s\W?\s*10/i],
  ["Diesel S500", /diesel\s*s\W?\s*500/i],
  ["Diesel", /\bdiesel\b/i],
  ["Gasolina Aditivada", /gasolina\s*aditivada/i],
  ["Gasolina Comum", /gasolina(\s*comum)?\b/i],
  ["Etanol", /\betanol\b|\bálcool\b|\balcool\b/i],
  ["GNV", /\bgnv\b/i],
  ["Arla32", /\barla\s*-?\s*32\b/i],
];

function extrairCombustivel(texto: string): string | null {
  for (const [nome, re] of PALAVRAS_COMBUSTIVEL) {
    if (re.test(texto)) return nome;
  }
  return null;
}

// Mesma lógica de "vírgula é decimal, ponto é milhar" já usada em
// extrairValor, isolada aqui porque também serve pra litros (não só R$).
function parseNumeroBr(bruto: string): number | null {
  const limpo = bruto.trim().replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function extrairLitros(texto: string): number | null {
  const padroes = [/(?:qtde|quantidade|litros?|volume)[^\d]{0,10}([\d.,]+)\s*l?\b/i, /([\d.,]+)\s*l(?:itros?)?\b/i];
  for (const re of padroes) {
    const m = texto.match(re);
    if (!m) continue;
    const n = parseNumeroBr(m[1]);
    // tanque de caminhão/veículo não passa de ~2000L — filtra falso-positivo
    // (ex.: OCR lendo um CNPJ ou valor em R$ como se fosse litragem).
    if (n && n > 0 && n < 2000) return n;
  }
  return null;
}

function extrairValorUnitario(texto: string): number | null {
  const m = texto.match(/(?:pre[çc]o\s*unit|p\.?\s*unit|r\$\s*\/\s*l|valor\s*unit)[^\d]{0,10}([\d.,]+)/i);
  if (!m) return null;
  const n = parseNumeroBr(m[1]);
  return n && n > 0 && n < 20 ? n : null; // preço/L de combustível não passa de ~R$20
}

function extrairValorTotal(texto: string): number | null {
  const linhaTotal = texto.match(/total[^\n\d]{0,15}r?\$?\s*([\d.,]+)/i);
  if (linhaTotal) {
    const n = parseNumeroBr(linhaTotal[1]);
    if (n && n > 0) return n;
  }
  return extrairValor(texto); // fallback: primeiro "R$ x,xx" que aparecer
}

// Nome do posto: melhor esforço = primeira linha "de aparência de nome de
// empresa" logo no topo do cupom (cabeçalho impresso), pulando linhas que
// são claramente endereço/CNPJ/telefone ou puro número.
function extrairPostoNome(texto: string): string | null {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const linha of linhas.slice(0, 6)) {
    if (linha.length < 4) continue;
    if (/^\d+$/.test(linha)) continue;
    if (/cnpj|cpf|rua\b|av\.|avenida|cep|fone|tel\.?:|endere[çc]o/i.test(linha)) continue;
    const letras = linha.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (letras.length < 4) continue;
    return linha;
  }
  return null;
}

export async function extrairDadosCupomAbastecimento(imagem: Buffer): Promise<ResultadoOcrCupomAbastecimento> {
  const worker = await createWorker("por");
  try {
    const {
      data: { text },
    } = await worker.recognize(imagem);
    return {
      texto: text,
      postoNome: extrairPostoNome(text),
      combustivel: extrairCombustivel(text),
      litros: extrairLitros(text),
      valorUnitario: extrairValorUnitario(text),
      valorTotal: extrairValorTotal(text),
    };
  } finally {
    await worker.terminate();
  }
}
