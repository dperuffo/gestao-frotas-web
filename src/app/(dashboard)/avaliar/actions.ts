"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AvaliacaoFormState = { erro?: string; sucesso?: boolean } | undefined;

// Cliente envia uma avaliação da plataforma (estrelas 1-5 + observação
// opcional). RLS garante que o insert só vale com o próprio e-mail e uma
// empresa que o usuário realmente enxerga (ver migração
// avaliacoes_resposta_admin_e_rls) — aqui só validamos o básico de UX.
export async function enviarAvaliacaoAcao(
  _prev: AvaliacaoFormState,
  formData: FormData
): Promise<AvaliacaoFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const estrelas = Number(formData.get("estrelas"));
  const comentario = String(formData.get("comentario") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim() || null;

  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
    return { erro: "Selecione de 1 a 5 estrelas." };
  }

  const { error } = await supabase.from("avaliacoes").insert({
    user_email: user.email,
    empresa_id: empresaId,
    estrelas,
    comentario: comentario || null,
  });

  if (error) return { erro: `Não foi possível enviar sua avaliação: ${error.message}` };

  revalidatePath("/avaliar");
  return { sucesso: true };
}
