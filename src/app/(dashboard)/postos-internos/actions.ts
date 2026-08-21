"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMBUSTIVEIS_POSTO_INTERNO, ARLA32 } from "@/lib/constants";

// Fase Abastecimento-Interno (21/08/2026, pedido do Daniel) — tela
// self-service (mesmo padrão de /postos, /parametros-uso etc.) pro próprio
// cliente configurar o posto interno (garagem própria) de cada
// empresa/filial dele: ativar/desativar e cadastrar o preço de cada
// combustível vendido ali. RLS de postos_internos/_precos já garante que só
// dá pra mexer em empresa do próprio grupo econômico (ou admin) — as ações
// abaixo não fazem checagem extra de posse, confiam na policy do banco.

export type EstadoFormularioPostoInterno = { erro?: string; ok?: string } | undefined;

// Garante que existe uma linha em postos_internos pra essa empresa (cria com
// ativo=true na primeira vez que o cliente mexe na tela) e devolve o id.
export async function obterOuCriarPostoInternoAcao(empresaId: string) {
  const supabase = await createClient();
  const { data: existente } = await supabase
    .from("postos_internos")
    .select("id, nome, ativo")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (existente) return existente;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: criado, error } = await supabase
    .from("postos_internos")
    .insert({ empresa_id: empresaId, ativo: true, atualizado_por: user?.email ?? null })
    .select("id, nome, ativo")
    .single();
  if (error) return null;
  return criado;
}

export async function salvarDadosPostoInternoAcao(
  _prev: EstadoFormularioPostoInterno,
  formData: FormData
): Promise<EstadoFormularioPostoInterno> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const postoInternoId = String(formData.get("posto_interno_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  if (!empresaId || !postoInternoId) return { erro: "Empresa/posto interno inválido." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("postos_internos")
    .update({ nome, ativo, atualizado_em: new Date().toISOString(), atualizado_por: user?.email ?? null })
    .eq("id", postoInternoId)
    .eq("empresa_id", empresaId);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/postos-internos");
  return { ok: "Dados do posto interno salvos." };
}

export async function salvarPrecosPostoInternoAcao(
  _prev: EstadoFormularioPostoInterno,
  formData: FormData
): Promise<EstadoFormularioPostoInterno> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const postoInternoId = String(formData.get("posto_interno_id") ?? "");
  if (!empresaId || !postoInternoId) return { erro: "Empresa/posto interno inválido." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const combustiveisEArla = [...COMBUSTIVEIS_POSTO_INTERNO, ARLA32];
  const linhas: { posto_interno_id: string; combustivel: string; preco: number; atualizado_por: string | null }[] = [];

  for (const combustivel of combustiveisEArla) {
    const bruto = String(formData.get(`preco__${combustivel}`) ?? "").trim().replace(",", ".");
    if (!bruto) continue;
    const preco = Number(bruto);
    if (!Number.isFinite(preco) || preco < 0) {
      return { erro: `Preço inválido para ${combustivel}.` };
    }
    linhas.push({ posto_interno_id: postoInternoId, combustivel, preco, atualizado_por: user?.email ?? null });
  }

  if (linhas.length === 0) return { erro: "Informe ao menos um preço." };

  const { error } = await supabase
    .from("postos_internos_precos")
    .upsert(linhas, { onConflict: "posto_interno_id,combustivel" });

  if (error) return { erro: `Não foi possível salvar os preços: ${error.message}` };

  revalidatePath("/postos-internos");
  return { ok: "Preços atualizados." };
}
