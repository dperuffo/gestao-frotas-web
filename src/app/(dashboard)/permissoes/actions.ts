"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EMPRESA_ID_GLOBAL } from "@/lib/constants";
import { invalidarCachePermissoes } from "@/lib/permissoes";

// Atualiza (ou cria, se ainda não existir) uma célula da matriz funcionalidade
// x perfil, dentro de uma empresa específica (Fase 27.1 — empresa_id vem
// sempre do chamador: EMPRESA_ID_GLOBAL para o admin editando o padrão do
// sistema, ou o id real da empresa quando um gestor_frota/analista customiza
// a permissão só para o próprio cliente). Usa upsert com onConflict na
// constraint única (funcionalidade, perfil, empresa_id) — a RLS de
// permissoes_perfil garante que ninguém consiga escrever fora do que tem
// direito (nível de perfil e, para não-admin, só a própria empresa nunca a
// linha global).
export async function alternarPermissao(
  funcionalidade: string,
  perfil: string,
  permitido: boolean,
  empresaId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("permissoes_perfil").upsert(
    {
      funcionalidade,
      perfil,
      empresa_id: empresaId,
      permitido,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    },
    { onConflict: "funcionalidade,perfil,empresa_id" }
  );

  if (error) {
    throw new Error(`Não foi possível salvar a permissão: ${error.message}`);
  }

  // Fase Observabilidade-Fase2 (14/08/2026) — `carregarMapaPermissoes` agora
  // cacheia o padrão global por até 30s (ver src/lib/permissoes.ts); sem
  // isto, uma mudança feita aqui pelo admin podia demorar até 30s pra valer
  // pra ele mesmo testar. Só invalida quando é o padrão GLOBAL que mudou —
  // customização por empresa nunca foi cacheada, não precisa invalidar nada.
  if (empresaId === EMPRESA_ID_GLOBAL) {
    invalidarCachePermissoes();
  }

  revalidatePath("/permissoes");
}
