"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormaPagamentoPdv } from "@/lib/formasPagamentoPdv";

// Fase 4 PDV (02/10/2026) — mesmo padrão de salvarParametroPrePedidoAcao
// (ver parametros-uso/actions.ts): upsert com onConflict, carimbo de quem
// mudou, revalidatePath. Diferença: aqui é uma LINHA por forma de
// pagamento (chave composta empresa_id+forma_pagamento), não um booleano
// único por empresa. A RLS da tabela (tenant via empresas_do_usuario) é a
// proteção real contra um usuário mexer em empresa que não é dele — essa
// Server Action não duplica essa checagem, mesmo padrão já usado em
// SecaoPrePedido/parametros-uso.
export async function salvarFormaPagamentoPdvAcao(
  empresaId: string,
  formaPagamento: FormaPagamentoPdv,
  ativo: boolean
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("pdv_formas_pagamento_permitidas").upsert(
    {
      empresa_id: empresaId,
      forma_pagamento: formaPagamento,
      ativo,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    },
    { onConflict: "empresa_id,forma_pagamento" }
  );

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/pdv-formas-pagamento");
  return {};
}
