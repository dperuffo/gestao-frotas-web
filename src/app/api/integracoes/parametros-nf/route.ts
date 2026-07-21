import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_NF_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

// Fase 27.140 — pedido do Daniel: API pra ERPs e sistemas de automação de
// posto consultarem as preferências de emissão de nota fiscal do cliente
// (por CNPJ da frota, ou a regra padrão sem CNPJ). Mesmo padrão de
// autenticação/paginação de /api/integracoes/parametros/produto.
//
// Fase 27.141 — quando local_destino é "Personalizado CNPJ por Estado", a
// regra pode ter exceções por UF (parametros_nota_fiscal_destino_uf) —
// vêm aninhadas em cada item de `dados` como `destino_por_uf`. Se o
// chamador passar `?uf=`, cada item também ganha `cnpj_destino_resolvido`
// já calculado (exceção daquela UF, senão o CNPJ padrão da regra), pra
// o ERP não precisar reimplementar essa resolução.
export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_NF_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const cnpjFrota = url.searchParams.get("cnpj_frota")?.trim();
  const uf = url.searchParams.get("uf")?.trim().toUpperCase();

  let query = supabase
    .from("parametros_nota_fiscal")
    .select(
      "cnpj_frota, exige_nota_fiscal, separar_nf_combustivel, forma_emissao, local_destino, cnpj_destino_personalizado, dados_adicionais, status, destino_por_uf:parametros_nota_fiscal_destino_uf(uf, cnpj_destino)",
      { count: "exact" }
    )
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (cnpjFrota) query = query.eq("cnpj_frota", cnpjFrota);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  const dados = (data ?? []).map((linha) => {
    if (!uf) return linha;
    const excecao = linha.destino_por_uf?.find((e) => e.uf === uf);
    return { ...linha, cnpj_destino_resolvido: excecao?.cnpj_destino ?? linha.cnpj_destino_personalizado ?? null };
  });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
