import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { normalizarCNPJ } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// Integração PróFrotas — porta para TypeScript da lógica que já existia no
// aplicativo Streamlit (aba "⚡ API & Integrações → 🔌 GestãoFrotas"). Mesma
// API externa, mesmo mapeamento de campos, gravando na mesma tabela
// `profrotas_abastecimentos` que este app já lê em todas as telas.
//
// Diferença deliberada em relação ao Streamlit: lá o upsert mirava a coluna
// `sync_key` (Estratégia 1), mas essa coluna nunca teve constraint UNIQUE em
// produção — o Streamlit sempre caía na Estratégia 2 (upsert por
// cnpj_frota+identificador+item_id, que é a UNIQUE real da tabela:
// `profrotas_abast_uq`). Aqui já usamos direto a estratégia que de fato
// funciona, sem as duas tentativas extras.
// ═══════════════════════════════════════════════════════════════════════

const PROFROTAS_API_BASE = "https://api-portal.profrotas.com.br/api";
const PROFROTAS_PESQUISA_URL = `${PROFROTAS_API_BASE}/frotista/abastecimento/pesquisa`;
const TAMANHO_PAGINA_PADRAO = 100;
const TAMANHO_LOTE_UPSERT = 200;

type ProfrotasItem = {
  identificador?: string | number | null;
  nome?: string | null;
  tipo?: number | { codigo?: number | null; valor?: string | null } | null;
  quantidade?: number | string | null;
  valorUnitario?: number | string | null;
  valorTotal?: number | string | null;
};

type ProfrotasRegistro = {
  identificador?: string | number | null;
  data?: string | null;
  dataTransacao?: string | null;
  dataAtualizacao?: string | null;
  abastecimentoEstornado?: boolean | null;
  statusAutorizacao?: number | string | null;
  motivoRecusa?: string | null;
  motivoCancelamento?: string | null;
  hodometro?: number | string | null;
  horimetro?: number | string | null;
  frota?: { cnpj?: string | null; razaoSocial?: string | null } | null;
  motorista?: { identificador?: string | number | null; nome?: string | null } | null;
  veiculo?: { identificador?: string | number | null; placa?: string | null } | null;
  pontoVenda?: {
    cnpj?: string | null;
    razaoSocial?: string | null;
    postoInterno?: boolean | null;
    endereco?: {
      municipio?: string | null;
      uf?: string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
    } | null;
  } | null;
  items?: ProfrotasItem[] | null;
};

type ProfrotasResposta = {
  registros?: ProfrotasRegistro[];
  items?: ProfrotasRegistro[];
  data?: ProfrotasRegistro[];
  content?: ProfrotasRegistro[];
  totalItems?: number;
  total?: number;
  totalRegistros?: number;
  count?: number;
  tamanhoPagina?: number;
};

export type ResultadoValidacao = { ok: boolean; mensagem: string };

export type ResultadoSync = {
  paginas: number;
  salvos: number;
  totalApi: number;
  novoToken: string | null;
  erro: string;
};

type LinhaAbastecimento = Database["public"]["Tables"]["profrotas_abastecimentos"]["Insert"];

function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function paraInteiro(v: unknown): number | null {
  const n = paraNumero(v);
  return n === null ? null : Math.trunc(n);
}

function paraBit(v: unknown): number {
  return v ? 1 : 0;
}

function paraTextoOuNull(v: unknown): string | null {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() === "" ? null : s;
}

function calcularSyncKey(cnpjFrota: string, identificador: string, itemId: string): string {
  return createHash("md5").update(`${cnpjFrota}|${identificador || "sem_id"}|${itemId}`).digest("hex");
}

// POST autenticado na API PróFrotas com retry automático em 429/erro de rede
// (espera progressiva 5s/15s/30s) — mesmo comportamento do `_profrotas_request`
// original. Retorna também o header `Renovacao-Automatica-JWT`, quando a API
// decide renovar o token durante a chamada.
async function profrotasRequest(
  token: string,
  payload: Record<string, unknown>,
  tentativas = 3
): Promise<{ dados: ProfrotasResposta; novoToken: string | null }> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const resposta = await fetch(PROFROTAS_PESQUISA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resposta.ok) {
        if (resposta.status === 429 && tentativa < tentativas) {
          const esperaMs = [5000, 15000, 30000][tentativa - 1];
          await new Promise((r) => setTimeout(r, esperaMs));
          continue;
        }
        throw new Error(`HTTP ${resposta.status}: ${resposta.statusText}`);
      }

      const novoToken = resposta.headers.get("Renovacao-Automatica-JWT");
      const dados = (await resposta.json()) as ProfrotasResposta;
      return { dados, novoToken };
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro ?? "Falha desconhecida"));
}

