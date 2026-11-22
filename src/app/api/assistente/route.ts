import { NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { perguntarAssistente, type MensagemChat } from "@/lib/assistenteIA";
import type { Database } from "@/types/database.types";
import { resolverCorsHeaders } from "@/lib/corsOrigens";
import { verificarLimite } from "@/lib/rateLimit";
import { prepararAssistente, registrarConsumoAssistente, mensagemErroChaveCliente, type OrigemChave } from "@/lib/assistenteConsumo";

// Fase FLT-2 — pedido do Daniel: expor o Assistente FNI também pro PWA
// Flutter (visão posto). Diferença crucial em relação a TODAS as outras
// telas do Flutter: aquelas falam direto com o Supabase (RLS cuida da
// segurança); esta PRECISA passar por um backend, porque
// `perguntarAssistente` usa a API da Anthropic com uma chave secreta
// (ANTHROPIC_API_KEY) que nunca pode ir pro bundle JS do app — é secreta e
// cobra por uso. Esta rota é o único endpoint HTTP novo criado só pro
// Flutter nesta fase: recebe o access_token da sessão Supabase do usuário
// (Authorization: Bearer <token> — supabase_flutter já guarda esse token
// depois do login) em vez de cookies (a web usa cookies via @supabase/ssr;
// o app não compartilha domínio/cookies com o site), monta um client
// Supabase autenticado "como" aquele usuário (RLS aplica normalmente,
// exatamente como no client do navegador) e chama a MESMA função
// perguntarAssistente já usada pela web — zero lógica de IA duplicada.
export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: resolverCorsHeaders(request) });
}

export async function POST(request: Request) {
  const CORS_HEADERS = resolverCorsHeaders(request);
  const autorizacao = request.headers.get("authorization");
  const token = autorizacao?.startsWith("Bearer ") ? autorizacao.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json(
      { erro: "Cabeçalho Authorization: Bearer <token> é obrigatório." },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const supabase = criarClienteSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error: erroAuth,
  } = await supabase.auth.getUser(token);
  if (erroAuth || !user) {
    return NextResponse.json(
      { erro: "Sessão inválida ou expirada, faça login novamente." },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // M2 — protege custo (API paga da Anthropic por pergunta): limite por
  // USUÁRIO autenticado, não por IP (um token válido não deve conseguir
  // gerar custo ilimitado mesmo vindo do mesmo IP de sempre).
  const limite = verificarLimite(`assistente:${user.id}`, 20, 10 * 60 * 1000);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "Muitas perguntas em pouco tempo — tente novamente em instantes." },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(limite.tentarNovamenteEmSegundos) } }
    );
  }

  let corpo: { pergunta?: string; historico?: MensagemChat[] };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400, headers: CORS_HEADERS });
  }

  const pergunta = (corpo.pergunta ?? "").trim();
  if (!pergunta) {
    return NextResponse.json({ erro: "Digite uma pergunta." }, { status: 400, headers: CORS_HEADERS });
  }
  if (pergunta.length > 2000) {
    return NextResponse.json(
      { erro: "Pergunta muito longa (máximo 2000 caracteres)." },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const historico = Array.isArray(corpo.historico) ? corpo.historico.slice(-12) : [];

  // Consumo de IA atribuído à empresa do usuário (PWA não tem seletor: usa a primeira empresa do usuário;
  // admin FNI sem empresa = uso interno). Mesma franquia/chave própria da versão web.
  const medidor = { entrada: 0, saida: 0 };
  let empresaConsumo: string | null = null;
  let origem: OrigemChave = "interno";
  try {
    const { data: ids } = await supabase.rpc("empresas_do_usuario", { p_email: user.email ?? "" });
    const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
    empresaConsumo = (ids ?? [])[0] ?? null;
    if (!empresaConsumo && perfil !== "admin") {
      return NextResponse.json({ erro: "Não encontramos uma empresa vinculada ao seu usuário." }, { status: 403, headers: CORS_HEADERS });
    }
    const preparo = await prepararAssistente(supabase, empresaConsumo);
    if (!preparo.ok) return NextResponse.json({ erro: preparo.mensagem }, { status: 402, headers: CORS_HEADERS });
    origem = preparo.origem;

    const { resposta, consultas, blocos } = await perguntarAssistente(pergunta, historico, supabase, {
      empresaId: empresaConsumo,
      chaveApi: preparo.chaveApi,
      medidor,
    });
    return NextResponse.json({ resposta, consultas, blocos }, { headers: CORS_HEADERS });
  } catch (e) {
    const amigavel = origem === "cliente" ? mensagemErroChaveCliente(e) : null;
    const mensagem = amigavel ?? (e instanceof Error ? e.message : "Erro inesperado ao consultar o assistente.");
    return NextResponse.json({ erro: mensagem }, { status: 500, headers: CORS_HEADERS });
  } finally {
    await registrarConsumoAssistente(supabase, empresaConsumo, medidor, origem);
  }
}
