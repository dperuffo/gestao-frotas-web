"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Fase 27.92 — pedido do Daniel: cada posto cadastra a própria chave PIX
// (self-service), usada como "cedente" no boleto/documento de cobrança das
// faturas fechadas com clientes. RLS de `empresas` (empresas_update_admin,
// apesar do nome, já libera UPDATE pra qualquer membro da própria empresa —
// não só admin) garante que só quem pertence a esta empresa (ou admin)
// consegue salvar.
export async function atualizarPixChaveAcao(empresaId: string, pixChave: string) {
  const supabase = await createClient();

  const valor = pixChave.trim();
  if (valor.length > 140) {
    throw new Error("Chave PIX muito longa (máximo 140 caracteres).");
  }

  const { error } = await supabase
    .from("empresas")
    .update({ pix_chave: valor || null })
    .eq("id", empresaId);

  if (error) {
    throw new Error(`Erro ao salvar chave PIX: ${error.message}`);
  }

  revalidatePath("/minha-empresa");
}
