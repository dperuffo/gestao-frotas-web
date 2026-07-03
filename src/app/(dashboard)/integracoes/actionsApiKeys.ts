"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gerarChaveApi, CATALOGO_ESCOPOS } from "@/lib/apiKeys";

// Gera uma nova chave de API pra empresa, com um ou mais escopos escolhidos
// pelo usuário (Fase 25 — antes só existia o escopo custos_fixos:write,
// fixo). A chave em texto puro é devolvida UMA VEZ SÓ pro chamador exibir —
// só o hash fica salvo no banco (RLS já garante que o insert só vale pra
// empresa que o usuário enxerga, ver migração api_keys_rls).
export async function gerarChaveApiAcao(
  empresaId: string,
  nome: string,
  escopos: string[]
): Promise<{ erro?: string; chave?: string }> {
  const nomeLimpo = nome.trim();
  if (!empresaId) return { erro: "Selecione o cliente." };
  if (!nomeLimpo) return { erro: "Dê um nome pra identificar essa chave (ex: \"ERP financeiro\")." };

  const escoposValidos = escopos.filter((e) => CATALOGO_ESCOPOS.some((c) => c.escopo === e));
  if (escoposValidos.length === 0) return { erro: "Selecione pelo menos uma permissão pra essa chave." };

  const supabase = await createClient();
  const { chave, hash } = gerarChaveApi();

  const { error } = await supabase.from("api_keys").insert({
    empresa_id: empresaId,
    nome: nomeLimpo,
    hash_chave: hash,
    escopos: escoposValidos,
    ativa: true,
  });

  if (error) return { erro: `Não foi possível gerar a chave: ${error.message}` };

  revalidatePath("/integracoes");
  return { chave };
}

export async function revogarChaveApiAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ ativa: false, revogada_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/integracoes");
  return {};
}
