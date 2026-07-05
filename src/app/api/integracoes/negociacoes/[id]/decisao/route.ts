import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_NEGOCIACOES_WRITE } from "@/lib/apiKeys";
import { decidirNegociacao } from "@/lib/negociacoesPostos";

// Fase 27.50 — o posto aceita ou recusa a proposta/contraproposta que está
// aguardando resposta dele (status "pendente_posto"). Decisão final: não
// abre nova rodada (para contrapropor, ver .../rodadas).
export const runtime = "nodejs";

type CorpoRequisicao = { decisao?: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autenticarRequisicaoApi(request, ESCOPO_NEGOCIACOES_WRITE);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { data: negociacao } = await supabase
    .from("negociacoes_postos")
    .select("id, empresa_posto_id")
    .eq("id", id)
    .maybeSingle();

  if (!negociacao || negociacao.empresa_posto_id !== chave.empresaId) {
    return NextResponse.json({ erro: "Negociação não encontrada para este posto." }, { status: 404 });
  }

  let corpo: CorpoRequisicao;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  if (corpo.decisao !== "aceita" && corpo.decisao !== "recusada") {
    return NextResponse.json({ erro: '"decisao" precisa ser "aceita" ou "recusada".' }, { status: 400 });
  }

  const resultado = await decidirNegociacao(supabase, {
    negociacaoId: id,
    autor: "posto",
    decisao: corpo.decisao,
    decididoPor: "api",
  });

  if ("erro" in resultado) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ status: corpo.decisao === "aceita" ? "negociacao_aceita" : "negociacao_recusada" });
}
