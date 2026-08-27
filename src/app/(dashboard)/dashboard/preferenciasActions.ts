"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação", item do roadmap "Dashboard configurável por
// usuário") — persiste quais dos 9 painéis de "Indicadores avançados" cada
// usuário escolheu ocultar. Mesmo espírito de menu_favoritos.ts: tabela
// self-service (RLS por usuario_email), sem precisar de RPC porque não há
// lógica de agregação nenhuma aqui, só um array de chaves.

// Best-effort e SILENCIOSO de propósito (mesmo padrão de
// registrarAcessoMenuAcao em menuFavoritos.ts) — uma falha ao LER a
// preferência não pode quebrar o dashboard inteiro, só faz ele mostrar
// todos os painéis (comportamento padrão).
export async function buscarPaineisOcultosAcao(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return [];
    const { data, error } = await supabase
      .from("preferencias_dashboard")
      .select("paineis_ocultos")
      .eq("usuario_email", user.email)
      .maybeSingle();
    if (error) throw error;
    return data?.paineis_ocultos ?? [];
  } catch (e) {
    void logger.error("dashboardPreferencias", "Falha ao buscar painéis ocultos (ignorado)", e);
    return [];
  }
}

// Já propaga erro (diferente da leitura acima): quem chama precisa saber
// que falhou pra desfazer a atualização otimista do checkbox na UI.
export async function definirVisibilidadePainelAcao(chave: string, oculto: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Usuário não autenticado.");

  const { data: existente } = await supabase
    .from("preferencias_dashboard")
    .select("paineis_ocultos")
    .eq("usuario_email", user.email)
    .maybeSingle();

  const atuais = existente?.paineis_ocultos ?? [];
  const novos = oculto ? Array.from(new Set([...atuais, chave])) : atuais.filter((c: string) => c !== chave);

  const { error } = await supabase
    .from("preferencias_dashboard")
    .upsert(
      { usuario_email: user.email, paineis_ocultos: novos, atualizado_em: new Date().toISOString() },
      { onConflict: "usuario_email" }
    );
  if (error) throw error;
  revalidatePath("/dashboard");
}
