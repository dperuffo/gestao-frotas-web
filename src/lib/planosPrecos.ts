// Busca os preços reais dos planos pagos direto do Stripe (via a Edge
// Function planos-precos) em vez de manter um valor hardcoded no Next.js
// que pode ficar desatualizado se o preço mudar no Stripe. verify_jwt:false
// na function, então não precisa de sessão — só o apikey do projeto.
export type PrecoPlano = { unit_amount: number | null; currency: string; interval: string | null };

export async function buscarPrecosPlanos(): Promise<Record<string, PrecoPlano> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const res = await fetch(`${url}/functions/v1/planos-precos`, {
      headers: { apikey: anonKey },
      // Preço não muda a cada request — 5 min de cache (mesmo TTL do
      // Cache-Control devolvido pela própria Edge Function).
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, PrecoPlano>;
  } catch {
    return null;
  }
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
