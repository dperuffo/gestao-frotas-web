import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_USUARIOS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";

// API de leitura de usuários com acesso à plataforma (Fase 25 — Hub de
// Integrações). O mais sensível dos 5 cadastros expostos — por isso NUNCA
// devolve mfa_secret/mfa_habilitado (postura de segurança da conta, não é
// dado de negócio) nem qualquer coisa além do necessário pra um RH/ERP
// saber quem tem acesso. usuarios_app não tem empresa_id direto (vínculo é
// por e-mail via usuarios_empresas) — mesmo padrão de 2 consultas já usado
// em /usuarios (dashboard).
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_USUARIOS_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { limit, offset } = lerPaginacao(new URL(request.url));

  const { data: vinculos, error: erroVinculos } = await supabase
    .from("usuarios_empresas")
    .select("user_email")
    .eq("empresa_id", chave.empresaId)
    .eq("ativo", true);

  if (erroVinculos) {
    return NextResponse.json({ erro: `Erro ao consultar usuários: ${erroVinculos.message}` }, { status: 500 });
  }

  const emails = (vinculos ?? []).map((v) => v.user_email);
  if (emails.length === 0) {
    return NextResponse.json({ total: 0, limit, offset, dados: [] });
  }

  const { data: usuarios, error: erroUsuarios } = await supabase
    .from("usuarios_app")
    .select("email, nome, perfil, ativo, telefone")
    .in("email", emails)
    .order("nome")
    .range(offset, offset + limit - 1);

  if (erroUsuarios) {
    return NextResponse.json({ erro: `Erro ao consultar usuários: ${erroUsuarios.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: emails.length, limit, offset, dados: usuarios ?? [] });
}
