"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LgpdFormState = { erro?: string; sucesso?: string } | undefined;

async function ipDoRequest(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

// Registra a revogação de consentimento — LGPD art. 8º §5º: o titular pode
// revogar o consentimento a qualquer momento, de forma gratuita e
// facilitada. É só um registro de auditoria (append-only, sem update/delete
// — ver policies da Fase 27.13): não apaga nada nem encerra a conta sozinho,
// porque o tratamento continua necessário à execução do contrato (art. 7º,
// V) enquanto a assinatura estiver ativa. Quem quiser sair de vez da base
// usa "Solicitar exclusão dos meus dados" abaixo.
export async function registrarRevogacaoConsentimento(): Promise<LgpdFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const h = await headers();
  const { error } = await supabase.from("lgpd_consents").insert({
    email: user.email,
    tipo: "revogacao",
    ip: await ipDoRequest(),
    user_agent: h.get("user-agent"),
  });
  if (error) return { erro: `Não foi possível registrar a revogação: ${error.message}` };

  revalidatePath("/lgpd");
  return { sucesso: "Revogação de consentimento registrada com sucesso." };
}

// Solicitação de exclusão de dados (direito ao esquecimento, LGPD art. 18,
// VI). Fica com status "pendente" até um admin da FNI revisar e executar —
// deliberadamente não é uma exclusão automática/instantânea: um SaaS
// multi-tenant de frotas tem obrigações contratuais e legais de retenção
// (nota fiscal, faturamento, prazo mínimo de guarda de logs) que precisam
// ser conferidas antes de apagar qualquer coisa, e um clique indevido não
// pode apagar dados de um cliente inteiro sem revisão humana.
export async function solicitarExclusaoDados(_prev: LgpdFormState, formData: FormData): Promise<LgpdFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!empresaId) return { erro: "Selecione o cliente ao qual a solicitação se refere." };

  const { data: pendente } = await supabase
    .from("lgpd_exclusoes")
    .select("id")
    .eq("email", user.email)
    .eq("empresa_id", empresaId)
    .eq("status", "pendente")
    .maybeSingle();
  if (pendente) return { erro: "Já existe uma solicitação pendente para este cliente — aguarde a análise da equipe FNI." };

  const { error } = await supabase.from("lgpd_exclusoes").insert({
    empresa_id: empresaId,
    email: user.email,
    status: "pendente",
  });
  if (error) return { erro: `Não foi possível registrar a solicitação: ${error.message}` };

  revalidatePath("/lgpd");
  return { sucesso: "Solicitação de exclusão registrada. A equipe FNI vai analisar e retornar por e-mail." };
}

// Só o admin consegue de fato marcar como executada — o botão na tela já só
// aparece pro admin, mas quem garante isso de verdade é a RLS
// (lgpd_exclusoes_update_admin, Fase 27.13): um usuário comum que tentasse
// chamar essa action diretamente receberia erro de permissão do Postgres.
export async function marcarExclusaoExecutada(id: string): Promise<LgpdFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lgpd_exclusoes")
    .update({ status: "executado", executado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: `Não foi possível atualizar a solicitação: ${error.message}` };

  revalidatePath("/lgpd");
  return { sucesso: "Solicitação marcada como executada." };
}
