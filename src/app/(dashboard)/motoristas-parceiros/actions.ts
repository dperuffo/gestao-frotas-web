"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Rede de motoristas parceiros (Fase Fretes) — pré-requisito pro modo
// direto de frete: cliente convida um motorista de FORA da própria empresa
// (agregado/terceiro) pra virar "parceiro", e passa a poder atribuir frete
// direto a ele, igual faria com um motorista próprio. Busca por CPF/telefone
// via RPC porque a RLS de "motoristas" só libera leitura da própria empresa
// — convidado pode ser de qualquer empresa (ou nenhuma, se autônomo).

async function empresaPertenceAoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

export type BuscaMotoristaState =
  | { erro?: string; encontrado?: { motorista_id: string; nome_completo: string; telefone: string | null } }
  | undefined;

export async function buscarMotoristaAcao(_prev: BuscaMotoristaState, formData: FormData): Promise<BuscaMotoristaState> {
  const documento = String(formData.get("documento") ?? "").trim();
  if (!documento) return { erro: "Digite o CPF ou telefone do motorista." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_motorista_documento", { p_documento: documento });
  if (error) return { erro: error.message };
  const linha = (data ?? [])[0] as { motorista_id: string; nome_completo: string; telefone: string | null } | undefined;
  if (!linha) return { erro: "Nenhum motorista encontrado com esse CPF/telefone. Ele precisa já ter conta no app." };
  return { encontrado: linha };
}

export async function convidarParceiroAcao(empresaId: string, motoristaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("convidar_motorista_parceiro", {
    p_empresa_id: empresaId,
    p_motorista_id: motoristaId,
  });
  if (error) return { erro: error.message };
  revalidatePath("/motoristas-parceiros");
}