// Valida um token fazendo uma requisição mínima (dia de hoje, página 1).
export async function validarTokenProfrotas(token: string): Promise<ResultadoValidacao> {
  const hoje = new Date().toISOString().slice(0, 19) + "Z";
  try {
    const { dados } = await profrotasRequest(token, { pagina: 1, dataInicial: hoje, dataFinal: hoje });
    if (dados && typeof dados.totalItems === "number") {
      return { ok: true, mensagem: "Token válido — frota autenticada com sucesso." };
    }
    return { ok: false, mensagem: "Resposta inesperada da API PróFrotas." };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : String(erro) };
  }
}

// Converte um registro (+ seus itens/produtos) da API PróFrotas nas linhas
// que vão para `profrotas_abastecimentos` — uma linha por item (produto)
// abastecido; se não houver itens, uma única linha com item_id vazio.
function registroParaLinhas(cnpjFrota: string, registro: ProfrotasRegistro): LinhaAbastecimento[] {
  const identificador = paraInteiro(registro.identificador);
  if (identificador === null) return [];

  const frota = registro.frota ?? {};
  const motorista = registro.motorista ?? {};
  const veiculo = registro.veiculo ?? {};
  const pontoVenda = registro.pontoVenda ?? {};
  const endereco = pontoVenda.endereco ?? {};

  const base = {
    cnpj_frota: cnpjFrota,
    identificador,
    abastecimento_estornado: paraBit(registro.abastecimentoEstornado),
    data_abastecimento: paraTextoOuNull(registro.data ?? registro.dataTransacao),
    data_atualizacao: paraTextoOuNull(registro.dataAtualizacao),
    data_transacao: paraTextoOuNull(registro.dataTransacao),
    status_autorizacao: paraInteiro(registro.statusAutorizacao),
    motivo_recusa: paraTextoOuNull(registro.motivoRecusa),
    motivo_cancelamento: paraTextoOuNull(registro.motivoCancelamento),
    hodometro: paraInteiro(registro.hodometro),
    horimetro: paraInteiro(registro.horimetro),
    frota_cnpj: normalizarCNPJ(frota.cnpj).padStart(14, "0") || null,
    frota_razao_social: paraTextoOuNull(frota.razaoSocial),
    motorista_id: paraInteiro(motorista.identificador),
    motorista_nome: paraTextoOuNull(motorista.nome),
    veiculo_id: paraInteiro(veiculo.identificador),
    veiculo_placa: paraTextoOuNull(veiculo.placa),
    pv_cnpj: normalizarCNPJ(pontoVenda.cnpj).padStart(14, "0") || null,
    pv_razao_social: paraTextoOuNull(pontoVenda.razaoSocial),
    pv_posto_interno: Boolean(pontoVenda.postoInterno),
    pv_municipio: paraTextoOuNull(endereco.municipio),
    pv_uf: paraTextoOuNull(endereco.uf),
    pv_latitude: paraNumero(endereco.latitude),
    pv_longitude: paraNumero(endereco.longitude),
    payload_raw: registro as unknown as Database["public"]["Tables"]["profrotas_abastecimentos"]["Row"]["payload_raw"],
  };

  const itens = registro.items ?? [];
  if (itens.length === 0) {
    return [
      {
        ...base,
        item_id: "",
        sync_key: calcularSyncKey(cnpjFrota, String(identificador), ""),
      },
    ];
  }

  return itens.map((item) => {
    const itemId = String(item.identificador ?? "");
    const tipoRaw = item.tipo;
    const tipoInt =
      tipoRaw && typeof tipoRaw === "object" ? paraInteiro(tipoRaw.codigo) : paraInteiro(tipoRaw);
    const nomeExtra = tipoRaw && typeof tipoRaw === "object" ? tipoRaw.valor : null;

    return {
      ...base,
      item_id: itemId,
      item_nome: paraTextoOuNull(item.nome) ?? paraTextoOuNull(nomeExtra),
      item_tipo: tipoInt,
      item_quantidade: paraNumero(item.quantidade),
      item_valor_unitario: paraNumero(item.valorUnitario),
      item_valor_total: paraNumero(item.valorTotal),
      sync_key: calcularSyncKey(cnpjFrota, String(identificador), itemId),
    };
  });
}

