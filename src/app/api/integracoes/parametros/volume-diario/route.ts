import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_VOLUME_DIARIO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_VOLUME_DIARIO_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();

  let query = supabase
    .from("parametros_volume_diario_veiculo")
    .select("placa, volume_maximo, status, observacao", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (placa) query = query.eq("placa", placa);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? (data ?? []).length, limit, offset, dados: data ?? [] });
}
