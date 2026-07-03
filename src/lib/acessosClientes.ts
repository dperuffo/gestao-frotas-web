import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Registra um evento de login de cliente (Fase 27.20) — alimenta o badge de
// notificação "Clientes" no menu e o painel "Últimos acessos" em /clientes.
// Chamada nos dois pontos de entrada de sessão: /auth/callback (Google) e
// entrarComSenha (e-mail/senha).
//
// Time interno FNI (perfil admin ou o e-mail do Daniel) não gera evento —
// só interessa saber quando um CLIENTE (qualquer plano, inclusive
// trial/gratuito) acessa a plataforma.
//
// Best-effort de propósito: qualquer falha aqui (RLS, RPC fora do ar, etc.)
// é só logada no servidor e nunca interrompe o login — mesmo raciocínio já
// aplicado ao envio de anexo na abertura de chamado (Fase 27.18).
export async function registrarAcessoCliente(supabase: Supabase, email: string | null | undefined): Promise<void> {
  if (!email) return;

  try {
    const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
    const ehTimeInterno = perfil === "admin" || email === "d.peruffo@gmail.com";
    if (ehTimeInterno) return;

    const { data: empresaIds } = await supabase.rpc("empresas_do_usuario", { p_email: email });
    if (!empresaIds || empresaIds.length === 0) return;

    const linhas = empresaIds.map((empresaId: string) => ({
      empresa_id: empresaId,
      user_email: email,
    }));

    const { error } = await supabase.from("acessos_clientes").insert(linhas);
    if (error) {
      console.error("[acessosClientes] falha ao registrar acesso:", error.message);
    }
  } catch (e) {
    console.error("[acessosClientes] falha ao registrar acesso:", e instanceof Error ? e.message : e);
  }
}
