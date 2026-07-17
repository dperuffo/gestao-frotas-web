"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Catálogo de resgate do programa "Estrada que Cuida" (app do motorista) —
// v1 simulado: sem parceiros reais, sem pagamento/entrega de verdade.
// Admin cadastra os itens aqui; motorista resgata gastando pontos (RPC
// resgatar_item_catalogo, ver migração criar_rpc_resgatar_item_catalogo);
// o "cumprimento" do resgate (entregar o benefício de fato) é manual —
// esta tela também serve pra acompanhar/atualizar o status de cada pedido.
// Tela é admin-only — RLS de fidelidade_catalogo_itens e fidelidade_resgates
// já restringe escrita a perfil_usuario_atual() = 'admin', então não repito
// a checagem aqui (mesmo padrão de postos-duplicados/actions.ts).

export type ItemCatalogoFormState = { erro?: string } | undefined;

const CATEGORIAS = [
  "economia_imediata",
  "marketplace_cabine",
  "saude_estrada",
  "universidade_estrada",
  "clube_caminhao",
  "volte_para_casa",
] as const;
type Categoria = (typeof CATEGORIAS)[number];

function eCategoriaValida(v: string): v is Categoria {
  return (CATEGORIAS as readonly string[]).includes(v);
}

export async function criarItemCatalogo(
  _prev: ItemCatalogoFormState,
  formData: FormData
): Promise<ItemCatalogoFormState> {
  const supabase = await createClient();
  const categoria = String(formData.get("categoria") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const parceiroNome = String(formData.get("parceiro_nome") ?? "").trim() || null;
  const pontosNecessarios = Number(formData.get("pontos_necessarios") ?? 0);

  if (!titulo || !categoria) {
    return { erro: "Título e categoria são obrigatórios." };
  }
  if (!eCategoriaValida(categoria)) {
    return { erro: "Categoria inválida." };
  }
  if (!Number.isFinite(pontosNecessarios) || pontosNecessarios <= 0) {
    return { erro: "Pontos necessários precisa ser um número maior que zero." };
  }

  const { error } = await supabase.from("fidelidade_catalogo_itens").insert({
    categoria,
    titulo,
    descricao,
    parceiro_nome: parceiroNome,
    pontos_necessarios: pontosNecessarios,
  });

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/fidelidade");
  redirect("/fidelidade");
}

export async function atualizarItemCatalogo(
  id: string,
  _prev: ItemCatalogoFormState,
  formData: FormData
): Promise<ItemCatalogoFormState> {
  const supabase = await createClient();
  const categoria = String(formData.get("categoria") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const parceiroNome = String(formData.get("parceiro_nome") ?? "").trim() || null;
  const pontosNecessarios = Number(formData.get("pontos_necessarios") ?? 0);
  const ativo = formData.get("ativo") === "on";

  if (!titulo || !categoria) {
    return { erro: "Título e categoria são obrigatórios." };
  }
  if (!eCategoriaValida(categoria)) {
    return { erro: "Categoria inválida." };
  }
  if (!Number.isFinite(pontosNecessarios) || pontosNecessarios <= 0) {
    return { erro: "Pontos necessários precisa ser um número maior que zero." };
  }

  const { error } = await supabase
    .from("fidelidade_catalogo_itens")
    .update({
      categoria,
      titulo,
      descricao,
      parceiro_nome: parceiroNome,
      pontos_necessarios: pontosNecessarios,
      ativo,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/fidelidade");
  redirect("/fidelidade");
}

export async function alternarAtivoItemCatalogo(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("fidelidade_catalogo_itens")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/fidelidade");
}

export async function excluirItemCatalogo(id: string) {
  const supabase = await createClient();
  await supabase.from("fidelidade_catalogo_itens").delete().eq("id", id);
  revalidatePath("/fidelidade");
}

const STATUS_RESGATE = ["solicitado", "em_andamento", "concluido", "cancelado"] as const;

export async function atualizarStatusResgate(id: string, status: string) {
  if (!(STATUS_RESGATE as readonly string[]).includes(status)) return;
  const supabase = await createClient();
  await supabase
    .from("fidelidade_resgates")
    .update({ status: status as (typeof STATUS_RESGATE)[number], atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/fidelidade/resgates");
}
