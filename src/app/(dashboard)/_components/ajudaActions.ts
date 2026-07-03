"use server";

import { createClient } from "@/lib/supabase/server";

// Marca o tour de boas-vindas (Fase 24) como visto pro usuário logado —
// chama a RPC SECURITY DEFINER marcar_tour_onboarding_visto(), que só
// atualiza a própria linha do usuário em usuarios_app (não existe policy de
// UPDATE aberta pro usuário comum nessa tabela, de propósito). Sem retorno
// de erro pro chamador: se falhar, o pior caso é o tour aparecer de novo no
// próximo acesso — não é crítico o suficiente pra travar a navegação.
export async function marcarTourVistoAcao(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("marcar_tour_onboarding_visto");
}
