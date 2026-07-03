import { createAdminClient } from "@/lib/supabase/admin";
import { hashChaveApi } from "@/lib/apiKeys";

// Helper compartilhado de autenticação de API externa (Fase 25) — extraído
// do que antes só existia duplicado dentro de
// /api/integracoes/custos-fixos/route.ts (Fase 22). Todo endpoint novo em
// /api/integracoes/* e /api/cadastros/* usa isto em vez de reimplementar
// hash + lookup + checagem de escopo.

export type ChaveAutenticada = {
  id: string;
  empresaId: string;
  escopos: string[];
};

export type ResultadoAuthApi =
  | { ok: true; chave: ChaveAutenticada; supabase: ReturnType<typeof createAdminClient> }
  | { ok: false; status: number; erro: string };

// Autentica via `Authorization: Bearer <chave>` e confere se a chave tem o
// escopo necessário pro endpoint que está chamando (ex.: "veiculos:read").
// A chave nunca é comparada em texto puro — só o hash SHA-256
// (api_keys.hash_chave) é gravado no banco (ver src/lib/apiKeys.ts).
export async function autenticarRequisicaoApi(
  request: Request,
  escopoNecessario: string
): Promise<ResultadoAuthApi> {
  const autorizacao = request.headers.get("authorization");
  const chaveRecebida = autorizacao?.startsWith("Bearer ") ? autorizacao.slice(7).trim() : null;
  if (!chaveRecebida) {
    return { ok: false, status: 401, erro: "Cabeçalho Authorization: Bearer <chave> é obrigatório." };
  }

  const supabase = createAdminClient();
  const hash = hashChaveApi(chaveRecebida);

  const { data: chave, error } = await supabase
    .from("api_keys")
    .select("id, empresa_id, escopos, ativa, revogada_em")
    .eq("hash_chave", hash)
    .maybeSingle();

  if (error || !chave || !chave.ativa || chave.revogada_em) {
    return { ok: false, status: 401, erro: "Chave de API inválida, inativa ou revogada." };
  }

  const escopos = Array.isArray(chave.escopos) ? (chave.escopos as string[]) : [];
  if (!escopos.includes(escopoNecessario)) {
    return {
      ok: false,
      status: 403,
      erro: `Esta chave não tem o escopo "${escopoNecessario}". Escopos desta chave: ${escopos.join(", ") || "nenhum"}.`,
    };
  }

  return { ok: true, chave: { id: chave.id, empresaId: chave.empresa_id, escopos }, supabase };
}

// Chamado no fim de um handler bem-sucedido (mesmo padrão do endpoint de
// custos-fixos original) — não bloqueia a resposta se falhar, atualizar
// "último uso" não é crítico o suficiente pra derrubar a requisição.
export async function marcarUsoChaveApi(
  supabase: ReturnType<typeof createAdminClient>,
  chaveId: string
): Promise<void> {
  await supabase.from("api_keys").update({ ultimo_uso: new Date().toISOString() }).eq("id", chaveId);
}
