"use server";

import { createClient } from "@/lib/supabase/server";

// Fase Dark-Mode-Por-Conta (15/09/2026, pedido do Daniel: vincular a
// preferência de tema à CONTA do usuário, não só ao localStorage do
// navegador — em computador compartilhado, o 2º usuário a logar herdava o
// tema que o 1º tinha escolhido) — persiste a escolha feita no
// <ThemeToggle> também no banco, chamando a RPC SECURITY DEFINER
// definir_tema_preferido(), que só atualiza a própria linha do usuário em
// usuarios_app (mesmo motivo/padrão de marcarTourVistoAcao em
// ajudaActions.ts: não existe policy de UPDATE aberta pro usuário comum
// nessa tabela, de propósito).
//
// Sem retorno de erro pro chamador: se falhar (ex.: sessão expirada bem na
// hora do clique), o pior caso é o tema não persistir no banco dessa vez —
// a troca local via next-themes já aconteceu e não deve travar por causa
// disso.
export async function definirTemaPreferidoAcao(tema: "light" | "dark" | "system"): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("definir_tema_preferido", { p_tema: tema });
}
