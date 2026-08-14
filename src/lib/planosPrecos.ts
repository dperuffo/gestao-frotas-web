import { obterOuDefinir } from "@/lib/cache";

// Busca os preços reais dos planos pagos direto do Stripe (via a Edge
// Function planos-precos) em vez de manter um valor hardcoded no Next.js
// que pode ficar desatualizado se o preço mudar no Stripe. verify_jwt:false
// na function, então não precisa de sessão — só o apikey do projeto.
export type PrecoPlano = { unit_amount: number | null; currency: string; interval: string | null };

// Fase Observabilidade-Fase3 (14/08/2026, pedido do Daniel: "ampliar cache
// pra outros pontos quentes") — antes usava só o cache de fetch embutido do
// Next.js (`next: { revalidate: 300 }`); funcionava, mas era invisível pra
// nós — não tinha como saber, olhando o log, se estava servindo do cache ou
// batendo na Edge Function toda vez. Trocado pelo nosso `cache.ts` (mesmo
// TTL de 5 min) só pra ganhar essa visibilidade (hit/miss no log), sem
// mudar o comportamento pro usuário.
export async function buscarPrecosPlanos(): Promise<Record<string, PrecoPlano> | null> {
  return obterOuDefinir("planos-precos", 300_000, async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;

    try {
      const res = await fetch(`${url}/functions/v1/planos-precos`, {
        headers: { apikey: anonKey },
      });
      if (!res.ok) return null;
      return (await res.json()) as Record<string, PrecoPlano>;
    } catch {
      return null;
    }
  });
}

export function formatarPrecoPlano(preco: PrecoPlano | null | undefined): string {
  if (!preco || preco.unit_amount == null) return "Preço sob consulta";
  const valor = (preco.unit_amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: preco.currency.toUpperCase(),
  });
  if (!preco.interval) return valor;
  const porIntervalo = preco.interval === "month" ? "mês" : preco.interval === "year" ? "ano" : preco.interval;
  return `${valor}/${porIntervalo}`;
}
