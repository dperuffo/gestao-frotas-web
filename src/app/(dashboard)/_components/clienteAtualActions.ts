"use server";

import { createClient } from "@/lib/supabase/server";

// Fase Indicador-Cliente-Atual (27/09/2026, pedido do Daniel: usuário de
// grupo econômico "ficou confuso em relação à identificação de qual
// cliente ... estava navegando e visualizando"). Resolve só o nome da
// empresa pro badge fixo do menu lateral (IndicadorClienteAtual.tsx), a
// partir do id que já está na URL (?empresa=) — mesmo parâmetro que
// resolverEmpresaAtual já lê em ~150 páginas. RLS de "empresas" já garante
// que só devolve o nome se o usuário logado tiver acesso àquela empresa
// (dono direto ou "irmã" do mesmo grupo econômico) — mesma proteção que
// resolverEmpresaAtual já confia nas demais telas, não duplicada aqui.
export async function buscarNomeEmpresaAtualAcao(empresaId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
  return data?.nome ?? null;
}
