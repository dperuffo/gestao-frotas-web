"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsearXmlNfeCarga, type NfeCargaExtraida } from "@/lib/nfeCarga";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase P0.4 (plano FNI_Plano_Implementacao_P0.md) — romaneio: NF-e do
// embarcador vinculadas ao frete. Mesmo padrão de documentosActions.ts
// (upload de XML já emitido em outro lugar) + uma segunda via por
// digitação da chave, pra quando só a chave está em mãos (mesma concessão
// já usada pro CIOT).

async function empresaPertenceAoUsuario(supabase: Supabase, empresaId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

async function usuarioAtualEmail(supabase: Supabase): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export type ResultadoNfeCarga = { erro?: string; sucesso?: { numeroNf: string; chaveAcesso: string } };

export async function enviarNfeCargaAcao(freteId: string, empresaId: string, formData: FormData): Promise<ResultadoNfeCarga> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para registrar documentos neste frete." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione o arquivo XML da NF-e." };
  if (arquivo.size > 2 * 1024 * 1024) return { erro: "O arquivo é grande demais (máximo 2 MB)." };

  const texto = await arquivo.text();
  const parse = parsearXmlNfeCarga(texto);
  if (!parse.ok) return { erro: parse.erro };
  const nfe: NfeCargaExtraida = parse.nfe;

  const { data: existente } = await supabase.from("fretes_nfe").select("id, frete_id").eq("chave_acesso", nfe.chaveAcesso).maybeSingle();
  if (existente) {
    return { erro: existente.frete_id === freteId ? "Esta NF-e já está registrada neste frete." : "Esta NF-e já está registrada em outro frete." };
  }

  const criadoPor = await usuarioAtualEmail(supabase);
  const { error: erroInsert } = await supabase.from("fretes_nfe").insert({
    frete_id: freteId,
    chave_acesso: nfe.chaveAcesso,
    numero_nf: Number.isFinite(nfe.numeroNf) ? nfe.numeroNf : null,
    serie_nf: nfe.serieNf,
    natureza_operacao: nfe.naturezaOperacao,
    data_emissao: nfe.dataEmissao || null,
    cnpj_emitente: nfe.cnpjEmitente,
    nome_emitente: nfe.nomeEmitente,
    cnpj_destinatario: nfe.cnpjDestinatario,
    nome_destinatario: nfe.nomeDestinatario,
    valor_nf: nfe.valorNf,
    peso_bruto_kg: nfe.pesoBrutoKg,
    peso_liquido_kg: nfe.pesoLiquidoKg,
    quantidade_volumes: nfe.quantidadeVolumes,
    especie_volume: nfe.especieVolume,
    origem: "upload",
    xml_storage_path: `${freteId}/nfe-${nfe.chaveAcesso}.xml`,
    criado_por: criadoPor,
  });
  if (erroInsert) return { erro: `Não foi possível registrar a NF-e: ${erroInsert.message}` };

  const { error: erroUpload } = await supabase.storage
    .from("fretes-documentos")
    .upload(`${freteId}/nfe-${nfe.chaveAcesso}.xml`, texto, { contentType: "text/xml" });
  void erroUpload; // best-effort, mesmo padrão do resto do app

  revalidatePath(`/fretes/${freteId}`);
  return { sucesso: { numeroNf: String(nfe.numeroNf), chaveAcesso: nfe.chaveAcesso } };
}

export async function digitarNfeCargaAcao(freteId: string, empresaId: string, formData: FormData): Promise<ResultadoNfeCarga> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para registrar documentos neste frete." };
  }

  const chaveAcesso = String(formData.get("chave_acesso") ?? "").replace(/\D/g, "");
  if (!/^\d{44}$/.test(chaveAcesso)) return { erro: "Chave de acesso inválida (esperado 44 dígitos)." };

  const { data: existente } = await supabase.from("fretes_nfe").select("id, frete_id").eq("chave_acesso", chaveAcesso).maybeSingle();
  if (existente) {
    return { erro: existente.frete_id === freteId ? "Esta NF-e já está registrada neste frete." : "Esta NF-e já está registrada em outro frete." };
  }

  const pesoBrutoRaw = String(formData.get("peso_bruto_kg") ?? "").trim();
  const valorNfRaw = String(formData.get("valor_nf") ?? "").trim();
  const pesoBrutoKg = pesoBrutoRaw ? Number(pesoBrutoRaw) : null;
  const valorNf = valorNfRaw ? Number(valorNfRaw) : null;

  const criadoPor = await usuarioAtualEmail(supabase);
  const { error: erroInsert } = await supabase.from("fretes_nfe").insert({
    frete_id: freteId,
    chave_acesso: chaveAcesso,
    valor_nf: valorNf,
    peso_bruto_kg: pesoBrutoKg,
    origem: "digitada",
    criado_por: criadoPor,
  });
  if (erroInsert) return { erro: `Não foi possível registrar a NF-e: ${erroInsert.message}` };

  revalidatePath(`/fretes/${freteId}`);
  return { sucesso: { numeroNf: "—", chaveAcesso } };
}
