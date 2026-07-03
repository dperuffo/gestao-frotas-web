import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_POSTOS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// API de leitura da rede de postos negociada do cliente (Fase 25 — Hub de
// Integrações). Só a "Rede do Cliente" (postos_gf.empresa_id = dono da
// chave) — nunca o universo ANP inteiro, que não pertence a nenhum cliente
// específico.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_POSTOS_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { limit, offset } = lerPaginacao(new URL(request.url));

  const { data, error, count } = await supabase
    .from("postos_gf")
    .select("cnpj, razao_social, bandeira, distribuidora, municipio, uf, lat, lon, funciona_24h, pista_caminhao, arla, conveniencia", {
      count: "exact",
    })
    .eq("empresa_id", chave.empresaId)
    .order("razao_social")
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ erro: `Erro ao consultar postos: ${error.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: count ?? 0, limit, offset, dados: data ?? [] });
}
