import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_CUSTOS_FIXOS } from "@/lib/apiKeys";
import { TIPOS_CUSTO_FIXO, type TipoCustoFixo } from "@/lib/financeiro";

// API pública pro sistema externo do cliente (corretora de seguro, ERP,
// rastreador, operadora de pedágio etc.) lançar custos fixos direto no
// Painel Financeiro da FNI — sem isso, esses custos só entrariam via
// digitação manual em /financeiro. Autenticação por API key própria (não é
// a sessão do usuário) via `Authorization: Bearer <chave>` — ver README
// (Fase 22, atualizado na Fase 25 com o tipo "pedagio" e o helper
// compartilhado de autenticação em src/lib/apiAuth.ts).
//
// Roda em runtime Node (o helper de auth usa o módulo `crypto` pra fazer o
// hash da chave recebida e comparar com o que está salvo em
// api_keys.hash_chave — nunca comparamos a chave em texto puro).
export const runtime = "nodejs";

type CorpoRequisicao = {
  tipo?: string;
  valor?: number;
  competencia?: string;
  descricao?: string;
  placa?: string;
  recorrente?: boolean;
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_CUSTOS_FIXOS);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  let corpo: CorpoRequisicao;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  const tipo = corpo.tipo as TipoCustoFixo;
  if (!TIPOS_CUSTO_FIXO.includes(tipo)) {
    return NextResponse.json(
      { erro: `"tipo" inválido. Use um de: ${TIPOS_CUSTO_FIXO.join(", ")}.` },
      { status: 400 }
    );
  }

  const valor = Number(corpo.valor);
  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ erro: '"valor" precisa ser um número maior ou igual a zero.' }, { status: 400 });
  }

  const competencia = corpo.competencia ? new Date(corpo.competencia) : null;
  if (!competencia || Number.isNaN(competencia.getTime())) {
    return NextResponse.json(
      { erro: '"competencia" precisa ser uma data válida (ex: "2026-07-01").' },
      { status: 400 }
    );
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("custos_fixos")
    .insert({
      empresa_id: chave.empresaId,
      tipo,
      valor,
      competencia: competencia.toISOString().slice(0, 10),
      descricao: corpo.descricao?.trim() || null,
      placa: corpo.placa?.trim().toUpperCase() || null,
      recorrente: Boolean(corpo.recorrente),
      origem: "api",
    })
    .select("id")
    .single();

  if (erroInsert) {
    return NextResponse.json({ erro: `Não foi possível salvar: ${erroInsert.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ id: registro.id, status: "criado" }, { status: 201 });
}
