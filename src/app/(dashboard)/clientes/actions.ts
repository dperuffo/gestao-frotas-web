"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CICLOS_COMBUSTIVEL } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type EmpresaUpdate = Database["public"]["Tables"]["empresas"]["Update"];

export type ClienteFormState = { erro?: string } | undefined;

function montarVolumePotencial(formData: FormData): Record<string, number> {
  const volume: Record<string, number> = {};
  for (const { key } of CICLOS_COMBUSTIVEL) {
    const raw = formData.get(`volume_${key}`);
    const n = raw ? Number(raw) : 0;
    volume[key] = Number.isFinite(n) ? n : 0;
  }
  return volume;
}

function montarPayload(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim() || null,
    status: String(formData.get("status") ?? "trial"),
    porte: String(formData.get("porte") ?? "") || null,
    segmento_transporte: String(formData.get("segmento_transporte") ?? "") || null,
    logradouro: String(formData.get("logradouro") ?? "") || null,
    numero: String(formData.get("numero") ?? "") || null,
    complemento: String(formData.get("complemento") ?? "") || null,
    bairro: String(formData.get("bairro") ?? "") || null,
    municipio: String(formData.get("municipio") ?? "") || null,
    uf: String(formData.get("uf") ?? "") || null,
    cep: String(formData.get("cep") ?? "") || null,
    telefone_contato: String(formData.get("telefone_contato") ?? "") || null,
    email_contato: String(formData.get("email_contato") ?? "") || null,
    volume_potencial: montarVolumePotencial(formData),
  };
}

export async function criarCliente(_prev: ClienteFormState, formData: FormData): Promise<ClienteFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);

  if (!payload.nome) {
    return { erro: "Razão Social é obrigatória." };
  }

  const { data, error } = await supabase.from("empresas").insert(payload).select("id").single();

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function atualizarCliente(
  id: string,
  _prev: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const supabase = await createClient();
  const payload: EmpresaUpdate = montarPayload(formData);

  if (!payload.nome) {
    return { erro: "Razão Social é obrigatória." };
  }

  // Fase 27.42 — o checkbox de bypass de limite de frota só é gravado se
  // quem está chamando é admin — mesma checagem que já esconde o campo na
  // tela (ClienteForm), repetida aqui pra não confiar só na UI: mesmo que
  // alguém monte o FormData na mão, um não-admin não consegue ligar isso
  // pra própria empresa.
  const { data: perfilAtual } = await supabase.rpc("perfil_usuario_atual");
  if (perfilAtual === "admin") {
    payload.bypass_limite_frota = formData.get("bypass_limite_frota") === "on";
  }

  const { error } = await supabase.from("empresas").update(payload).eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { erro: undefined };
}

export async function alternarAtivoCliente(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("empresas")
    .update({ status: ativo ? "ativo" : "suspenso" })
    .eq("id", id);
  revalidatePath("/clientes");
}

// Conta acessos de clientes ainda não vistos pelo admin — usada pelo badge
// de notificação no menu lateral (layout.tsx). Mesmo padrão de
// contarAvaliacoesPendentesAcao/contarChamadosNaoVistosAcao: só retorna
// algo pra admin (RLS já bloqueia não-admin de enxergar essa tabela, mas
// evitamos a chamada à toa).
export async function contarAcessosClientesNaoVistosAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") return 0;

  const { count } = await supabase
    .from("acessos_clientes")
    .select("id", { count: "exact", head: true })
    .is("admin_visto_em", null);

  return count ?? 0;
}

// Marca todos os acessos pendentes como vistos — chamada quando o admin
// abre a tela /clientes (mesma ideia de "marcar como visto ao abrir a
// página" já usada em chamados/[id]/page.tsx).
export async function marcarAcessosClientesVistosAcao(): Promise<void> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") return;

  await supabase.from("acessos_clientes").update({ admin_visto_em: new Date().toISOString() }).is("admin_visto_em", null);
  revalidatePath("/clientes");
}
