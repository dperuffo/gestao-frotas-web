import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_CENTROS_CUSTO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// API de leitura de centros de custo (Fase 25 — Hub de Integrações).
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_CENTROS_CUSTO_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { limit, offset } = lerPaginacao(new URL(request.url));

  const { data, error, count } = await supabase
    .from("centros_custo")
    .select("id, nome, codigo, responsavel, ativo", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .order("nome")
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ erro: `Erro ao consultar centros de custo: ${error.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: count ?? 0, limit, offset, dados: data ?? [] });
}
