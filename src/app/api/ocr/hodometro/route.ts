import { NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { extrairHodometro } from "@/lib/ocr";
import type { Database } from "@/types/database.types";
import { resolverCorsHeaders } from "@/lib/corsOrigens";
import { verificarLimite } from "@/lib/rateLimit";

// Fase 5 PDV (02/10/2026) — mesmo padrão de /api/ocr/cupom-abastecimento
// (auth via access_token Bearer, runtime Node obrigatório pro tesseract.js,
// rate-limit por usuário): lê a foto do hodômetro tirada pelo motorista na
// jornada do PDV e devolve uma sugestão de valor pra pré-preencher o
// campo — ele sempre pode corrigir antes de confirmar. A validação de
// negócio (hodômetro > último registrado do veículo) acontece no banco
// (iniciar_abastecimento_pdv), não aqui.
export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: resolverCorsHeaders(request) });
}

export async function POST(request: Request) {
  const CORS_HEADERS = resolverCorsHeaders(request);
  const autorizacao = request.headers.get("authorization");
  const token = autorizacao?.startsWith("Bearer ") ? autorizacao.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ erro: "Cabeçalho Authorization: Bearer <token> é obrigatório." }, { status: 401, headers: CORS_HEADERS });
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
    return NextResponse.json({ erro: "Sessão inválida ou expirada, faça login novamente." }, { status: 401, headers: CORS_HEADERS });
  }

  const limite = verificarLimite(`ocr-hodometro:${user.id}`, 30, 10 * 60 * 1000);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "Muitas fotos em pouco tempo — tente novamente em instantes." },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(limite.tentarNovamenteEmSegundos) } }
    );
  }

  let arquivo: File | null = null;
  try {
    const formData = await request.formData();
    const valor = formData.get("arquivo");
    if (valor instanceof File) arquivo = valor;
  } catch {
    return NextResponse.json({ erro: "Envie a foto como multipart/form-data no campo 'arquivo'." }, { status: 400, headers: CORS_HEADERS });
  }

  if (!arquivo) {
    return NextResponse.json({ erro: "Nenhuma foto enviada." }, { status: 400, headers: CORS_HEADERS });
  }
  if (arquivo.size > 8 * 1024 * 1024) {
    return NextResponse.json({ erro: "Foto muito grande (máximo 8MB)." }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await extrairHodometro(bytes);
    return NextResponse.json(resultado, { headers: CORS_HEADERS });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado ao ler o hodômetro.";
    return NextResponse.json({ erro: mensagem }, { status: 500, headers: CORS_HEADERS });
  }
}
