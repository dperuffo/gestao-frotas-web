"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — tabelas de frete: por
// cliente-tomador ou geral (cliente_tomador_id null), com faixas de peso
// (frete-peso) + componentes fixos (ad valorem/GRIS/TDE/TDA/despacho/
// pedágio/ICMS). Mesmo padrão de checagem redundante à RLS usado em
// /fretes/actions.ts (empresaPertenceAoUsuario).

export type TabelaFreteFormState = { erro?: string } | undefined;

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

export type FaixaInput = { pesoMinKg: number; pesoMaxKg: number | null; valorPorKg: number; valorMinimo: number };

function parsearFaixas(formData: FormData): FaixaInput[] {
  const raw = String(formData.get("faixas_json") ?? "[]");
  try {
    const lista = JSON.parse(raw);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((f) => ({
        pesoMinKg: Number(f?.pesoMinKg) || 0,
        pesoMaxKg: f?.pesoMaxKg === null || f?.pesoMaxKg === "" || f?.pesoMaxKg === undefined ? null : Number(f.pesoMaxKg),
        valorPorKg: Number(f?.valorPorKg) || 0,
        valorMinimo: Number(f?.valorMinimo) || 0,
      }))
      .filter((f) => f.valorPorKg > 0 || f.valorMinimo > 0);
  } catch {
    return [];
  }
}

function montarPayload(formData: FormData) {
  const campoTexto = (nome: string) => String(formData.get(nome) ?? "").trim() || null;
  const campoNumero = (nome: string) => {
    const raw = String(formData.get(nome) ?? "").trim();
    return raw ? Number(raw) : 0;
  };
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cliente_tomador_id: campoTexto("cliente_tomador_id"),
    uf_origem: campoTexto("uf_origem"),
    cidade_origem: campoTexto("cidade_origem"),
    uf_destino: campoTexto("uf_destino"),
    cidade_destino: campoTexto("cidade_destino"),
    percentual_ad_valorem: campoNumero("percentual_ad_valorem"),
    percentual_gris: campoNumero("percentual_gris"),
    valor_tde: campoNumero("valor_tde"),
    valor_tda: campoNumero("valor_tda"),
    valor_despacho: campoNumero("valor_despacho"),
    valor_pedagio: campoNumero("valor_pedagio"),
    percentual_icms: campoNumero("percentual_icms"),
  };
}

async function gravarFaixas(supabase: Awaited<ReturnType<typeof createClient>>, tabelaFreteId: string, faixas: FaixaInput[]) {
  await supabase.from("tabelas_frete_faixas").delete().eq("tabela_frete_id", tabelaFreteId);
  if (faixas.length === 0) return null;
  const { error } = await supabase.from("tabelas_frete_faixas").insert(
    faixas.map((f) => ({
      tabela_frete_id: tabelaFreteId,
      peso_min_kg: f.pesoMinKg,
      peso_max_kg: f.pesoMaxKg,
      valor_por_kg: f.valorPorKg,
      valor_minimo: f.valorMinimo,
    }))
  );
  return error;
}

export async function criarTabelaFrete(empresaId: string, _prev: TabelaFreteFormState, formData: FormData): Promise<TabelaFreteFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para criar tabelas de frete nesta empresa." };
  }

  const payload = montarPayload(formData);
  if (!payload.nome) return { erro: "O nome da tabela é obrigatório." };

  const faixas = parsearFaixas(formData);
  if (faixas.length === 0) return { erro: "Cadastre pelo menos uma faixa de peso." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("tabelas_frete")
    .insert({ ...payload, empresa_id: empresaId, criado_por: user?.email ?? null })
    .select("id")
    .single();
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  const erroFaixas = await gravarFaixas(supabase, data.id, faixas);
  if (erroFaixas) return { erro: `Tabela criada, mas houve erro ao salvar as faixas: ${erroFaixas.message}` };

  revalidatePath("/tabelas-frete");
  redirect(`/tabelas-frete?empresa=${empresaId}`);
}

export async function atualizarTabelaFrete(
  id: string,
  empresaId: string,
  _prev: TabelaFreteFormState,
  formData: FormData
): Promise<TabelaFreteFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Sem permissão." };
  }

  const payload = montarPayload(formData);
  if (!payload.nome) return { erro: "O nome da tabela é obrigatório." };

  const faixas = parsearFaixas(formData);
  if (faixas.length === 0) return { erro: "Cadastre pelo menos uma faixa de peso." };

  const { error } = await supabase
    .from("tabelas_frete")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  const erroFaixas = await gravarFaixas(supabase, id, faixas);
  if (erroFaixas) return { erro: `Erro ao salvar as faixas: ${erroFaixas.message}` };

  revalidatePath("/tabelas-frete");
  revalidatePath(`/tabelas-frete/${id}`);
  redirect(`/tabelas-frete?empresa=${empresaId}`);
}

export async function alternarAtivoTabelaFrete(id: string, empresaId: string, ativo: boolean) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("tabelas_frete").update({ ativo, atualizado_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/tabelas-frete");
}

export async function excluirTabelaFrete(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("tabelas_frete").delete().eq("id", id);
  revalidatePath("/tabelas-frete");
}
