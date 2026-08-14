import "server-only";

// Fase Observabilidade-Fundacao (14/08/2026, pedido do Daniel: "todo log
// deve ser estruturado, em JSON e não em texto livre; todo erro deve ter
// stack trace completa e contexto; todo endpoint deve ter request ID único
// para rastreabilidade") — substitui aos poucos os `console.log`/
// `console.error` soltos (achado na auditoria: 35 arquivos usando texto
// livre) por um logger único que sempre grava JSON de uma linha só (fácil
// de buscar/filtrar em qualquer agregador de log, incluindo o painel de
// logs do Railway). Zero dependência nova de propósito — é só
// `console.log`/`console.error` por baixo, só que sempre com a mesma forma.
//
// Uso: logger.info("modulo/sub-parte", "mensagem", { contexto: "extra" })
//      logger.error("modulo/sub-parte", "mensagem", erro, { contexto: "extra" })
//
// "modulo" é livre, mas por convenção usa o mesmo prefixo que já aparecia
// entre colchetes nos `console.error` antigos (ex.: "[cron/atualizar-fipe]"
// virou módulo "cron/atualizar-fipe") — facilita achar e trocar os pontos
// antigos aos poucos, sem precisar decidir um nome novo toda vez.
import { headers } from "next/headers";
import { CABECALHO_REQUEST_ID } from "@/lib/request-id";

export { CABECALHO_REQUEST_ID };

type NivelLog = "debug" | "info" | "warn" | "error";

type Contexto = Record<string, unknown>;

type ErroSerializado = {
  nome: string;
  mensagem: string;
  stack: string | null;
};

// Lê o Request ID da requisição atual — só funciona em Server Components/
// Server Actions/Route Handlers (nunca em Client Component). Depende do
// middleware ter propagado o header (ver updateSession) — se por algum
// motivo não tiver passado por lá (ex.: chamada interna sem HTTP de verdade),
// devolve null em vez de quebrar.
export async function obterRequestIdAtual(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get(CABECALHO_REQUEST_ID);
  } catch {
    return null;
  }
}

function serializarErro(erro: unknown): ErroSerializado | undefined {
  if (erro === undefined) return undefined;
  if (erro instanceof Error) {
    return { nome: erro.name, mensagem: erro.message, stack: erro.stack ?? null };
  }
  // Erros do Supabase/PostgREST costumam vir como objeto plano (não
  // `instanceof Error`) com `.message`/`.code`/`.details` — não tem stack
  // de verdade, mas ainda assim entra no log inteiro, sem perder contexto.
  if (typeof erro === "object" && erro !== null) {
    return { nome: "ErroDesconhecido", mensagem: JSON.stringify(erro), stack: null };
  }
  return { nome: "ErroDesconhecido", mensagem: String(erro), stack: null };
}

// Serializador seguro pro `contexto` livre que cada chamada pode passar —
// contexto vindo de erro de banco/API externa pode ter referência circular
// ou BigInt, que quebrariam um `JSON.stringify` ingênuo e derrubariam o log
// (pior ainda: a própria tentativa de logar o erro geraria outro erro).
function jsonSeguro(valor: unknown): string {
  const vistos = new WeakSet<object>();
  try {
    return JSON.stringify(valor, (_chave, v) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (vistos.has(v)) return "[circular]";
        vistos.add(v);
      }
      return v;
    });
  } catch {
    return JSON.stringify({ falhaAoSerializar: true, valorBruto: String(valor) });
  }
}

async function registrar(nivel: NivelLog, modulo: string, mensagem: string, erro?: unknown, contexto?: Contexto) {
  const entrada = {
    timestamp: new Date().toISOString(),
    level: nivel,
    modulo,
    mensagem,
    requestId: await obterRequestIdAtual(),
    ...(erro !== undefined ? { erro: serializarErro(erro) } : {}),
    ...(contexto ? { contexto } : {}),
  };
  const linha = jsonSeguro(entrada);
  // stderr pra warn/error (a maioria dos agregadores, incluindo o Railway,
  // trata stderr como mais urgente/já vem sinalizado na UI), stdout pro
  // resto — mesma convenção de qualquer CLI/serviço bem comportado.
  if (nivel === "error" || nivel === "warn") {
    console.error(linha);
  } else {
    console.log(linha);
  }
}

export const logger = {
  debug: (modulo: string, mensagem: string, contexto?: Contexto) => void registrar("debug", modulo, mensagem, undefined, contexto),
  info: (modulo: string, mensagem: string, contexto?: Contexto) => void registrar("info", modulo, mensagem, undefined, contexto),
  warn: (modulo: string, mensagem: string, contexto?: Contexto) => void registrar("warn", modulo, mensagem, undefined, contexto),
  // Único nível que aceita `erro` — pedido explícito do Daniel ("todo erro
  // deve ter stack trace completa e contexto"): aqui sempre serializa o
  // erro (stack incluído quando existir) antes de gravar.
  error: (modulo: string, mensagem: string, erro?: unknown, contexto?: Contexto) => void registrar("error", modulo, mensagem, erro, contexto),
};
