"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsearXmlNfe } from "@/lib/nfe";

// Fase Apuracao-ICMS-Combustivel (12/08/2026) — pedido do Daniel: "Criar aba
// de Apuração de crédito tributário sobre combustível [...] O regime
// tributario deve ser preenchido pelo cliente para o calculo da apuracao".
// Regime tributário e a autodeclaração de elegibilidade (ver comentário na
// migration) são preenchidos pelo PRÓPRIO cliente aqui — RLS de "empresas"
// (empresas_update_admin, que apesar do nome cobre qualquer membro da
// própria empresa) já permite o update direto, sem precisar de RPC nova.
export type RegimeFormState = { erro?: string; sucesso?: boolean } | undefined;

export async function atualizarRegimeTributarioAcao(
  empresaId: string,
  _prev: RegimeFormState,
  formData: FormData
): Promise<RegimeFormState> {
  const supabase = await createClient();

  const regime = String(formData.get("regime_tributario") ?? "");
  if (regime !== "simples_nacional" && regime !== "normal") {
    return { erro: "Selecione o regime tributário." };
  }
  // Checkbox só manda "on" quando marcado — ausente = false, nunca null
  // (null fica reservado pro estado inicial "ainda não confirmado").
  const elegivel = formData.get("elegivel_credito_icms_combustivel") === "on";

  const { error } = await supabase
    .from("empresas")
    .update({ regime_tributario: regime, elegivel_credito_icms_combustivel: elegivel })
    .eq("id", empresaId);

  if (error) {
    return { erro: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/apuracao-tributaria");
  return { sucesso: true };
}

export type ResultadoReprocessamento = {
  processadas: number;
  atualizadas: number;
  semDadoNoXml: number;
  erros: number;
};

// Fase Apuracao-ICMS-Combustivel — pedido do Daniel: "trazer uma sugestão
// para se aproximar ao máximo possível de uma entrega de uma apuração
// real". Sem isso, só NF-e enviadas DEPOIS desta fase entrariam na
// apuração — todo o histórico já vinculado ficaria de fora, mesmo tendo o
// XML original arquivado (xml_storage_path). Esta action baixa o XML já
// guardado no Storage de cada nota antiga (v_icms_mono_ret ainda null) e
// reprocessa com o parser novo — não refaz nenhuma validação de
// matching/tolerância (a nota já foi aceita quando chegou), só enriquece os
// campos fiscais que hoje estão vazios.
export async function reprocessarNotasAntigasAcao(empresaId: string): Promise<ResultadoReprocessamento> {
  const supabase = await createClient();
  const resultado: ResultadoReprocessamento = { processadas: 0, atualizadas: 0, semDadoNoXml: 0, erros: 0 };

  // Limite por execução — evita uma chamada única muito longa em empresas
  // com histórico grande; o cliente pode clicar de novo pra continuar (a
  // RPC só atualiza quem ainda está null, então repetir é seguro).
  const { data: notas } = await supabase
    .from("notas_fiscais_abastecimento")
    .select("id, chave_acesso, xml_storage_path")
    .eq("empresa_cliente_id", empresaId)
    .is("v_icms_mono_ret", null)
    .not("xml_storage_path", "is", null)
    .limit(200);

  for (const nota of notas ?? []) {
    resultado.processadas++;
    const { data: arquivo, error: erroDownload } = await supabase.storage
      .from("notas-fiscais-xml")
      .download(nota.xml_storage_path);
    if (erroDownload || !arquivo) {
      resultado.erros++;
      continue;
    }

    const texto = await arquivo.text();
    const parse = parsearXmlNfe(texto);
    if (!parse.ok || parse.nfe.chaveAcesso !== nota.chave_acesso) {
      resultado.erros++;
      continue;
    }
    if (parse.nfe.vIcmsMonoRet === undefined) {
      resultado.semDadoNoXml++;
      continue;
    }

    const { data: rpcResultado, error: erroRpc } = await supabase.rpc("atualizar_campos_fiscais_nota_fiscal", {
      p_nota_id: nota.id,
      p_chave_acesso: nota.chave_acesso,
      p_cst_icms: parse.nfe.cstIcms ?? null,
      p_cfop: parse.nfe.cfop ?? null,
      p_uf_emitente: parse.nfe.ufEmitente ?? null,
      p_uf_destinatario: parse.nfe.ufDestinatario ?? null,
      p_q_bc_mono_ret: parse.nfe.qBcMonoRet ?? null,
      p_ad_rem_icms_ret: parse.nfe.adRemIcmsRet ?? null,
      p_v_icms_mono_ret: parse.nfe.vIcmsMonoRet ?? null,
    });

    const ok = !erroRpc && (rpcResultado as { ok?: boolean } | null)?.ok;
    if (ok) {
      resultado.atualizadas++;
    } else {
      resultado.erros++;
    }
  }

  revalidatePath("/apuracao-tributaria");
  return resultado;
}
