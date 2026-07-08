"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { atualizarLogoutInatividadeMinutos } from "@/lib/configuracoesSistema";

// Fase 27.86 — pedido do Daniel: logout automático por inatividade,
// parametrizável em tela de admin (/configuracoes). A validação de valor e
// a checagem de admin/superusuário ficam em src/lib/configuracoesSistema.ts
// (mesmo padrão de atualizarCicloPagamentoAcao, Fase 27.80) — aqui só lida
// com o form e o revalidatePath.
export async function atualizarLogoutInatividadeAcao(formData: FormData): Promise<{ erro?: string }> {
  const minutos = Number(formData.get("logout_inatividade_minutos"));
  if (!Number.isFinite(minutos)) return { erro: "Informe um número válido de minutos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await atualizarLogoutInatividadeMinutos(supabase, {
    minutos,
    atualizadoPor: user?.email ?? null,
  });
  if ("erro" in resultado) return { erro: resultado.erro };

  // Revalida o layout inteiro (não só /configuracoes) — o novo valor
  // precisa chegar no MonitorInatividade, que é montado em
  // (dashboard)/layout.tsx e lido por TODA tela do sistema.
  revalidatePath("/", "layout");
  return {};
}
