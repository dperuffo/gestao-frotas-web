import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Documentação técnica (Arquitetura FNI e Documentação funcional/APIs) servida
// em /documentacao/*. Mesmas exigências do dashboard, mais uma:
//  1) senha: o middleware já manda visitante anônimo para /login; aqui
//     conferimos de novo (defesa em profundidade, a rota não depende só dele);
//  2) MFA: fator TOTP verificado e sessão em aal2 (regra idêntica ao layout do
//     dashboard) — senão vai para /mfa-setup;
//  3) perfil admin: os documentos descrevem arquitetura interna, RPCs e rotas,
//     então só o time interno lê. Outro perfil recebe 403.
export const CABECALHOS_DOCUMENTACAO = {
  "Content-Type": "text/html; charset=utf-8",
  // Conteúdo restrito: nunca em cache compartilhado nem em buscadores.
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

const PAGINA_ACESSO_RESTRITO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Acesso restrito — FNI</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;background:#0f1b33;color:#e6edf7;display:grid;place-items:center;min-height:100vh;margin:0}
.c{background:#17274a;border-radius:12px;padding:28px 32px;max-width:440px}h1{margin:0 0 8px;font-size:20px}a{color:#7fc3ff}</style></head>
<body><div class="c"><h1>Acesso restrito</h1><p>Esta documentação é exclusiva do time interno da FNI (perfil administrador).</p><p><a href="/dashboard">Voltar ao painel</a></p></div></body></html>`;

// Devolve null quando o usuário pode ver o conteúdo; senão, a Response de
// bloqueio (ou lança o redirect para login/MFA, tratado pelo Next).
export async function bloquearSeNaoAutorizado(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const temFatorVerificado = factors?.totp?.some((f) => f.status === "verified") ?? false;
  const precisaSubirNivel = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  if (!temFatorVerificado || precisaSubirNivel) redirect("/mfa-setup");

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return new Response(PAGINA_ACESSO_RESTRITO, { status: 403, headers: CABECALHOS_DOCUMENTACAO });
  }
  return null;
}
