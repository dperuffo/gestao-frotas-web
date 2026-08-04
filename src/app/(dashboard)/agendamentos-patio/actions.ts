"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase agendamento-patio (04/08/2026, item 8 do benchmark FNI vs KMM,
// Grupo 2) — YMS leve: agenda de janelas de carga (coleta) e descarga
// (entrega) por frete. Não duplica controle de chegada/saída: o status
// "em_andamento"/"concluido" é preenchido sozinho pela RPC
// registrar_evento_frete quando o motorista bate os checkpoints que já
// existem (chegou_origem/saiu_origem/chegou_destino/concluido). Aqui só
// tratamos a parte de AGENDAR (criar janela, evitar conflito de doca,
// confirmar, cancelar, reagendar).

export type AgendamentoPatioState = { erro?: string; ok?: boolean } | undefined;

function paraTimestamp(valor: FormDataEntryValue | null): string | null {
  // input type="datetime-local" manda "2026-08-10T14:30" (hora local do
  // navegador, sem fuso) — o Postgres trata como o horário local do
  // servidor se mandarmos sem sufixo, então convertê-lo é desnecessário
  // pra um MVP: guardamos exatamente essa string, sem componente de fuso
  // (mesma limitação simples de coleta_data/coleta_hora em fretes).
  const texto = String(valor ?? "").trim();
  return texto || null;
}

async function existeConflitoDeDoca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  doca: string,
  janelaInicio: string,
  janelaFim: string,
  ignorarId?: string
): Promise<string | null> {
  let query = supabase
    .from("agendamentos_patio")
    .select("id, local_label, janela_inicio, janela_fim, fretes(titulo)")
    .eq("empresa_id", empresaId)
    .eq("doca", doca)
    .neq("status", "cancelado")
    .lt("janela_inicio", janelaFim)
    .gt("janela_fim", janelaInicio);

  if (ignorarId) query = query.neq("id", ignorarId);

  const { data } = await query.limit(1);
  const conflito = data?.[0] as { fretes: { titulo: string } | null; janela_inicio: string } | undefined;
  if (!conflito) return null;

  const horario = new Date(conflito.janela_inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `A doca "${doca}" já tem um agendamento às ${horario} (frete "${conflito.fretes?.titulo ?? "sem título"}"). Escolha outro horário ou outra doca.`;
}

export async function criarAgendamentoAcao(
  freteId: string,
  empresaId: string,
  tipo: "coleta" | "entrega",
  localLabelPadrao: string,
  _prev: AgendamentoPatioState,
  formData: FormData
): Promise<AgendamentoPatioState> {
  const supabase = await createClient();

  const janelaInicio = paraTimestamp(formData.get("janela_inicio"));
  const janelaFim = paraTimestamp(formData.get("janela_fim"));
  const doca = String(formData.get("doca") ?? "").trim() || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  const localLabel = String(formData.get("local_label") ?? "").trim() || localLabelPadrao;

  if (!janelaInicio || !janelaFim) return { erro: "Informe o início e o fim da janela." };
  if (new Date(janelaFim) <= new Date(janelaInicio)) return { erro: "O fim da janela precisa ser depois do início." };

  if (doca) {
    const conflito = await existeConflitoDeDoca(supabase, empresaId, doca, janelaInicio, janelaFim);
    if (conflito) return { erro: conflito };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("agendamentos_patio").insert({
    empresa_id: empresaId,
    frete_id: freteId,
    tipo,
    local_label: localLabel,
    doca,
    janela_inicio: janelaInicio,
    janela_fim: janelaFim,
    observacoes,
    criado_por: user?.email ?? null,
  });

  if (error) {
    if (error.code === "23505") return { erro: `Esse frete já tem um agendamento de ${tipo === "coleta" ? "carga" : "descarga"}. Cancele o atual antes de criar outro.` };
    return { erro: `Não foi possível agendar: ${error.message}` };
  }

  revalidatePath(`/fretes/${freteId}`);
  revalidatePath("/agendamentos-patio");
  return { ok: true };
}

export async function reagendarAcao(
  id: string,
  freteId: string,
  empresaId: string,
  _prev: AgendamentoPatioState,
  formData: FormData
): Promise<AgendamentoPatioState> {
  const supabase = await createClient();

  const janelaInicio = paraTimestamp(formData.get("janela_inicio"));
  const janelaFim = paraTimestamp(formData.get("janela_fim"));
  const doca = String(formData.get("doca") ?? "").trim() || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (!janelaInicio || !janelaFim) return { erro: "Informe o início e o fim da janela." };
  if (new Date(janelaFim) <= new Date(janelaInicio)) return { erro: "O fim da janela precisa ser depois do início." };

  if (doca) {
    const conflito = await existeConflitoDeDoca(supabase, empresaId, doca, janelaInicio, janelaFim, id);
    if (conflito) return { erro: conflito };
  }

  const { error } = await supabase
    .from("agendamentos_patio")
    .update({
      janela_inicio: janelaInicio,
      janela_fim: janelaFim,
      doca,
      observacoes,
      status: "agendado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { erro: `Não foi possível reagendar: ${error.message}` };

  revalidatePath(`/fretes/${freteId}`);
  revalidatePath("/agendamentos-patio");
  return { ok: true };
}

export async function confirmarAgendamentoAcao(id: string, freteId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos_patio")
    .update({ status: "confirmado", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "agendado");
  if (error) throw new Error(error.message);
  revalidatePath(`/fretes/${freteId}`);
  revalidatePath("/agendamentos-patio");
}

export async function cancelarAgendamentoAcao(id: string, freteId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos_patio")
    .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/fretes/${freteId}`);
  revalidatePath("/agendamentos-patio");
}
