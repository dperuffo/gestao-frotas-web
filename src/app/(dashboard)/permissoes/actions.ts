"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/permissoes");
}
