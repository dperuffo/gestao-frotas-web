"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  criarGrupoFrotaSelfService,
  atualizarGrupoEconomico,
  vincularEmpresaAoGrupo,
  desvincularEmpresaDoGrupo,
} from "@/lib/gruposEconomicos";

export type GrupoFormState = { erro?: string } | undefined;

// Fase 27.87 — a lógica de escrita foi extraída pra src/lib/gruposEconomicos.ts
// (compartilhada com /rede-postos/actions.ts, o equivalente pro lado dos
// postos) — aqui só fixa segmento: "Frota" e cuida do revalidatePath/redirect
// desta rota.
//
// Fase Grupo-Economico-Frota-Billing (09/08/2026) — pedido do Daniel: abrir
// self-service pro próprio cliente criar seu Grupo Econômico, mesmo padrão
// de "Rede de Posto tem que estar na visão do posto" (Fase 27.139) aplicado
// aqui pro lado Frota. criarGrupo passou a exigir uma empresa fundadora
// (empresa_id, escolhida em /grupo-economico/novo) e usa
// criarGrupoFrotaSelfService (RPC), que cobre tanto o caso self-service
// quanto o admin — não cria mais grupo "órfão" sem membro nenhum.
export async function criarGrupo(_prev: GrupoFormState, formData: FormData): Promise<GrupoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;
  const empresa_id = String(formData.get("empresa_id") ?? "").trim();

  const resultado = await criarGrupoFrotaSelfService(supabase, {
    nome,
    cnpjMatriz: cnpj_matriz,
    empresaId: empresa_id,
  });
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath("/grupo-economico");
  redirect(`/grupo-economico/${resultado.id}`);
}

export async function atualizarGrupo(
  id: string,
  _prev: GrupoFormState,
  formData: FormData
): Promise<GrupoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  const resultado = await atualizarGrupoEconomico(supabase, { id, nome, cnpjMatriz: cnpj_matriz, ativo });
  if (resultado.erro) return { erro: resultado.erro };

  revalidatePath("/grupo-economico");
  revalidatePath(`/grupo-economico/${id}`);
  return { erro: undefined };
}

export async function vincularEmpresa(grupoId: string, empresaId: string) {
  const supabase = await createClient();
  const resultado = await vincularEmpresaAoGrupo(supabase, { grupoId, empresaId });
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/grupo-economico/${grupoId}`);
}

export async function desvincularEmpresa(grupoId: string, vinculoId: string) {
  const supabase = await createClient();
  // Fase 27.139 — desvincularEmpresaDoGrupo passou a exigir o grupoId (pra
  // permitir self-service de Rede de Postos sem abrir mão da checagem de
  // permissão). Fase Grupo-Economico-Frota-Billing (09/08/2026) — mesmo
  // self-service passou a valer pro Grupo Econômico (Frota) também.
  const resultado = await desvincularEmpresaDoGrupo(supabase, vinculoId, grupoId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/grupo-economico/${grupoId}`);
}
