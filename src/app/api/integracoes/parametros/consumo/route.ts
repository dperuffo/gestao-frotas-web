import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_CONSUMO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// Regra de consumo (km/l) por marca/modelo ou placa. O PDV FNI aplica essa regra
// sozinho; meios de pagamento externos (que autorizam por conta própria) consultam
// aqui. Consumo estimado = (hodômetro atual − hodômetro do último abastecimento) ÷ litros.
// Fora da faixa [consumo_minimo, consumo_maximo] ⇒ negar. Só avaliar quando houver os
// dois hodômetros e o abastecimento encher ao menos `percentual_tanque_minimo`% do tanque.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_CONSUMO_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();

  let query = supabase
    .from("parametros_consumo_veiculo")
    .select("marca_contem, placa, consumo_minimo, consumo_maximo, percentual_tanque_minimo, status, observacao", {
      count: "exact",
    })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (placa) query = query.eq("placa", placa);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? (data ?? []).length, limit, offset, dados: data ?? [] });
}
