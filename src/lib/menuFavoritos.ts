"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Fase Acesso-Rápido-Favoritos (04/08/2026, pedido do Daniel: "mecanismo de
// acesso rápido em funcionalidades mais utilizadas... uma espécie de
// favoritos... usar inteligência artificial para posicionar as abas mais
// utilizadas") — decisão conversada: "inteligência" aqui é frecência
// (frequência + recência com decaimento, mesmo princípio de navegadores pra
// "sites mais visitados"), calculada inteira dentro das RPCs
// registrar_acesso_menu/favoritos_menu_do_usuario no Postgres (ver migração
// menu_favoritos_acesso_rapido) — sem chamada a modelo de IA nenhum, pra
// ficar instantâneo e sem custo por navegação. Este arquivo só repassa as
// chamadas pro banco a partir do client/server components.

// Chamado a cada navegação pra uma rota rastreável (ver HREFS_RASTREAVEIS em
// layout.tsx) — best-effort e SILENCIOSO de propósito: nunca deve travar
// nem atrasar a navegação, e uma falha aqui não é visível pro usuário (só
// significa que aquele acesso não contou pra frecência desta vez).
export async function registrarAcessoMenuAcao(href: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("registrar_acesso_menu", { p_href: href });
  } catch (e) {
    void logger.error("menuFavoritos", "Falha ao registrar acesso (ignorado)", e);
  }
}

// Fixa (p_fixar=true) ou remove (p_fixar=false) manualmente um item do
// acesso rápido — chamado tanto pela estrela no menu lateral quanto pelo
// "x" na barra de atalhos. Diferente do registro de acesso, esta PROPAGA o
// erro: quem chama (BotaoFavoritoMenu/BarraAtalhosFavoritos) precisa saber
// que falhou pra desfazer a atualização otimista da UI.
export async function alternarFavoritoMenuAcao(href: string, fixar: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("alternar_favorito_menu", { p_href: href, p_fixar: fixar });
  if (error) throw error;
  // Revalida o layout inteiro (não só a rota atual) porque a barra de
  // atalhos e as estrelas do menu lateral vivem no layout.tsx, compartilhado
  // por toda tela do dashboard.
  revalidatePath("/", "layout");
}
