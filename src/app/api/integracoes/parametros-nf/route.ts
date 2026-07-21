import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_NF_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

// Fase 27.140 — pedido do Daniel: API pra ERPs e sistemas de automação de
// posto consultarem as preferências de emissão de nota fiscal do cliente
// (por CNPJ da frota, ou a regra padrão sem CNPJ). Mesmo padrão de
// autenticação/paginação de /api/integracoes/parametros/produto.
export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_NF_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const cnpjFrota = url.searchParams.get("cnpj_frota")?.trim();

  let query = supabase
    .from("parametros_nota_fiscal")
    .select(
      "cnpj_frota, exige_nota_fiscal, separar_nf_combustivel, forma_emissao, local_destino, cnpj_destino_personalizado, dados_adicionais, status",
      { count: "exact" }
    )
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (cnpjFrota) query = query.eq("cnpj_frota", cnpjFrota);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? (data ?? []).length, limit, offset, dados: data ?? [] });
}
