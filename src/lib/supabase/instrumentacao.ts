import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "todo acesso a
// banco de dados deve ter query logging com tempo e informações do acesso")
// — em vez de tocar nos ~280 arquivos que chamam `.from()`/`.rpc()` (achado
// da auditoria: nenhum wrapper central existia), esta função embrulha o
// cliente Supabase UMA VEZ, nas duas fábricas server-side (server.ts e
// admin.ts) — toda query feita a partir delas passa a ser cronometrada e
// logada automaticamente, sem precisar mudar nenhum call-site.
//
// Como funciona: `.from(tabela)`/`.rpc(funcao)` do supabase-js devolvem um
// "builder" — um objeto que só dispara a query de verdade quando alguém dá
// `await` nele (ou chama `.then()`). A gente troca só o `.then` desse
// builder específico por uma versão que cronometra e loga antes de deixar o
// resultado seguir — o resto da cadeia (`.select()`, `.eq()`, `.order()`
// etc.) continua funcionando exatamente igual, porque não mexemos nelas.
//
// Não cobre acesso ao Supabase feito direto do navegador (client.ts,
// Client Component) — lá a chamada vai direto pro Supabase, sem passar
// pelo nosso servidor, então não tem como interceptar sem instrumentar o
// próprio navegador (fora do escopo desta fase; o Supabase já expõe
// estatística de query própria no painel deles).
type BuilderComThen = PromiseLike<unknown> & { then: PromiseLike<unknown>["then"] };

function instrumentarBuilder<T extends BuilderComThen>(builder: T, tipo: "from" | "rpc", alvo: string): T {
  const inicio = Date.now();
  const thenOriginal = builder.then.bind(builder);

  // Sobrescreve só NESTA instância (propriedade própria esconde o método
  // herdado do protótipo) — não afeta nenhuma outra query em andamento.
  (builder as unknown as { then: unknown }).then = ((onResolve?: unknown, onReject?: unknown) => {
    return thenOriginal(
      async (resultado: unknown) => {
        const duracaoMs = Date.now() - inicio;
        const r = resultado as { error?: { message: string } | null; status?: number; count?: number | null } | undefined;
        const nivel = r?.error ? "warn" : "debug";
        // `await` aqui (não fire-and-forget) — garante que a linha de log
        // já foi escrita antes da query "terminar" pra quem chamou, mesmo
        // em ambiente serverless que pode encerrar o processo logo depois.
        await logger[nivel]("db/query", `${tipo} ${alvo}`, {
          tipo,
          alvo,
          duracaoMs,
          status: r?.status ?? null,
          erro: r?.error?.message ?? null,
          linhas: r?.count ?? undefined,
        });
        return typeof onResolve === "function" ? (onResolve as (v: unknown) => unknown)(resultado) : resultado;
      },
      onReject as ((motivo: unknown) => unknown) | undefined
    );
  }) as T["then"];

  return builder;
}

// Embrulha um cliente Supabase já criado — devolve um Proxy que se comporta
// 100% igual ao cliente original, exceto que `.from()`/`.rpc()` passam pela
// instrumentação acima primeiro. Tipagem genérica preserva o tipo do
// cliente original (inclusive o `Database` tipado de cada fábrica).
export function comQueryLogging<C extends SupabaseClient<any, any, any>>(client: C): C {
  return new Proxy(client, {
    get(alvo, prop, receiver) {
      const original = Reflect.get(alvo, prop, receiver);
      if (typeof original !== "function") return original;

      if (prop === "from") {
        return (tabela: string) => instrumentarBuilder(original.call(alvo, tabela), "from", tabela);
      }
      if (prop === "rpc") {
        return (fn: string, args?: unknown, opts?: unknown) =>
          instrumentarBuilder(original.call(alvo, fn, args, opts), "rpc", fn);
      }
      return original.bind(alvo);
    },
  }) as C;
}
