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
