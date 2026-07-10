import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_VALOR_DIARIO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_VALOR_DIARIO_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const cpf = url.searchParams.get("motorista_cpf")?.trim();

  let query = supabase
    .from("parametros_valor_diario_motorista")
    .select("valor_maximo, status, observacao, motoristas(nome_completo, cpf)", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (cpf) query = query.eq("motoristas.cpf", cpf);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  type Linha = {
    valor_maximo: number;
    observacao: string | null;
    motoristas: { nome_completo: string; cpf: string } | { nome_completo: string; cpf: string }[] | null;
  };
  const dados = ((data ?? []) as unknown as Linha[]).map((l) => {
    const motorista = Array.isArray(l.motoristas) ? l.motoristas[0] : l.motoristas;
    return {
      motorista_nome: motorista?.nome_completo ?? null,
      motorista_cpf: motorista?.cpf ?? null,
      valor_maximo: l.valor_maximo,
      observacao: l.observacao,
    };
  });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
