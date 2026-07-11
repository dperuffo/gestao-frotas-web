"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  criarRedePostoSelfService,
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
//
// Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão do
// posto para criação e gestão". criarRede passou a exigir um posto
// fundador (empresa_id, escolhido na tela /rede-postos/novo — o próprio
// posto pra quem é self-service, ou qualquer posto Revenda pra admin) e
// usa criarRedePostoSelfService (RPC), que já cobre tanto o caso
// self-service quanto o admin — não cria mais Rede "órfã" sem membro.
export async function criarRede(_prev: RedeFormState, formData: FormData): Promise<RedeFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const cnpj_matriz = String(formData.get("cnpj_matriz") ?? "").trim() || null;
  const empresa_id = String(formData.get("empresa_id") ?? "").trim();

  const resultado = await criarRedePostoSelfService(supabase, {
    nome,
    cnpjMatriz: cnpj_matriz,
    empresaId: empresa_id,
  });
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
  const resultado = await desvincularEmpresaDoGrupo(supabase, vinculoId, redeId);
  if (resultado.erro) throw new Error(resultado.erro);
  revalidatePath(`/rede-postos/${redeId}`);
}
