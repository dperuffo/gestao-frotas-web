// Fase 27.92 — pedido do Daniel: documento de cobrança estilo boleto, mas
// SEM integração bancária real (decisão via AskUserQuestion: "PDF no estilo
// boleto, só informativo... com QR Code PIX real"). Gera o payload "Pix
// Copia e Cola" (BR Code), no padrão EMV do Banco Central
// (Manual de Padrões para Iniciação do Pix) — um QR Code estático, válido em
// qualquer banco, SEM precisar de credencial/API de nenhum banco ou gateway:
// só a chave PIX de quem recebe (o posto, cedente da fatura).
//
// Estrutura: uma sequência de campos ID(2 dígitos) + Tamanho(2 dígitos) +
// Valor, terminando com o CRC16 do payload inteiro (campo 63).

function campo(id: string, valor: string): string {
  const tamanho = valor.length.toString().padStart(2, "0");
  return `${id}${tamanho}${valor}`;
}

// Remove acentos/caracteres fora do padrão exigido pelo BR Code (merchant
// name e city devem ser ASCII simples) e corta no tamanho máximo.
function normalizarTexto(valor: string, tamanhoMaximo: number): string {
  const semAcento = valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim();
  return (semAcento || "FNI").slice(0, tamanhoMaximo).toUpperCase();
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) — algoritmo exigido
// pelo padrão EMV/BR Code pro campo 63.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPayloadPix(params: {
  chave: string;
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  valor: number;
  txid: string;
}): string {
  const merchantAccountInfo =
    campo("00", "br.gov.bcb.pix") + campo("01", params.chave.trim());

  const additionalData = campo("05", normalizarTexto(params.txid, 25) || "***");

  const semCrc =
    campo("00", "01") + // Payload Format Indicator
    campo("01", "11") + // Point of Initiation Method (estático, reutilizável)
    campo("26", merchantAccountInfo) + // Merchant Account Info — PIX
    campo("52", "0000") + // Merchant Category Code
    campo("53", "986") + // Moeda: Real (ISO 4217)
    campo("54", params.valor.toFixed(2)) + // Valor da transação
    campo("58", "BR") + // País
    campo("59", normalizarTexto(params.nomeBeneficiario, 25)) + // Nome do beneficiário
    campo("60", normalizarTexto(params.cidadeBeneficiario, 15)) + // Cidade do beneficiário
    campo("62", additionalData) + // Additional Data Field (txid)
    "6304"; // Abre o campo do CRC (id 63, tamanho 04) — valor calculado a seguir

  return semCrc + crc16(semCrc);
}

// Gera o QR Code (PNG em data URL) do payload PIX — roda no servidor (Server
// Component, ao montar a página da fatura) porque o pacote `qrcode` também
// funciona em Node, evitando estado assíncrono extra no botão de PDF
// (client component). O componente <Image> do @react-pdf/renderer aceita
// data URL direto.
export async function gerarQrCodePixDataUrl(payload: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
}
