"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Limites de tokens do Assistente FNI — só o administrador FNI edita.
// Por plano: limites_plano.assistente_tokens_mes. Por cliente (exceção):
// assistente_config_empresa.franquia_tokens_mes (vazio = usa o limite do plano).
// Valor -1 = ilimitado. As tabelas não estão nos tipos gerados, então o cliente é "solto".
type Resultado = { ok: true } | { ok: false; erro: string };

async function exigirAdmin(): Promise<{ ok: true; email: string } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (perfil !== "admin" || !user) return { ok: false, erro: "Ação exclusiva do administrador FNI." };
  return { ok: true, email: user.email ?? "" };
}

function validarLimite(valor: number): string | null {
  if (!Number.isInteger(valor)) return "Informe um número inteiro de tokens.";
  if (valor < -1) return "Use -1 para ilimitado ou um valor a partir de 0.";
  if (valor > 100_000_000_000) return "Valor alto demais.";
  return null;
}

export async function salvarLimitePlanoAcao(plano: string, tokens: number): Promise<Resultado> {
  const acesso = await exigirAdmin();
  if (!acesso.ok) return acesso;
  const invalido = validarLimite(tokens);
  if (invalido) return { ok: false, erro: invalido };
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin.from("limites_plano").update({ assistente_tokens_mes: tokens }).eq("plano", plano).select("plano");
  if (error || !data || data.length === 0) return { ok: false, erro: "Não foi possível salvar o limite deste plano." };
  revalidatePath("/administracao/limites-assistente");
  return { ok: true };
}

// tokens = null remove a exceção (volta a valer o limite do plano). A linha é mantida
// porque pode guardar a chave própria do cliente.
export async function salvarLimiteClienteAcao(empresaId: string, tokens: number | null): Promise<Resultado> {
  const acesso = await exigirAdmin();
  if (!acesso.ok) return acesso;
  if (tokens !== null) {
    const invalido = validarLimite(tokens);
    if (invalido) return { ok: false, erro: invalido };
  }
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("assistente_config_empresa")
    .upsert({ empresa_id: empresaId, franquia_tokens_mes: tokens, atualizado_em: new Date().toISOString() }, { onConflict: "empresa_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar o limite deste cliente." };
  revalidatePath("/administracao/limites-assistente");
  return { ok: true };
}
