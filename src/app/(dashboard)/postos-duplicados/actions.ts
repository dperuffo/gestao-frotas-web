"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase 27.137 — fila de revisão dos possíveis duplicados sinalizados pela
// RPC verificar_e_registrar_posto_anp (aba "Meu Posto"). Decisão do Daniel:
// o cadastro do posto nunca é bloqueado por essa checagem — só entra aqui
// numa fila pra um admin da FNI decidir depois se é duplicata de verdade ou
// não. RLS de postos_gf_possiveis_duplicados já restringe update a admin
// (perfil_usuario_atual() = 'admin'), então esta action não precisa de RPC
// própria — o Supabase client autenticado do admin já basta.
export async function descartarDuplicataAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("postos_gf_possiveis_duplicados")
    .update({ status: "descartado", revisado_por: user?.email ?? null, revisado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível descartar: ${error.message}` };
  revalidatePath("/postos-duplicados");
  return {};
}

// Confirma que é de fato uma duplicata. Não faz merge/exclusão automática
// dos registros (fora de escopo desta fase) — só marca a decisão pra ficar
// registrado, e o admin resolve manualmente em postos_gf/anp_postos se for
// o caso.
export async function confirmarDuplicataAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("postos_gf_possiveis_duplicados")
    .update({ status: "confirmado_duplicata", revisado_por: user?.email ?? null, revisado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível confirmar: ${error.message}` };
  revalidatePath("/postos-duplicados");
  return {};
}