// Busca todos os abastecimentos desde `dataInicio` e grava em
// `profrotas_abastecimentos` (upsert por cnpj_frota+identificador+item_id —
// registros repetidos entre execuções são apenas sobrescritos, não
// duplicados). Ao final, atualiza `ultimo_sync`/`registros_sync` (e o token,
// se a API o renovou) em `profrotas_api_keys`.
//
// `supabase` deve ser um client com permissão de escrita em
// `profrotas_abastecimentos` para o cnpj_frota em questão — o client da
// sessão do usuário (RLS cuida do isolamento por cliente) para sync manual,
// ou o client de service role para o cron (sem sessão de usuário).
export async function sincronizarProfrotas(
  supabase: SupabaseClient<Database>,
  params: { cnpjFrota: string; token: string; dataInicio: string }
): Promise<ResultadoSync> {
  const cnpjFrota = normalizarCNPJ(params.cnpjFrota);
  let token = params.token;
  let pagina = 1;
  let totalSalvos = 0;
  let totalItems: number | null = null;
  let totalRegistrosApi = 0;
  let novoTokenFinal: string | null = null;
  const errosLote: string[] = [];
  const hoje = new Date().toISOString().slice(0, 19) + "Z";

  for (;;) {
    let dados: ProfrotasResposta;
    let novoToken: string | null;
    try {
      const resultado = await profrotasRequest(token, {
        pagina,
        dataInicial: params.dataInicio,
        dataFinal: hoje,
      });
      dados = resultado.dados;
      novoToken = resultado.novoToken;
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      const sufixo = totalSalvos > 0 ? ` (${totalSalvos} registros anteriores já salvos)` : "";
      return {
        paginas: pagina - 1,
        salvos: totalSalvos,
        totalApi: totalItems ?? 0,
        novoToken: novoTokenFinal,
        erro: `Erro API pág ${pagina}: ${msg}${sufixo}`,
      };
    }

    if (novoToken) {
      token = novoToken;
      novoTokenFinal = novoToken;
    }

    const registros = dados.registros ?? dados.items ?? dados.data ?? dados.content ?? [];
    if (totalItems === null) {
      totalItems = dados.totalItems ?? dados.total ?? dados.totalRegistros ?? dados.count ?? 0;
    }
    const tamanhoPagina = dados.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;
    totalRegistrosApi += registros.length;

    const linhas = registros.flatMap((r) => registroParaLinhas(cnpjFrota, r));

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE_UPSERT) {
      const lote = linhas.slice(i, i + TAMANHO_LOTE_UPSERT);
      const { error } = await supabase
        .from("profrotas_abastecimentos")
        .upsert(lote, { onConflict: "cnpj_frota,identificador,item_id" });
      if (error) {
        errosLote.push(`Pág ${pagina} lote ${Math.floor(i / TAMANHO_LOTE_UPSERT) + 1}: ${error.message.slice(0, 160)}`);
      } else {
        totalSalvos += lote.length;
      }
    }

    if (registros.length === 0) break; // página vazia = fim real
    const totalPaginas = totalItems && tamanhoPagina ? Math.ceil(totalItems / tamanhoPagina) : null;
    if (totalPaginas && pagina >= totalPaginas) break;
    if (totalItems && totalRegistrosApi >= totalItems) break;
    if (!totalItems && registros.length < tamanhoPagina) break; // fallback sem totalItems

    pagina += 1;
    await new Promise((r) => setTimeout(r, 300));
  }

  await supabase
    .from("profrotas_api_keys")
    .update({
      ultimo_sync: new Date().toISOString(),
      registros_sync: totalSalvos,
      ...(novoTokenFinal ? { token: novoTokenFinal } : {}),
    })
    .eq("cnpj_frota", cnpjFrota);

  return {
    paginas: pagina,
    salvos: totalSalvos,
    totalApi: totalItems ?? 0,
    novoToken: novoTokenFinal,
    erro: errosLote.join("; "),
  };
}
