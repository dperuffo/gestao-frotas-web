import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_MOTORISTAS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// API de leitura de motoristas (Fase 25 — Hub de Integrações). Diferente de
// cadastro_veiculos, motoristas já tem empresa_id direto — filtro simples.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_MOTORISTAS_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { limit, offset } = lerPaginacao(new URL(request.url));

  const { data, error, count } = await supabase
    .from("motoristas")
    .select("nome_completo, cpf, telefone, classificacao, status, cnh, cnh_vencimento, centro_custo_id", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .order("nome_completo")
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ erro: `Erro ao consultar motoristas: ${error.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: count ?? 0, limit, offset, dados: data ?? [] });
}
