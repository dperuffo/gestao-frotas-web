"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase 27.140 — pedido do Daniel: "Parâmetros de NF" — regras de emissão de
// nota fiscal configuradas pelo cliente frotista (por CNPJ da frota, ou uma
// regra padrão pra todos), consultáveis por ERPs e software de automação de
// posto via API (ver src/app/api/integracoes/parametros-nf/route.ts). Mesmo
// padrão de schema/ação/tela/API de /parametros-uso (Fase 27.120/27.121).

export type RegraNFFormState = { erro?: string } | undefined;

function textoOuNull(formData: FormData, campo: string): string | null {
  const v = String(formData.get(campo) ?? "").trim();
  return v || null;
}

export async function criarParametroNF(_prev: RegraNFFormState, formData: FormData): Promise<RegraNFFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Cliente é obrigatório." };

  const localDestino = String(formData.get("local_destino") ?? "Empresa em que o veículo está cadastrado");
  const cnpjPersonalizado = textoOuNull(formData, "cnpj_destino_personalizado");
  if (localDestino.startsWith("Personalizado") && !cnpjPersonalizado) {
    return { erro: "Informe o CNPJ de destino para o tipo de destino personalizado escolhido." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("parametros_nota_fiscal").insert({
    empresa_id: empresaId,
    cnpj_frota: textoOuNull(formData, "cnpj_frota"),
    exige_nota_fiscal: String(formData.get("exige_nota_fiscal") ?? "Sem preferência") as
      | "Sim"
      | "Não"
      | "Sem preferência",
    separar_nf_combustivel: String(formData.get("separar_nf_combustivel") ?? "Sem preferência") as
      | "Sim"
      | "Não"
      | "Sem preferência",
    forma_emissao: String(formData.get("forma_emissao") ?? "Nota no ato do abastecimento") as
      | "Nota única por abastecimento"
      | "Nota aglomerada com mais de um abastecimento"
      | "Nota no ato do abastecimento",
    local_destino: localDestino as
      | "Matriz"
      | "Empresa em que o veículo está cadastrado"
      | "Personalizado CNPJ por Posto"
      | "Personalizado CNPJ por Estado"
      | "Personalizado CNPJ por Abastecimento",
    cnpj_destino_personalizado: localDestino.startsWith("Personalizado") ? cnpjPersonalizado : null,
    dados_adicionais: textoOuNull(formData, "dados_adicionais"),
    observacao: textoOuNull(formData, "observacao"),
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-nf");
}

export async function alternarStatusParametroNF(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase
    .from("parametros_nota_fiscal")
    .update({ status: ativo ? "Ativo" : "Inativo", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/parametros-nf");
}

export async function excluirParametroNF(id: string) {
  const supabase = await createClient();
  await supabase.from("parametros_nota_fiscal").delete().eq("id", id);
  revalidatePath("/parametros-nf");
}
