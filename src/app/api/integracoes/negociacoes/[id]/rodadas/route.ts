import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_NEGOCIACOES_WRITE } from "@/lib/apiKeys";
import { adicionarContraproposta } from "@/lib/negociacoesPostos";
import { PRODUTOS_POSTO } from "@/lib/constants";

// Fase 27.50 — o posto envia uma CONTRAPROPOSTA a uma negociação que está
// aguardando resposta dele (status "pendente_posto"), abrindo uma nova
// rodada. Só funciona se a chave pertencer ao posto dono da negociação
// (checado abaixo via empresa_posto_id) e se realmente for a vez do posto
// responder (checado dentro de adicionarContraproposta).
export const runtime = "nodejs";

type CorpoRequisicao = {
  combustivel?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  volume_minimo_mensal?: number;
  preco_unitario?: number;
};

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

  if (!corpo.combustivel || !(PRODUTOS_POSTO as readonly string[]).includes(corpo.combustivel)) {
    return NextResponse.json(
      { erro: `"combustivel" inválido. Use um de: ${PRODUTOS_POSTO.join(", ")}.` },
      { status: 400 }
    );
  }

  const resultado = await adicionarContraproposta(supabase, {
    negociacaoId: id,
    autor: "posto",
    dados: {
      combustivel: corpo.combustivel,
      vigencia_inicio: String(corpo.vigencia_inicio ?? ""),
      vigencia_fim: String(corpo.vigencia_fim ?? ""),
      volume_minimo_mensal: Number(corpo.volume_minimo_mensal),
      preco_unitario: Number(corpo.preco_unitario),
    },
    decididoPor: "api",
  });

  if ("erro" in resultado) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ status: "contraproposta_enviada" }, { status: 201 });
}
