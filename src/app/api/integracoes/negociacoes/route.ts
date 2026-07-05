import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_NEGOCIACOES_WRITE, ESCOPO_NEGOCIACOES_READ } from "@/lib/apiKeys";
import { normalizarCNPJ } from "@/lib/utils";
import { criarNegociacao } from "@/lib/negociacoesPostos";
import { lerPaginacao } from "@/lib/apiPaginacao";
import { PRODUTOS_POSTO } from "@/lib/constants";

// API pública pro sistema/ERP do posto revendedor enviar uma proposta de
// negociação a um cliente de frota (Fase 27.50) — mesmo padrão do Hub de
// Integrações (Fase 25): autenticação por chave própria (Authorization:
// Bearer <chave>), gerada pelo POSTO na própria tela de Integrações dele
// (a chave pertence à empresa do posto, segmento "Revenda"). Diferente das
// demais rotas do Hub, aqui quem chama é o POSTO, não o cliente — por isso
// o corpo pede o CNPJ do CLIENTE (empresa_id da chave é o posto).
//
// Depois de criada, a negociação aparece na tela /negociacoes do cliente
// (aguardando aceite/contraproposta) e também na tela /negociacoes do
// próprio posto (se ele também acessar a plataforma pela UI, além da API).
export const runtime = "nodejs";

type CorpoRequisicao = {
  cliente_cnpj?: string;
  combustivel?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  volume_minimo_mensal?: number;
  preco_unitario?: number;
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_NEGOCIACOES_WRITE);
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

  const clienteCnpjNormalizado = normalizarCNPJ(corpo.cliente_cnpj);
  if (!clienteCnpjNormalizado) {
    return NextResponse.json({ erro: '"cliente_cnpj" é obrigatório.' }, { status: 400 });
  }

  if (!corpo.combustivel || !(PRODUTOS_POSTO as readonly string[]).includes(corpo.combustivel)) {
    return NextResponse.json(
      { erro: `"combustivel" inválido. Use um de: ${PRODUTOS_POSTO.join(", ")}.` },
      { status: 400 }
    );
  }

  const { data: empresaClienteId } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: clienteCnpjNormalizado });
  if (!empresaClienteId) {
    return NextResponse.json(
      { erro: "Nenhum cliente encontrado com esse CNPJ. Confira se o cliente já é uma empresa cadastrada na FNI." },
      { status: 422 }
    );
  }

  const { data: postoInfo } = await supabase.from("empresas").select("cnpj").eq("id", chave.empresaId).maybeSingle();

  const resultado = await criarNegociacao(supabase, {
    empresaClienteId,
    empresaPostoId: chave.empresaId,
    postoCnpj: postoInfo?.cnpj ?? "",
    origem: "api",
    autor: "posto",
    dados: {
      combustivel: corpo.combustivel,
      vigencia_inicio: String(corpo.vigencia_inicio ?? ""),
      vigencia_fim: String(corpo.vigencia_fim ?? ""),
      volume_minimo_mensal: Number(corpo.volume_minimo_mensal),
      preco_unitario: Number(corpo.preco_unitario),
    },
    criadoPor: "api",
  });

  if ("erro" in resultado) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ id: resultado.id, status: "criado" }, { status: 201 });
}

// Lista as negociações do próprio posto (dono da chave), paginado — pra um
// sistema externo consultar o andamento sem precisar logar na plataforma.
export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_NEGOCIACOES_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;
  const url = new URL(request.url);
  const { limit, offset } = lerPaginacao(url);

  const {
    data,
    error,
    count,
  } = await supabase
    .from("negociacoes_postos")
    .select("id, empresa_cliente_id, posto_cnpj, status, rodada_atual, criado_em, atualizado_em, cliente_nome", {
      count: "exact",
    })
    .eq("empresa_posto_id", chave.empresaId)
    .order("atualizado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ erro: `Não foi possível consultar: ${error.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: count ?? 0, limit, offset, dados: data ?? [] });
}
