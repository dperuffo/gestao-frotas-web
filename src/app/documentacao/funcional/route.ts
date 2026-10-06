import { HTML } from "@/app/_docs/funcional";
import { bloquearSeNaoAutorizado, CABECALHOS_DOCUMENTACAO } from "@/lib/acessoDocumentacao";

// Protegida: login + MFA (aal2) + perfil admin — ver src/lib/acessoDocumentacao.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  const bloqueio = await bloquearSeNaoAutorizado();
  if (bloqueio) return bloqueio;
  return new Response(HTML, { headers: CABECALHOS_DOCUMENTACAO });
}
