import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_PARAMETROS_COTAS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

export const runtime = "nodejs";

// Fase 27.121 — mesma lógica de "início do período atual" usada na tela
// (ver inicioDoPeriodo em page.tsx); duplicada aqui de propósito — é uma
// função pequena e manter a API sem depender de um Server Component evita
// acoplamento entre camadas que não precisam se conhecer.
function inicioDoPeriodo(periodicidade: string, hoje: Date): string {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const dia = hoje.getUTCDate();
  if (periodicidade === "Semana") {
    const diaSemana = hoje.getUTCDay();
    const offset = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(hoje);
    inicio.setUTCDate(dia - offset);
    return inicio.toISOString().slice(0, 10);
  }
  if (periodicidade === "Quinzena") {
    return new Date(Date.UTC(ano, mes, dia <= 15 ? 1 : 16)).toISOString().slice(0, 10);
  }
  if (periodicidade === "Abastecimento") {
    return hoje.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_PARAMETROS_COTAS_READ);
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  const { chave, supabase } = auth;

  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);
  const placa = url.searchParams.get("placa")?.trim().toUpperCase();

  let query = supabase
    .from("parametros_cota_veiculo")
    .select("placa, tipo, limite, periodicidade, status, observacao", { count: "exact" })
    .eq("empresa_id", chave.empresaId)
    .eq("status", "Ativo");
  if (placa) query = query.eq("placa", placa);

  const { data: cotas, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ erro: `Erro ao consultar cotas: ${error.message}` }, { status: 500 });

  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const fimExclusivo = amanha.toISOString().slice(0, 10);

  const dados = await Promise.all(
    (cotas ?? []).map(async (c) => {
      const inicio = inicioDoPeriodo(c.periodicidade, hoje);
      const { data: abastecimentos } = await supabase
        .from("abastecimentos_unificado")
        .select("valor_total, litros")
        .eq("empresa_id", chave.empresaId)
        .eq("placa", c.placa)
        .gte("data_abastecimento", inicio)
        .lt("data_abastecimento", fimExclusivo);
      const consumido = (abastecimentos ?? []).reduce(
        (soma, a) => soma + (c.tipo === "Valor" ? (a.valor_total ?? 0) : (a.litros ?? 0)),
        0
      );
      return {
        placa: c.placa,
        tipo: c.tipo,
        limite: c.limite,
        consumido,
        disponivel: Math.max(0, c.limite - consumido),
        periodicidade: c.periodicidade,
        observacao: c.observacao,
      };
    })
  );

  await marcarUsoChaveApi(supabase, chave.id);
  return NextResponse.json({ total: count ?? dados.length, limit, offset, dados });
}
