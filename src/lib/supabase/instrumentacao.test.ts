import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { comQueryLogging } from "@/lib/supabase/instrumentacao";

// Fase Observabilidade-Fase2 (14/08/2026) — teste criado DEPOIS de um bug
// real ter quebrado TODA query da aplicação em produção (achado pelo
// próprio health check, reportado pelo Daniel via alerta no Teams: "Cannot
// read properties of undefined (reading 'bind')"). A causa: `.from(tabela)`
// do supabase-js devolve um builder INTERMEDIÁRIO, que só vira "thenable"
// (tem `.then()`) depois de encadear `.select()`/`.insert()`/etc — a
// primeira versão deste wrapper tentava instrumentar o `.then` direto no
// retorno de `.from()`, que ainda não existia.
//
// Este fake reproduz a MESMA forma em 2 estágios do postgrest-js (real
// biblioteca usada pelo Supabase) — sem precisar de banco de dados de
// verdade — pra travar essa classe de regressão pra sempre: se algum dia
// alguém "simplificar" o wrapper de volta pro jeito que quebrou em
// produção, este teste falha antes de chegar no Railway.
class FiltroFake implements PromiseLike<{ data: unknown; error: null; status: number; count: number }> {
  constructor(private linhas: unknown[]) {}
  eq(): this {
    return this; // postgrest-js real: filtros mutam e devolvem o mesmo objeto (this)
  }
  then<TResult1 = { data: unknown; error: null; status: number; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; status: number; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.linhas, error: null, status: 200, count: this.linhas.length }).then(onfulfilled, onrejected);
  }
}

class QueryBuilderFake {
  constructor(private linhas: unknown[]) {}
  select(): FiltroFake {
    return new FiltroFake(this.linhas); // só AQUI nasce algo thenable — igual ao real
  }
  insert(): FiltroFake {
    return new FiltroFake([]);
  }
}

class ClienteFake {
  from(_tabela: string): QueryBuilderFake {
    return new QueryBuilderFake([{ id: 1 }, { id: 2 }]);
  }
  rpc(_fn: string, _args?: unknown): FiltroFake {
    return new FiltroFake([{ ok: true }]); // rpc() já nasce thenable, direto
  }
}

function clienteInstrumentado() {
  return comQueryLogging(new ClienteFake() as unknown as SupabaseClient<any, any, any>);
}

describe("comQueryLogging", () => {
  it("from().select() resolve normalmente (regressão do bug real de produção)", async () => {
    const cliente = clienteInstrumentado();
    const { data, error, status } = await (cliente as unknown as ClienteFake).from("empresas").select();
    expect(error).toBeNull();
    expect(status).toBe(200);
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("from().select().eq() (filtro encadeado depois do select) continua resolvendo", async () => {
    const cliente = clienteInstrumentado();
    const { data } = await (cliente as unknown as ClienteFake).from("empresas").select().eq();
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("from().insert() também resolve (outro método terminal, não só select)", async () => {
    const cliente = clienteInstrumentado();
    const { data } = await (cliente as unknown as ClienteFake).from("empresas").insert();
    expect(data).toEqual([]);
  });

  it("rpc() resolve normalmente (já nasce thenable, sem estágio intermediário)", async () => {
    const cliente = clienteInstrumentado();
    const { data } = await (cliente as unknown as ClienteFake).rpc("alguma_funcao");
    expect(data).toEqual([{ ok: true }]);
  });
});
