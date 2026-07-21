"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

// Fase 27.15x — "Regras Antifraude": o cliente cadastra regras (com
// vigência) que um sistema externo (bandeira de cartão, posto, gateway de
// pagamento) consulta ANTES de autorizar um abastecimento, via
// POST /api/integracoes/antifraude/verificar. Mesmo padrão estrutural de
// /parametros-uso (Fase 27.120), com uma diferença: aqui os tipos de regra
// (limite_valor_quantidade, janela_tempo_frequencia) moram todos na MESMA
// tabela (regras_antifraude, condições em jsonb), em vez de uma tabela por
// tipo — são poucos campos por tipo, não compensa criar tabelas separadas.
//
// Fase Antifraude→Ações-Sugeridas — o tipo "localizacao_posto" que existia
// aqui foi migrado pra Ações Sugeridas (tipo "posto_nao_autorizado", ver
// /acoes-sugeridas/actions.ts). Removido de eTipoValido/montarCondicoes pra
// não aceitar mais criação/edição desse tipo por aqui; linhas antigas desse
// tipo continuam no banco (não migradas/removidas), só não são mais
// acessíveis por esta tela.

export type RegraAntifraudeFormState = { erro?: string } | undefined;

type TipoRegraAntifraude = "limite_valor_quantidade" | "janela_tempo_frequencia";
type EscopoRegraAntifraude = "motorista" | "veiculo" | "empresa";

function eTipoValido(v: string): v is TipoRegraAntifraude {
  return v === "limite_valor_quantidade" || v === "janela_tempo_frequencia";
}
function eEscopoValido(v: string): v is EscopoRegraAntifraude {
  return v === "motorista" || v === "veiculo" || v === "empresa";
}

function numeroOuIndefinido(valor: FormDataEntryValue | null): number | undefined {
  const v = String(valor ?? "").trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function textoOuIndefinido(valor: FormDataEntryValue | null): string | undefined {
  const v = String(valor ?? "").trim();
  return v || undefined;
}

// Monta o jsonb de `condicoes` só com os campos preenchidos do tipo
// selecionado — os campos de outras abas do formulário (outros tipos) são
// ignorados mesmo que venham no FormData.
function montarCondicoes(formData: FormData, tipo: string): Record<string, Json> {
  if (tipo === "limite_valor_quantidade") {
    const condicoes: Record<string, Json> = {};
    const litrosMaxDia = numeroOuIndefinido(formData.get("litros_max_dia"));
    const valorMaxAbastecimento = numeroOuIndefinido(formData.get("valor_max_abastecimento"));
    if (litrosMaxDia !== undefined) condicoes.litros_max_dia = litrosMaxDia;
    if (valorMaxAbastecimento !== undefined) condicoes.valor_max_abastecimento = valorMaxAbastecimento;
    return condicoes;
  }

  // janela_tempo_frequencia
  const condicoes: Record<string, Json> = {};
  const intervaloMinimoHoras = numeroOuIndefinido(formData.get("intervalo_minimo_horas"));
  const horaInicio = textoOuIndefinido(formData.get("horario_inicio"));
  const horaFim = textoOuIndefinido(formData.get("horario_fim"));
  if (intervaloMinimoHoras !== undefined) condicoes.intervalo_minimo_horas = intervaloMinimoHoras;
  if (horaInicio || horaFim) condicoes.horario_permitido = { inicio: horaInicio ?? null, fim: horaFim ?? null };
  return condicoes;
}

function montarPayloadBase(formData: FormData) {
  const escopo = String(formData.get("escopo") ?? "");
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? ""),
    escopo,
    escopo_referencia: escopo === "empresa" ? null : String(formData.get("escopo_referencia") ?? "").trim() || null,
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? "") || null,
    vigencia_fim: String(formData.get("vigencia_fim") ?? "") || null,
  };
}

export async function criarRegraAntifraude(
  _prev: RegraAntifraudeFormState,
  formData: FormData
): Promise<RegraAntifraudeFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const base = montarPayloadBase(formData);
  const condicoes = montarCondicoes(formData, base.tipo);

  if (!base.nome || !base.tipo || !base.escopo || !empresaId) {
    return { erro: "Nome, tipo, escopo e cliente são obrigatórios." };
  }
  if (!eTipoValido(base.tipo) || !eEscopoValido(base.escopo)) {
    return { erro: "Tipo ou escopo inválido." };
  }
  if (base.escopo !== "empresa" && !base.escopo_referencia) {
    return { erro: "Selecione o motorista ou o veículo ao qual a regra se aplica." };
  }
  if (Object.keys(condicoes).length === 0) {
    return { erro: "Preencha ao menos uma condição da regra." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("regras_antifraude").insert({
    nome: base.nome,
    tipo: base.tipo,
    escopo: base.escopo,
    escopo_referencia: base.escopo_referencia,
    vigencia_inicio: base.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
    vigencia_fim: base.vigencia_fim,
    condicoes: condicoes as Json,
    empresa_id: empresaId,
    status: "Ativo",
    criado_por: user?.email ?? null,
  });

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/antifraude");
  redirect("/antifraude");
}

export async function atualizarRegraAntifraude(
  id: string,
  _prev: RegraAntifraudeFormState,
  formData: FormData
): Promise<RegraAntifraudeFormState> {
  const supabase = await createClient();
  const base = montarPayloadBase(formData);
  const condicoes = montarCondicoes(formData, base.tipo);
  const status = formData.get("ativo") === "on" ? "Ativo" : "Inativo";

  if (!base.nome || !base.tipo || !base.escopo) {
    return { erro: "Nome, tipo e escopo são obrigatórios." };
  }
  if (!eTipoValido(base.tipo) || !eEscopoValido(base.escopo)) {
    return { erro: "Tipo ou escopo inválido." };
  }
  if (base.escopo !== "empresa" && !base.escopo_referencia) {
    return { erro: "Selecione o motorista ou o veículo ao qual a regra se aplica." };
  }
  if (Object.keys(condicoes).length === 0) {
    return { erro: "Preencha ao menos uma condição da regra." };
  }

  const { error } = await supabase
    .from("regras_antifraude")
    .update({
      nome: base.nome,
      tipo: base.tipo,
      escopo: base.escopo,
      escopo_referencia: base.escopo_referencia,
      vigencia_inicio: base.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
      vigencia_fim: base.vigencia_fim,
      condicoes: condicoes as Json,
      status,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/antifraude");
  redirect("/antifraude");
}

export async function alternarStatusRegraAntifraude(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("regras_antifraude")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/antifraude");
}

export async function excluirRegraAntifraude(id: string) {
  const supabase = await createClient();
  await supabase.from("regras_antifraude").delete().eq("id", id);
  revalidatePath("/antifraude");
}

// Bolinha de notificação no menu (mesmo padrão da Fase 27.150, ver
// contarDocumentosPendentesAcao) — conta falhas de verificação antifraude
// (fail-open) ainda não lidas. Confia na RLS de antifraude_verificacoes_falhas
// pra escopar por empresa automaticamente, sem precisar resolver empresa_id
// aqui.
export async function contarFalhasVerificacaoAntifraudeAcao(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("antifraude_verificacoes_falhas")
    .select("id", { count: "exact", head: true })
    .is("lida_em", null);

  return count ?? 0;
}

export async function marcarFalhasAntifraudeComoLidasAcao(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("antifraude_verificacoes_falhas").update({ lida_em: new Date().toISOString() }).is("lida_em", null);
  revalidatePath("/antifraude");
}
