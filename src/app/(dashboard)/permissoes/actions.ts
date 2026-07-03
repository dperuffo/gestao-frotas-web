"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Atualiza (ou cria, se ainda não existir) uma célula da matriz funcionalidade x perfil.
// Usa upsert com onConflict na constraint única (funcionalidade, perfil).
export async function alternarPermissao(funcionalidade: string, perfil: string, permitido: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("permissoes_perfil").upsert(
    {
      funcionalidade,
      perfil,
      permitido,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    },
    { onConflict: "funcionalidade,perfil" }
  );

  if (error) {
    throw new Error(`Não foi possível salvar a permissão: ${error.message}`);
  }

  revalidatePath("/permissoes");
}
