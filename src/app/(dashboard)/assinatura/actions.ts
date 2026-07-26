"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Posto/Rede (26/07/2026) — cria uma Rede de Postos a partir da tela
// de Minha Assinatura (segmento Revenda). Reaproveita a RPC
// criar_rede_posto_self_service (SECURITY DEFINER, já existente no banco)
// que confere segmento='Revenda' e posse da empresa antes de inserir —
// esta action só repassa os campos do form e trata o retorno jsonb.
// Quem cria a rede vira automaticamente a empresa_administradora_id (é
// quem vai pagar a assinatura única da rede — decisão do Daniel: "matriz
// paga por todos").
export type CriarRedeFormState = { erro?: string } | undefined;

export async function criarRedePosto(
  empresaId: string,
  _prev: CriarRedeFormState,
  formData: FormData
): Promise<CriarRedeFormState> {
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  const cnpjMatriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;

  if (!nome) {
    return { erro: "Informe um nome para a rede." };
  }

  const { data, error } = await supabase.rpc("criar_rede_posto_self_service", {
    p_nome: nome,
    p_cnpj_matriz: cnpjMatriz,
    p_empresa_id: empresaId,
  });

  if (error) {
    return { erro: `Erro ao criar rede: ${error.message}` };
  }
  const resultado = data as { ok: boolean; erro?: string } | null;
  if (!resultado?.ok) {
    return { erro: resultado?.erro ?? "Não foi possível criar a rede." };
  }

  revalidatePath("/assinatura");
  return undefined;
}
