import { NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERFIS } from "@/lib/constants";
import type { Database } from "@/types/database.types";
import { resolverCorsHeaders } from "@/lib/corsOrigens";

// Fase FLT-2 — pedido do Daniel: expor "convidar novo usuário" (aba
// Usuários) pro PWA Flutter. Mesma razão de existir de /api/assistente:
// convidar usuário usa `admin.auth.admin.inviteUserByEmail` (Supabase Auth
// Admin API), que exige a SERVICE ROLE KEY — chave secreta que nunca pode
// ir pro bundle do app. Reaproveita a MESMA lógica de 3 passos de
// criarUsuario() (usuarios/actions.ts): convite no Auth -> upsert
// usuarios_app -> upsert usuarios_empresas (role = perfil).
//
// Achado real (endurecimento, não bug corrigido na web): a Server Action
// original NÃO confere se o `empresa_id` enviado pertence a quem está
// chamando — como ela só é exposta hoje pra quem já é admin (o formulário
// web fica dentro do dashboard autenticado por sessão/cookie, e só admin
// tem esse item de menu fora do posto), isso nunca foi explorável na
// prática. Como esta rota abre um NOVO caminho de entrada (Bearer token,
// chamável por qualquer posto autenticado), adicionei uma checagem que a
// web não tinha: confere, com o client RLS-scoped do próprio chamador, que
// ele pertence à empresa pra qual está convidando (mesmo padrão de
// resolverEmpresaAtual) — só depois disso troca pro client admin.
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

  const supabaseDoUsuario = criarClienteSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error: erroAuth,
  } = await supabaseDoUsuario.auth.getUser(token);
  if (erroAuth || !user) {
    return NextResponse.json(
      { erro: "Sessão inválida ou expirada, faça login novamente." },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // Bugfix de segurança (09/08/2026, achado C3 da varredura de segurança) —
  // esta rota checava só "o chamador pertence à empresa X" (ver comentário
  // do topo do arquivo), mas nunca "o chamador TEM PERMISSÃO de gerenciar
  // usuários" — qualquer perfil autenticado (inclusive gestor_frota ou
  // posto) conseguia convidar alguém com perfil "admin" pra QUALQUER empresa
  // à qual pertencesse, escalando privilégio pra administrador GLOBAL da
  // plataforma assim que esse e-mail fizesse login (perfil em usuarios_app é
  // um campo global por e-mail, lido por ehBypassPermissao). Mesma checagem
  // que o Server Action equivalente do lado web já usa (exigirGerenciador-
  // DeUsuarios em usuarios/actions.ts, achado real corrigido lá em
  // 26/07/2026) — só não tinha sido replicada pra esta rota mobile gêmea.
  const { data: perfilChamador } = await supabaseDoUsuario.rpc("perfil_usuario_atual");
  if (perfilChamador !== "admin" && perfilChamador !== "analista") {
    return NextResponse.json(
      { erro: "Esta ação é exclusiva do time interno (perfil administrador ou analista)." },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  let corpo: {
    email?: string;
    nome?: string;
    cpf?: string;
    telefone?: string;
    perfil?: string;
    segmento?: string;
    empresa_id?: string;
  };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400, headers: CORS_HEADERS });
  }

  const email = (corpo.email ?? "").trim().toLowerCase();
  const nome = (corpo.nome ?? "").trim();
  const cpf = (corpo.cpf ?? "").trim() || null;
  const telefone = (corpo.telefone ?? "").trim() || null;
  const perfil = (corpo.perfil ?? "").trim();
  const segmento = (corpo.segmento ?? "").trim() || null;
  const empresaId = (corpo.empresa_id ?? "").trim();

  if (!email || !nome || !perfil || !empresaId) {
    return NextResponse.json(
      { erro: "E-mail, nome, perfil e empresa são obrigatórios." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!(PERFIS as readonly string[]).includes(perfil)) {
    return NextResponse.json(
      { erro: `Perfil inválido: "${perfil}".` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Checagem de pertencimento (ver comentário do topo) — usa o client
  // RLS-scoped do próprio chamador; se ele não for membro da empresa, a
  // policy de SELECT em `empresas` já devolve 0 linhas.
  const { data: empresaVisivel } = await supabaseDoUsuario
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresaVisivel) {
    return NextResponse.json(
      { erro: "Você não tem permissão para convidar usuários para esta empresa." },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const { error: authError } = await admin.auth.admin.inviteUserByEmail(email);
  if (authError && !authError.message.toLowerCase().includes("already been registered")) {
    return NextResponse.json(
      { erro: `Não foi possível convidar o usuário: ${authError.message}` },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const { error: perfilError } = await admin
    .from("usuarios_app")
    .upsert({ email, nome, perfil, cpf, telefone, segmento, ativo: true }, { onConflict: "email" });
  if (perfilError) {
    return NextResponse.json(
      { erro: `Usuário convidado, mas houve erro ao salvar o perfil: ${perfilError.message}` },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const { error: vinculoError } = await admin
    .from("usuarios_empresas")
    .upsert({ user_email: email, empresa_id: empresaId, role: perfil, ativo: true });
  if (vinculoError) {
    return NextResponse.json(
      { erro: `Perfil salvo, mas houve erro ao vincular à empresa: ${vinculoError.message}` },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
