"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Inteligência-Comercial-Posto-3 (09/09/2026, pedido do Daniel: "fechar
// o loop de ação" — a tela era só leitura, o posto não tinha onde registrar
// que já tentou contatar um cliente em risco). Tabela
// contatos_clientes_posto tem RLS tenant_all (mesmo padrão de
// acoes_sugeridas_config_restricao) — não precisa de RPC dedicada, o insert
// direto via .from() já é seguro.
export async function registrarContatoAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const empresaPostoId = String(formData.get("empresa_posto_id") ?? "").trim();
  const empresaClienteId = String(formData.get("empresa_cliente_id") ?? "").trim();
  const nota = String(formData.get("nota") ?? "").trim();
  if (!empresaPostoId || !empresaClienteId || !nota) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("contatos_clientes_posto").insert({
    empresa_posto_id: empresaPostoId,
    empresa_cliente_id: empresaClienteId,
    nota,
    criado_por: user?.email ?? null,
  });

  revalidatePath("/inteligencia-comercial-posto");
}
