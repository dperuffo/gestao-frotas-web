import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_VINCULO_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// Fase 27.120 — API de leitura do primeiro tipo de "Parâmetros de Uso"
// (Hub de Integrações, Fase 25): Vínculo Motorista ↔ Veículo. Uma solução
// de automação de posto ou meio de pagamento consulta aqui, antes de
// liberar um abastecimento, se aquele par placa+motorista está autorizado
// (status "Ativo" e dentro do período data_inicio/data_fim).
//
// Filtros opcionais por querystring: ?placa=ABC1234 e/ou ?cpf=12345678900 —
// pensados pro caso de uso mais comum (checar UM par específico) sem
// precisar paginar a lista inteira do cliente.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_VINCULO_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();
  const cpf = url.searchParams.get("cpf")?.trim();

  let query = supabase
    .from("parametros_vinculo_motorista_veiculo")
    .select("placa, data_inicio, data_fim, status, observacao, motoristas!inner(nome_completo, cpf)", {
      count: "exact",
    })
    .eq("empresa_id", chave.empresaId)
    .order("placa");

  if (placa) query = query.eq("placa", placa);
  if (cpf) query = query.eq("motoristas.cpf", cpf);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ erro: `Erro ao consultar vínculos: ${error.message}` }, { status: 500 });
  }

  type LinhaVinculo = {
    placa: string;
    data_inicio: string;
    data_fim: string | null;
    status: string;
    observacao: string | null;
    motoristas: { nome_completo: string; cpf: string } | { nome_completo: string; cpf: string }[] | null;
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const dados = ((data ?? []) as unknown as LinhaVinculo[]).map((v) => {
    const motorista = Array.isArray(v.motoristas) ? v.motoristas[0] : v.motoristas;
    const dentroDoPeriodo = v.data_inicio <= hoje && (!v.data_fim || v.data_fim >= hoje);
    return {
      placa: v.placa,
      motorista_nome: motorista?.nome_completo ?? null,
      motorista_cpf: motorista?.cpf ?? null,
      data_inicio: v.data_inicio,
      data_fim: v.data_fim,
      status: v.status,
      observacao: v.observacao,
      autorizado: v.status === "Ativo" && dentroDoPeriodo,
    };
  });

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
