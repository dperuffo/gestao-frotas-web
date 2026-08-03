"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Grupo 2 (Rodopar/Datapar, item 6, 03/08/2026) — Patrimônio formal:
// depreciação contábil (linha reta) + correções do ativo (reavaliação,
// melhoria, baixa). Ver patrimonio_veiculo/patrimonio_frota_resumo e a
// tabela patrimonio_ajustes (migração patrimonio_formal_ajustes_e_funcoes).

export type PatrimonioFormState = { erro?: string } | undefined;

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

const TIPOS_VALIDOS = ["reavaliacao", "melhoria", "baixa"] as const;

export async function criarAjusteAcao(
  veiculoId: string,
  placa: string,
  empresaId: string,
  _prev: PatrimonioFormState,
  formData: FormData
): Promise<PatrimonioFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  if (!(TIPOS_VALIDOS as readonly string[]).includes(tipoRaw)) return { erro: "Escolha o tipo de ajuste." };
  const tipo = tipoRaw as (typeof TIPOS_VALIDOS)[number];

  const valorTexto = String(formData.get("valor") ?? "").trim();
  const valor = Number(valorTexto);
  if (!valorTexto || !Number.isFinite(valor)) return { erro: "Informe um valor válido." };
  if (tipo !== "reavaliacao" && valor < 0) return { erro: "Valor não pode ser negativo para esse tipo de ajuste." };

  const dataAjuste = String(formData.get("data_ajuste") ?? "").trim();
  if (!dataAjuste) return { erro: "Informe a data do ajuste." };

  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("patrimonio_ajustes").insert({
    empresa_id: empresaId,
    veiculo_id: veiculoId,
    tipo,
    valor,
    data_ajuste: dataAjuste,
    motivo,
    criado_por: user?.id ?? null,
  });

  if (error) return { erro: `Não foi possível registrar o ajuste: ${error.message}` };

  revalidatePath(`/patrimonio/${placa}`);
  revalidatePath("/patrimonio");
  return undefined;
}

export async function excluirAjusteAcao(ajusteId: string, placa: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  await supabase.from("patrimonio_ajustes").delete().eq("id", ajusteId).eq("empresa_id", empresaId);
  revalidatePath(`/patrimonio/${placa}`);
  revalidatePath("/patrimonio");
}
