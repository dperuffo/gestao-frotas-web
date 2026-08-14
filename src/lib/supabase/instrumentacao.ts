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
// Como funciona: `.rpc(funcao)` do supabase-js já devolve direto um
// "builder" thenable — um objeto que só dispara a query de verdade quando
// alguém dá `await` nele (ou chama `.then()`). Já `.from(tabela)` devolve
// primeiro um builder INTERMEDIÁRIO (ainda sem `.then`) — só vira thenable
// depois de encadear `.select()`/`.insert()`/`.upsert()`/`.update()`/
// `.delete()`. Bug real corrigido aqui (achado em produção pelo próprio
// health check, 14/08/2026): a primeira versão tentava pegar `.then` direto
// no retorno de `.from()`, que ainda não existe nesse ponto — quebrava TODA
// query da aplicação com "Cannot read properties of undefined (reading
// 'bind')". A correção intercepta os métodos terminais do builder
// intermediário e só instrumenta o `.then` depois que ele existir de
// verdade. O resto da cadeia (`.eq()`, `.order()` etc., chamados DEPOIS do
// método terminal) continua funcionando igual, porque não mexemos nelas —
// no postgrest-js elas mutam e devolvem o mesmo objeto já instrumentado.
//
// Não cobre acesso ao Supabase feito direto do navegador (client.ts,
// Client Component) — lá a chamada vai direto pro Supabase, sem passar
// pelo nosso servidor, então não tem como interceptar sem instrumentar o
// próprio navegador (fora do escopo desta fase; o Supabase já expõe
// estatística de query própria no painel deles).
type BuilderComThen = PromiseLike<unknown> & { then: PromiseLike<unknown>["then"] };

// Métodos do PostgrestQueryBuilder (retorno de `.from()`) que "fecham" a
// consulta e só a partir daí devolvem algo thenable — os únicos pontos
// onde faz sentido instrumentar quando a chamada começou por `.from()`.
const METODOS_TERMINAIS_FROM = ["select", "insert", "upsert", "update", "delete"] as const;

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

// Embrulha o builder INTERMEDIÁRIO devolvido por `.from(tabela)` — ainda
// não é thenable, só os métodos terminais (select/insert/upsert/update/
// delete) é que devolvem algo pronto pra instrumentar.
function instrumentarQueryBuilder(queryBuilder: unknown, tabela: string): unknown {
  return new Proxy(queryBuilder as object, {
    get(alvo, prop, receiver) {
      const original = Reflect.get(alvo, prop, receiver);
      if (typeof original !== "function") return original;

      if ((METODOS_TERMINAIS_FROM as readonly string[]).includes(prop as string)) {
        return (...args: unknown[]) => instrumentarBuilder(original.apply(alvo, args), "from", tabela);
      }
      return original.bind(alvo);
    },
  });
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
        return (tabela: string) => instrumentarQueryBuilder(original.call(alvo, tabela), tabela);
      }
      if (prop === "rpc") {
        return (fn: string, args?: unknown, opts?: unknown) =>
          instrumentarBuilder(original.call(alvo, fn, args, opts), "rpc", fn);
      }
      return original.bind(alvo);
    },
  }) as C;
}
