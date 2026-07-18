"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsearXmlCte, type CteExtraida } from "@/lib/cte";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase Fretes-CIOT-CTe (18/07) — pedido do Daniel: registrar CIOT e CT-e
// por frete. Nenhum dos dois é emitido por aqui (ver comentário em
// src/lib/cte.ts e na migração criar_fretes_ciot_e_cte) — só cadastro do
// que já foi emitido em outro lugar, com validação estrutural no caso do
// CT-e (XML nacional padronizado) e cadastro manual + anexo opcional no
// caso do CIOT (não existe um XML público padronizado pro motorista/cliente
// ter em mãos). Mesmo padrão de checagem "amigável" antes da RLS já usado
// em fretes/actions.ts (empresaPertenceAoUsuario duplicada aqui de
// propósito — mesmo padrão do resto do projeto, um helper local por
// arquivo de actions).

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

export type ResultadoCte = { erro?: string; sucesso?: { numeroCte: string; chaveAcesso: string } };

export async function enviarCteAcao(freteId: string, empresaId: string, formData: FormData): Promise<ResultadoCte> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para registrar documentos neste frete." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo XML do CT-e." };
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { erro: "O arquivo é grande demais (máximo 2 MB) — confira se é mesmo o XML do CT-e." };
  }

  const texto = await arquivo.text();
  const parse = parsearXmlCte(texto);
  if (!parse.ok) {
    return { erro: parse.erro };
  }
  const cte: CteExtraida = parse.cte;

  const { data: existente } = await supabase
    .from("fretes_cte")
    .select("id, frete_id")
    .eq("chave_acesso", cte.chaveAcesso)
    .maybeSingle();
  if (existente) {
    return {
      erro:
        existente.frete_id === freteId
          ? "Este CT-e já está registrado neste frete."
          : "Este CT-e já está registrado em outro frete.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: erroInsert } = await supabase.from("fretes_cte").insert({
    frete_id: freteId,
    chave_acesso: cte.chaveAcesso,
    numero_cte: cte.numeroCte,
    serie: cte.serieCte,
    protocolo_autorizacao: cte.protocoloAutorizacao,
    cnpj_emitente: cte.cnpjEmitente,
    nome_emitente: cte.nomeEmitente,
    valor_prestacao: cte.valorPrestacao,
    data_emissao: cte.dataEmissao || null,
    xml_storage_path: `${freteId}/cte-${cte.chaveAcesso}.xml`,
    criado_por: user?.email ?? null,
  });

  if (erroInsert) {
    return { erro: `Não foi possível registrar o CT-e: ${erroInsert.message}` };
  }

  const { error: erroUpload } = await supabase.storage
    .from("fretes-documentos")
    .upload(`${freteId}/cte-${cte.chaveAcesso}.xml`, texto, { contentType: "text/xml" });
  // Best-effort — mesmo padrão de notas-fiscais/actions.ts: a linha (fonte
  // da verdade) já foi gravada, uma falha aqui só perde a cópia do arquivo
  // original, não o registro em si.
  void erroUpload;

  revalidatePath(`/fretes/${freteId}`);
  return { sucesso: { numeroCte: cte.numeroCte, chaveAcesso: cte.chaveAcesso } };
}

export type ResultadoCiot = { erro?: string; sucesso?: { numeroCiot: string } };

export async function registrarCiotAcao(freteId: string, empresaId: string, formData: FormData): Promise<ResultadoCiot> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para registrar documentos neste frete." };
  }

  const numeroCiot = String(formData.get("numero_ciot") ?? "").replace(/\D/g, "");
  if (numeroCiot.length !== 12) {
    return { erro: "O número do CIOT precisa ter 12 dígitos (gerado pela integradora credenciada na ANTT)." };
  }

  const rntrc = String(formData.get("rntrc") ?? "").trim() || null;
  const placaVeiculo = String(formData.get("placa_veiculo") ?? "").trim().toUpperCase() || null;
  const valorFreteRaw = String(formData.get("valor_frete") ?? "").trim();
  const valorFrete = valorFreteRaw ? Number(valorFreteRaw) : null;
  const dataEmissao = String(formData.get("data_emissao") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const anexo = formData.get("anexo");

  if (valorFreteRaw && (valorFrete === null || !Number.isFinite(valorFrete) || valorFrete < 0)) {
    return { erro: "Valor do frete inválido." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let anexoPath: string | null = null;
  if (anexo instanceof File && anexo.size > 0) {
    if (anexo.size > 5 * 1024 * 1024) {
      return { erro: "O anexo é grande demais (máximo 5 MB)." };
    }
    const extensao = anexo.name.includes(".") ? anexo.name.split(".").pop() : "pdf";
    anexoPath = `${freteId}/ciot-${numeroCiot}.${extensao}`;
    const { error: erroUpload } = await supabase.storage.from("fretes-documentos").upload(anexoPath, anexo, {
      contentType: anexo.type || undefined,
      upsert: true,
    });
    if (erroUpload) {
      return { erro: `Não foi possível salvar o anexo: ${erroUpload.message}` };
    }
  }

  const { error: erroInsert } = await supabase.from("fretes_ciot").insert({
    frete_id: freteId,
    numero_ciot: numeroCiot,
    rntrc,
    placa_veiculo: placaVeiculo,
    valor_frete: valorFrete,
    data_emissao: dataEmissao,
    observacao,
    anexo_storage_path: anexoPath,
    criado_por: user?.email ?? null,
  });

  if (erroInsert) {
    if (erroInsert.code === "23505") {
      return { erro: "Esse número de CIOT já está registrado neste frete." };
    }
    return { erro: `Não foi possível registrar o CIOT: ${erroInsert.message}` };
  }

  revalidatePath(`/fretes/${freteId}`);
  return { sucesso: { numeroCiot } };
}
