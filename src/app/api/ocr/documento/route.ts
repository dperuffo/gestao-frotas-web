import { NextResponse } from "next/server";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { extrairTextoDocumento } from "@/lib/ocr";
import type { Database } from "@/types/database.types";
import { resolverCorsHeaders } from "@/lib/corsOrigens";
import { verificarLimite } from "@/lib/rateLimit";

// Fase ocr-documentos (04/08/2026, item 8 do benchmark FNI vs KMM, Grupo 2)
// — mesma razão de existir da rota /api/assistente (ver comentário lá):
// esta é a única forma do PWA Motorista (estrada-que-cuida) rodar OCR, já
// que tesseract.js precisa de Node e o app é Flutter puro (sem esse
// runtime). Autentica com o access_token da sessão Supabase do usuário
// (Authorization: Bearer <token>) em vez de cookies — mesmo padrão.
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

  // M2 — protege custo de CPU (tesseract.js roda OCR de verdade a cada
  // chamada): limite por usuário autenticado.
  const limite = verificarLimite(`ocr:${user.id}`, 30, 10 * 60 * 1000);
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
    const resultado = await extrairTextoDocumento(bytes);
    return NextResponse.json(resultado, { headers: CORS_HEADERS });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado ao ler o documento.";
    return NextResponse.json({ erro: mensagem }, { status: 500, headers: CORS_HEADERS });
  }
}
