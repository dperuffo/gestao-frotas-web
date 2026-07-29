// Fase TCO 2 (29/07/2026) — cliente da API FIPE (Parallelum/FipeOnline v2),
// pública e gratuita (500 req/dia sem chave). Contrato confirmado em
// fipe.online/docs em 29/07/2026:
//
//   GET /{vehicleType}/brands                                    → [{code, name}]
//   GET /{vehicleType}/brands/{brandCode}/models                 → [{code, name}]
//   GET /{vehicleType}/brands/{brandCode}/models/{modelCode}/years        → [{code, name}]  (code = yearId, ex "2020-5")
//   GET /{vehicleType}/brands/{brandCode}/models/{modelCode}/years/{yearCode} → preço atual
//   GET /{vehicleType}/{fipeCode}/years                           → [{code, name}] (busca direto por código FIPE, sem cascata)
//   GET /{vehicleType}/{fipeCode}/years/{yearCode}                → preço atual (direto por código)
//   GET /{vehicleType}/{fipeCode}/years/{yearCode}/history         → priceHistory (grátis: últimos 3 meses)
//
// vehicleType: "cars" | "motorcycles" | "trucks".
// yearCode ("code" no retorno de /years") é modelYear-fuelCode, ex "2020-5"
// (5 = Flex); 32000 = zero-km.
//
// Mesmo padrão de timeout/cache de anpFetch.ts: sem timeout, um fetch preso
// no ar já causou 502 silencioso em produção (Railway) — nunca repetir isso.
const BASE_URL = "https://fipe.parallelum.com.br/api/v2";
const TIMEOUT_FIPE_MS = 15_000;

export type TipoVeiculoFipe = "cars" | "motorcycles" | "trucks";

export const TIPOS_VEICULO_FIPE: { value: TipoVeiculoFipe; label: string }[] = [
  { value: "cars", label: "Carro" },
  { value: "trucks", label: "Caminhão" },
  { value: "motorcycles", label: "Moto" },
];

export type FipeMarca = { code: string; name: string };
export type FipeModelo = { code: string; name: string };
export type FipeAno = { code: string; name: string };
export type FipePreco = {
  vehicleType: number;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  fuelAcronym: string;
  codeFipe: string;
  price: string; // "R$ 119.329,00"
  referenceMonth: string; // "julho de 2026"
};
// "reference" é o mesmo código sequencial de /references (ex "335" =
// julho/2026, cresce 1 por mês) — permite ordenar/comparar meses
// cronologicamente sem parsear o texto em português de "month".
export type FipeHistoricoItem = { price: string; month: string; reference: string };
export type FipeHistorico = { priceHistory: FipeHistoricoItem[] };

function headersFipe(): HeadersInit {
  const token = process.env.FIPE_API_TOKEN;
  return token ? { "X-Subscription-Token": token } : {};
}

async function buscarFipe<T>(caminho: string): Promise<T> {
  const url = `${BASE_URL}${caminho}`;
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_FIPE_MS),
      headers: headersFipe(),
    });
  } catch (e) {
    throw new Error(`Falha ao consultar FIPE (${url}): ${e instanceof Error ? e.message : "erro de rede"}`);
  }
  if (!resposta.ok) {
    let corpo = "";
    try {
      corpo = await resposta.text();
    } catch {
      // ignora
    }
    throw new Error(`FIPE retornou HTTP ${resposta.status} (${url})${corpo ? `: ${corpo}` : ""}`);
  }
  return (await resposta.json()) as T;
}

export function listarMarcasFipe(tipo: TipoVeiculoFipe): Promise<FipeMarca[]> {
  return buscarFipe(`/${tipo}/brands`);
}

export function listarModelosFipe(tipo: TipoVeiculoFipe, marcaCode: string): Promise<FipeModelo[]> {
  return buscarFipe(`/${tipo}/brands/${encodeURIComponent(marcaCode)}/models`);
}

export function listarAnosFipe(tipo: TipoVeiculoFipe, marcaCode: string, modeloCode: string): Promise<FipeAno[]> {
  return buscarFipe(`/${tipo}/brands/${encodeURIComponent(marcaCode)}/models/${encodeURIComponent(modeloCode)}/years`);
}

export function buscarPrecoFipe(
  tipo: TipoVeiculoFipe,
  marcaCode: string,
  modeloCode: string,
  anoCode: string
): Promise<FipePreco> {
  return buscarFipe(
    `/${tipo}/brands/${encodeURIComponent(marcaCode)}/models/${encodeURIComponent(modeloCode)}/years/${encodeURIComponent(anoCode)}`
  );
}

// Busca direta por código FIPE (sem cascata) — usada no refresh periódico
// (cron) e sempre que já temos codigo_fipe/fipe_ano_codigo salvos no veículo.
export function buscarPrecoFipePorCodigo(tipo: TipoVeiculoFipe, codigoFipe: string, anoCode: string): Promise<FipePreco> {
  return buscarFipe(`/${tipo}/${encodeURIComponent(codigoFipe)}/years/${encodeURIComponent(anoCode)}`);
}

// Histórico de preços (free tier = últimos 3 meses) — usado pra backfill
// imediato ao vincular um veículo pela primeira vez, sem esperar 3 meses de
// cron pra ter alguma curva.
export function buscarHistoricoFipe(tipo: TipoVeiculoFipe, codigoFipe: string, anoCode: string): Promise<FipeHistorico> {
  return buscarFipe(`/${tipo}/${encodeURIComponent(codigoFipe)}/years/${encodeURIComponent(anoCode)}/history`);
}

// "R$ 119.329,00" → 119329.00
export function parsePrecoFipe(precoTexto: string): number {
  const limpo = precoTexto
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
