import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_SERVICOS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_SERVICOS_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();

  let query = supabase
    .from("parametros_limite_servicos")
    .select("placa, postos_cnpj, limites, status, observacao, motoristas(nome_completo, cpf)", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (placa) query = query.eq("placa", placa);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  type Linha = {
    placa: string | null;
    postos_cnpj: string[];
    limites: unknown;
    observacao: string | null;
    motoristas: { nome_completo: string; cpf: string } | { nome_completo: string; cpf: string }[] | null;
  };
  const dados = ((data ?? []) as unknown as Linha[]).map((l) => {
    const motorista = Array.isArray(l.motoristas) ? l.motoristas[0] : l.motoristas;
    return {
      placa: l.placa,
      motorista_nome: motorista?.nome_completo ?? null,
      motorista_cpf: motorista?.cpf ?? null,
      postos_cnpj: l.postos_cnpj,
      limites: l.limites,
      observacao: l.observacao,
    };
  });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
