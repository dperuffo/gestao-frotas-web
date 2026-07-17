"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enviarImagemBeneficio } from "@/lib/fidelidadeImagens";
import { CATEGORIAS_FIDELIDADE, eCategoriaFidelidadeValida, type CategoriaFidelidade } from "@/lib/fidelidadeCategorias";

// Parcerias Locais (Fase 17/07) — pedido do Daniel: posto e cliente criam e
// gerem seus PRÓPRIOS benefícios no catálogo "Estrada que Cuida" (vale-
// almoço, lavagem, treinamentos, telemedicina etc.), publicados direto pra
// rede toda, sem aprovação prévia do admin. Mesmo espírito de /fidelidade
// (catálogo global do admin), mas escopado por criador_empresa_id — RLS
// (fidelidade_catalogo_itens_dono_gerencia) já garante que só dá pra mexer
// em item cujo criador_empresa_id seja uma empresa do usuário; a checagem
// abaixo é só pra devolver mensagem amigável antes de bater na RLS (mesmo
// padrão de postos-duplicados/actions.ts).

export type ItemParceriaFormState = { erro?: string } | undefined;
export { CATEGORIAS_FIDELIDADE };

// Mesma regra da RLS (fidelidade_catalogo_itens_dono_gerencia +
// fidelidade_catalogo_itens_admin_escreve): dono da empresa, OU admin/
// superusuário (que já tem acesso irrestrito via política separada) — sem
// esse segundo caso, o admin veria "sem permissão" aqui mesmo a escrita
// passando na RLS de verdade.
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

export async function criarItemParceria(
  empresaId: string,
  _prev: ItemParceriaFormState,
  formData: FormData
): Promise<ItemParceriaFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para criar benefícios nesta empresa." };
  }

  const categoria = String(formData.get("categoria") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const parceiroNome = String(formData.get("parceiro_nome") ?? "").trim() || null;
  const pontosNecessarios = Number(formData.get("pontos_necessarios") ?? 0);
  const validadeDiasRaw = String(formData.get("validade_dias") ?? "").trim();
  const validadeDias = validadeDiasRaw ? Number(validadeDiasRaw) : null;
  const imagem = formData.get("imagem");

  if (!titulo || !categoria) return { erro: "Título e categoria são obrigatórios." };
  if (!eCategoriaFidelidadeValida(categoria)) return { erro: "Categoria inválida." };
  if (!Number.isFinite(pontosNecessarios) || pontosNecessarios <= 0) {
    return { erro: "Pontos necessários precisa ser um número maior que zero." };
  }
  if (validadeDiasRaw && (!Number.isFinite(validadeDias) || (validadeDias as number) <= 0)) {
    return { erro: "Validade em dias precisa ser maior que zero (ou deixe em branco pra sem validade)." };
  }

  let imagemUrl: string | null = null;
  if (imagem instanceof File && imagem.size > 0) {
    const resultado = await enviarImagemBeneficio(supabase, { empresaId, arquivo: imagem });
    if ("erro" in resultado) return { erro: resultado.erro };
    imagemUrl = resultado.url;
  }

  const { error } = await supabase.from("fidelidade_catalogo_itens").insert({
    categoria,
    titulo,
    descricao,
    parceiro_nome: parceiroNome,
    pontos_necessarios: pontosNecessarios,
    criador_empresa_id: empresaId,
    imagem_url: imagemUrl,
    validade_dias: validadeDias,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/parcerias-locais");
  redirect(`/parcerias-locais?empresa=${empresaId}`);
}

export async function atualizarItemParceria(
  id: string,
  empresaId: string,
  _prev: ItemParceriaFormState,
  formData: FormData
): Promise<ItemParceriaFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para editar este benefício." };
  }

  const categoria = String(formData.get("categoria") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const parceiroNome = String(formData.get("parceiro_nome") ?? "").trim() || null;
  const pontosNecessarios = Number(formData.get("pontos_necessarios") ?? 0);
  const validadeDiasRaw = String(formData.get("validade_dias") ?? "").trim();
  const validadeDias = validadeDiasRaw ? Number(validadeDiasRaw) : null;
  const ativo = formData.get("ativo") === "on";
  const imagem = formData.get("imagem");

  if (!titulo || !categoria) return { erro: "Título e categoria são obrigatórios." };
  if (!eCategoriaFidelidadeValida(categoria)) return { erro: "Categoria inválida." };
  if (!Number.isFinite(pontosNecessarios) || pontosNecessarios <= 0) {
    return { erro: "Pontos necessários precisa ser um número maior que zero." };
  }
  if (validadeDiasRaw && (!Number.isFinite(validadeDias) || (validadeDias as number) <= 0)) {
    return { erro: "Validade em dias precisa ser maior que zero (ou deixe em branco pra sem validade)." };
  }

  const linha: {
    categoria: CategoriaFidelidade;
    titulo: string;
    descricao: string | null;
    parceiro_nome: string | null;
    pontos_necessarios: number;
    validade_dias: number | null;
    ativo: boolean;
    atualizado_em: string;
    imagem_url?: string;
  } = {
    categoria,
    titulo,
    descricao,
    parceiro_nome: parceiroNome,
    pontos_necessarios: pontosNecessarios,
    validade_dias: validadeDias,
    ativo,
    atualizado_em: new Date().toISOString(),
  };

  if (imagem instanceof File && imagem.size > 0) {
    const resultado = await enviarImagemBeneficio(supabase, { empresaId, arquivo: imagem });
    if ("erro" in resultado) return { erro: resultado.erro };
    linha.imagem_url = resultado.url;
  }

  const { error } = await supabase.from("fidelidade_catalogo_itens").update(linha).eq("id", id);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/parcerias-locais");
  redirect(`/parcerias-locais?empresa=${empresaId}`);
}

export async function alternarAtivoItemParceria(id: string, empresaId: string, ativo: boolean) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fidelidade_catalogo_itens").update({ ativo, atualizado_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/parcerias-locais");
}

export async function excluirItemParceria(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fidelidade_catalogo_itens").delete().eq("id", id);
  revalidatePath("/parcerias-locais");
}

// Posto/cliente só avança/cancela o próprio atendimento do voucher — não
// devolve pra "solicitado" (esse estado inicial é só da RPC de resgate).
const STATUS_RESGATE_PROPRIO = ["em_andamento", "concluido", "cancelado"] as const;

export async function atualizarStatusResgateProprio(id: string, empresaId: string, status: string) {
  if (!(STATUS_RESGATE_PROPRIO as readonly string[]).includes(status)) return;
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase
    .from("fidelidade_resgates")
    .update({ status: status as (typeof STATUS_RESGATE_PROPRIO)[number], atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parcerias-locais");
}
