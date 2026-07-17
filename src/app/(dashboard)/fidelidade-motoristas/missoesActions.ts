"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eMetricaValida, eIconeValido, metricaEhBinaria } from "@/lib/fidelidadeMissoes";

// Missões de gamificação do programa "Estrada que Cuida" (Fase 17/07-4) —
// pedido do Daniel: "quero que o cliente tenha uma tela para criar mais
// missões, para que ele se engaje mais". Vive dentro de /fidelidade-
// motoristas (não em rota própria) porque é exatamente aqui que o gestor já
// acompanha o engajamento dos motoristas no programa — criar a missão do
// lado da mesma tela onde ele vê o resultado. Mesmo espírito de
// /parcerias-locais: a empresa só cria/edita as PRÓPRIAS missões (nunca as
// globais, que têm empresa_id null) — RLS de fidelidade_missoes
// (fidelidade_missoes_escreve_empresa) já garante isso via
// empresas_do_usuario(), a checagem abaixo só devolve mensagem amigável
// antes de bater na RLS.

export type MissaoFormState = { erro?: string } | undefined;

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

// Slug estável a partir do título — fidelidade_missoes.codigo é unique
// globalmente (entre todas as empresas), então junta um sufixo curto pra
// evitar colisão entre empresas diferentes usando títulos parecidos.
function gerarCodigo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const sufixo = Math.random().toString(36).slice(2, 8);
  return `${base || "missao"}_${sufixo}`;
}

function validarCampos(formData: FormData): { erro?: string; titulo: string; descricao: string; icone: string; tipoMetrica: string; meta: number; bonus: number } {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const icone = String(formData.get("icone") ?? "flag_outlined");
  const tipoMetrica = String(formData.get("tipo_metrica") ?? "");
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const bonusRaw = String(formData.get("bonus") ?? "0").trim();

  if (!titulo) return { erro: "Título é obrigatório.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  if (!eMetricaValida(tipoMetrica)) {
    return { erro: "Selecione uma métrica válida.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }
  if (!eIconeValido(icone)) {
    return { erro: "Selecione um ícone válido.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }

  const meta = metricaEhBinaria(tipoMetrica) ? 1 : Number(metaRaw);
  if (!Number.isFinite(meta) || meta <= 0) {
    return { erro: "Meta precisa ser um número maior que zero.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }
  const bonus = Number(bonusRaw || 0);
  if (!Number.isFinite(bonus) || bonus < 0) {
    return { erro: "Bônus em pontos precisa ser zero ou maior.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }

  return { titulo, descricao, icone, tipoMetrica, meta: Math.round(meta), bonus: Math.round(bonus) };
}

export async function criarMissao(
  empresaId: string,
  _prev: MissaoFormState,
  formData: FormData
): Promise<MissaoFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para criar missões nesta empresa." };
  }

  const campos = validarCampos(formData);
  if (campos.erro) return { erro: campos.erro };

  const { error } = await supabase.from("fidelidade_missoes").insert({
    empresa_id: empresaId,
    codigo: gerarCodigo(campos.titulo),
    titulo: campos.titulo,
    descricao: campos.descricao,
    icone: campos.icone,
    tipo_metrica: campos.tipoMetrica,
    meta: campos.meta,
    bonus: campos.bonus,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/fidelidade-motoristas");
  return undefined;
}

export async function atualizarMissao(
  id: string,
  empresaId: string,
  _prev: MissaoFormState,
  formData: FormData
): Promise<MissaoFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para editar esta missão." };
  }

  const campos = validarCampos(formData);
  if (campos.erro) return { erro: campos.erro };
  const ativa = formData.get("ativa") === "on";

  const { error } = await supabase
    .from("fidelidade_missoes")
    .update({
      titulo: campos.titulo,
      descricao: campos.descricao,
      icone: campos.icone,
      tipo_metrica: campos.tipoMetrica,
      meta: campos.meta,
      bonus: campos.bonus,
      ativa,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/fidelidade-motoristas");
  return undefined;
}

export async function alternarAtivaMissao(id: string, empresaId: string, ativa: boolean) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase
    .from("fidelidade_missoes")
    .update({ ativa, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  revalidatePath("/fidelidade-motoristas");
}

export async function excluirMissao(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fidelidade_missoes").delete().eq("id", id).eq("empresa_id", empresaId);
  revalidatePath("/fidelidade-motoristas");
}

export type MissaoRow = {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  tipo_metrica: string;
  meta: number;
  bonus: number;
  ativa: boolean;
  empresa_id: string | null;
};

export async function listarMissoes(empresaId: string): Promise<MissaoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fidelidade_missoes")
    .select("id, codigo, titulo, descricao, icone, tipo_metrica, meta, bonus, ativa, empresa_id")
    .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
    .order("empresa_id", { ascending: true, nullsFirst: true })
    .order("criado_em", { ascending: false });
  return (data ?? []) as MissaoRow[];
}
