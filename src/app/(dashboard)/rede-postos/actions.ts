"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  criarGrupoEconomico,
  atualizarGrupoEconomico,
  vincularEmpresaAoGrupo,
  desvincularEmpresaDoGrupo,
} from "@/lib/gruposEconomicos";

export type RedeFormState = { erro?: string } | undefined;

// Fase 27.87 — pedido do Daniel: "Criar a mesma mecanica de grupo economico
// para postos, só que em postos deve ser denominado de 'Rede de Postos'".
// Espelha /grupo-economico/actions.ts — mesma lib compartilhada
// (src/lib/gruposEconomicos.ts), só fixando segmento: "Revenda" e
// revalidando/redirecionando pras rotas de /rede-postos.
export async function criarRede(_prev: RedeFormState, formData: FormData): Promise<RedeFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;

  const resultado = await criarGrupoEconomico(supabase, { segmento: "Revenda", nome, cnpjMatriz: cnpj_matriz });
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath("/rede-postos");
  redirect(`/rede-postos/${resultado.id}`);
}

export async function atualizarRede(
  id: string,
  _prev: RedeFormState,
  formData: FormData
): Promise<RedeFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  const resultado = await atualizarGrupoEconomico(supabase, { id, nome, cnpjMatriz: cnpj_matriz, ativo });
  if (resultado.erro) return { erro: resultado.erro };

  revalidatePath("/rede-postos");
  revalidatePath(`/rede-postos/${id}`);
  return { erro: undefined };
}

export async function vincularPosto(redeId: string, empresaId: string) {
  const supabase = await createClient();
  const resultado = await vincularEmpresaAoGrupo(supabase, { grupoId: redeId, empresaId });
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/rede-postos/${redeId}`);
}

export async function desvincularPosto(redeId: string, vinculoId: string) {
  const supabase = await createClient();
  const resultado = await desvincularEmpresaDoGrupo(supabase, vinculoId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/rede-postos/${redeId}`);
}
