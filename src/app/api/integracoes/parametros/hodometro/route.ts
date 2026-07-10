import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_HODOMETRO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// Fase 27.121 — 1 endpoint só cobre as 2 abas "Hodôm. Leve"/"Hodôm.
// Pesado" da tela (mesma tabela no banco); filtrar por ?classificacao=Leve
// ou ?classificacao=Pesado, ou omitir pra trazer as duas.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_HODOMETRO_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();
  const classificacao = url.searchParams.get("classificacao");

  let query = supabase
    .from("parametros_variacao_hodometro")
    .select("classificacao, placa, variacao_maxima_km, status, observacao", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (placa) query = query.eq("placa", placa);
  if (classificacao === "Leve" || classificacao === "Pesado") query = query.eq("classificacao", classificacao);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? (data ?? []).length, limit, offset, dados: data ?? [] });
}
