import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_INTERVALO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// Fase 27.121 — leitura do intervalo mínimo entre abastecimentos (por
// veículo ou motorista). Filtros opcionais ?placa= e ?motorista_cpf=.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_INTERVALO_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();
  const cpf = url.searchParams.get("motorista_cpf")?.trim();

  let query = supabase
    .from("parametros_intervalo_abastecimento")
    .select("tipo, placa, intervalo_minimo, unidade, status, observacao, motoristas(nome_completo, cpf)", {
      count: "exact",
    })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");

  if (placa) query = query.eq("placa", placa);
  if (cpf) query = query.eq("motoristas.cpf", cpf);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar regras: ${error.message}` }, { status: 500 });

  type Linha = {
    tipo: string;
    placa: string | null;
    intervalo_minimo: number;
    unidade: string;
    status: string;
    observacao: string | null;
    motoristas: { nome_completo: string; cpf: string } | { nome_completo: string; cpf: string }[] | null;
  };
  const dados = ((data ?? []) as unknown as Linha[]).map((l) => {
    const motorista = Array.isArray(l.motoristas) ? l.motoristas[0] : l.motoristas;
    return {
      tipo: l.tipo,
      placa: l.placa,
      motorista_nome: motorista?.nome_completo ?? null,
      motorista_cpf: motorista?.cpf ?? null,
      intervalo_minimo: l.intervalo_minimo,
      unidade: l.unidade,
      observacao: l.observacao,
    };
  });

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
