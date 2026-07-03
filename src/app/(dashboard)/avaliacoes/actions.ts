"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Admin (time interno FNI) responde a uma avaliação enviada por um cliente.
// RLS (avaliacoes_update_admin) já garante que só admin/perfil interno
// consegue de fato gravar — aqui só validamos o texto e resolvemos quem é
// o autor da resposta.
export async function responderAvaliacaoAcao(
  avaliacaoId: string,
  resposta: string
): Promise<{ erro?: string }> {
  const respostaLimpa = resposta.trim();
  if (!respostaLimpa) return { erro: "Escreva uma resposta." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const { error } = await supabase
    .from("avaliacoes")
    .update({
      resposta_admin: respostaLimpa,
      respondido_por: user.email,
      respondido_em: new Date().toISOString(),
    })
    .eq("id", avaliacaoId);

  if (error) return { erro: error.message };

  revalidatePath("/avaliacoes");
  return {};
}

// Conta avaliações sem resposta ainda — usada pelo badge de notificação no
// menu lateral (layout.tsx). Só retorna algo pra admin (não-admin nem
// enxerga as avaliações de outros clientes via RLS, então a contagem sairia
// zerada mesmo, mas evitamos a chamada à toa).
export async function contarAvaliacoesPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") return 0;

  const { count } = await supabase
    .from("avaliacoes")
    .select("id", { count: "exact", head: true })
    .is("resposta_admin", null);

  return count ?? 0;
}
