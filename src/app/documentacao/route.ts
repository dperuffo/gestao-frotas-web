import { bloquearSeNaoAutorizado, CABECALHOS_DOCUMENTACAO } from "@/lib/acessoDocumentacao";

// Índice da documentação técnica. Protegido: login + MFA (aal2) + perfil admin.
export const dynamic = "force-dynamic";

const INDICE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>FNI — Documentação técnica</title><link rel="icon" href="/icon.png">
<style>body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f8fb;color:#1b2433}
.w{max-width:760px;margin:0 auto;padding:48px 24px}img{height:56px;display:block;margin-bottom:18px}
h1{color:#0b3d91;margin:0 0 6px}p.s{color:#5b6b82;margin:0 0 28px}
a.c{display:block;background:#fff;border:1px solid #dfe5ee;border-radius:12px;padding:18px 22px;margin:14px 0;text-decoration:none;color:inherit}
a.c:hover{border-color:#1d5fd1;box-shadow:0 2px 10px rgba(29,95,209,.12)}a.c b{color:#0b3d91;font-size:18px}a.c span{display:block;color:#5b6b82;font-size:14px;margin-top:4px}
.n{font-size:13px;color:#5b6b82;margin-top:30px}</style></head><body><div class="w">
<img src="/logo-fni.png" alt="FNI — Fleet Network Intelligence">
<h1>Documentação técnica</h1><p class="s">Área restrita ao time interno da FNI.</p>
<a class="c" href="/documentacao/arquitetura"><b>Arquitetura FNI</b><span>Modelo C4: contexto, contêineres, componentes e código, com o recorte completo do PDV FNI.</span></a>
<a class="c" href="/documentacao/funcional"><b>Documentação funcional e de APIs</b><span>Fluxos de cada funcionalidade, API externa, rotas internas, RPCs, Edge Functions e integrações.</span></a>
<p class="n">Acesso protegido por senha e MFA. <a href="/dashboard">Voltar ao painel</a></p></div></body></html>`;

export async function GET() {
  const bloqueio = await bloquearSeNaoAutorizado();
  if (bloqueio) return bloqueio;
  return new Response(INDICE, { headers: CABECALHOS_DOCUMENTACAO });
}
