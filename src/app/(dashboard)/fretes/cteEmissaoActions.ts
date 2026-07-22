"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterProvedorFiscal } from "@/lib/fiscal";
import type { DadosEmissaoCte, DadosParceiro, PapelTomador, ProvedorNome } from "@/lib/fiscal";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase P0.2 (plano FNI_Plano_Implementacao_P0.md) — "o coração do P0":
// emissão de CT-e pela própria plataforma, caminho novo ao lado do upload
// já existente (src/app/(dashboard)/fretes/documentosActions.ts, que
// continua funcionando sem mudanças). Mesmo padrão de checagem "amigável"
// antes da RLS já usado no resto do projeto.

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

function lerParceiro(formData: FormData, prefixo: string): DadosParceiro | null {
  const cnpjCpf = String(formData.get(`${prefixo}_cnpj_cpf`) ?? "").replace(/\D/g, "");
  const razaoSocial = String(formData.get(`${prefixo}_razao_social`) ?? "").trim();
  if (!cnpjCpf || !razaoSocial) return null;
  if (cnpjCpf.length !== 11 && cnpjCpf.length !== 14) return null;
  return {
    cnpjCpf,
    razaoSocial,
    ie: String(formData.get(`${prefixo}_ie`) ?? "").trim() || null,
    endereco: {
      logradouro: String(formData.get(`${prefixo}_logradouro`) ?? "").trim(),
      numero: String(formData.get(`${prefixo}_numero`) ?? "").trim(),
      bairro: String(formData.get(`${prefixo}_bairro`) ?? "").trim(),
      municipio: String(formData.get(`${prefixo}_municipio`) ?? "").trim(),
      uf: String(formData.get(`${prefixo}_uf`) ?? "").trim().toUpperCase(),
      cep: String(formData.get(`${prefixo}_cep`) ?? "").replace(/\D/g, ""),
    },
  };
}

async function salvarParceiroReutilizavel(
  supabase: Supabase,
  empresaId: string,
  papel: "remetente" | "destinatario" | "tomador",
  parceiro: DadosParceiro,
  criadoPor: string | null
) {
  // Best-effort — se falhar, não impede a emissão (que já aconteceu); só
  // perde a conveniência de reaproveitar o cadastro da próxima vez.
  await supabase.from("cadastros_parceiros").upsert(
    {
      empresa_id: empresaId,
      papel,
      cnpj_cpf: parceiro.cnpjCpf,
      razao_social: parceiro.razaoSocial,
      ie: parceiro.ie,
      endereco_logradouro: parceiro.endereco.logradouro,
      endereco_numero: parceiro.endereco.numero,
      endereco_bairro: parceiro.endereco.bairro,
      endereco_municipio: parceiro.endereco.municipio,
      endereco_uf: parceiro.endereco.uf,
      endereco_cep: parceiro.endereco.cep,
      criado_por: criadoPor,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "empresa_id,papel,cnpj_cpf" }
  );
}

export type ResultadoEmissaoCteAcao = {
  erro?: string;
  sucesso?: { numeroCte: string; chaveAcesso: string };
};

export async function emitirCteAcao(
  freteId: string,
  empresaId: string,
  formData: FormData
): Promise<ResultadoEmissaoCteAcao> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para emitir documentos neste frete." };
  }

  const { data: frete } = await supabase
    .from("fretes")
    .select("id, coleta_cidade, coleta_uf, entrega_cidade, entrega_uf")
    .eq("id", freteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!frete) return { erro: "Frete não encontrado." };

  const { data: empresa } = await supabase.from("empresas").select("nome, cnpj").eq("id", empresaId).maybeSingle();
  if (!empresa?.cnpj) return { erro: "A empresa precisa ter CNPJ cadastrado antes de emitir CT-e." };

  const { data: fiscal } = await supabase
    .from("empresas_fiscal")
    .select("provedor, provedor_ref, ambiente, serie_cte, proximo_numero_cte")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fiscal?.provedor_ref) {
    return { erro: "Configure os dados fiscais em Fiscal antes de emitir CT-e (cadastro do emitente no provedor)." };
  }

  const remetente = lerParceiro(formData, "remetente");
  const destinatario = lerParceiro(formData, "destinatario");
  const tomadorBase = lerParceiro(formData, "tomador");
  const tomadorPapel = String(formData.get("tomador_papel") ?? "") as PapelTomador;
  const PAPEIS_VALIDOS: PapelTomador[] = ["remetente", "expedidor", "recebedor", "destinatario", "outros"];

  if (!remetente) return { erro: "Dados do remetente incompletos (CNPJ/CPF e razão social são obrigatórios)." };
  if (!destinatario) return { erro: "Dados do destinatário incompletos (CNPJ/CPF e razão social são obrigatórios)." };
  if (!tomadorBase) return { erro: "Dados do tomador do serviço incompletos (CNPJ/CPF e razão social são obrigatórios)." };
  if (!PAPEIS_VALIDOS.includes(tomadorPapel)) return { erro: "Papel do tomador inválido." };

  const cfop = String(formData.get("cfop") ?? "").trim();
  const naturezaOperacao = String(formData.get("natureza_operacao") ?? "").trim();
  if (!cfop) return { erro: "Informe o CFOP." };
  if (!naturezaOperacao) return { erro: "Informe a natureza da operação." };

  const valorPrestacao = Number(formData.get("valor_prestacao"));
  const valorReceber = Number(formData.get("valor_receber") || formData.get("valor_prestacao"));
  if (!Number.isFinite(valorPrestacao) || valorPrestacao <= 0) {
    return { erro: "Valor da prestação do serviço deve ser um número maior que zero." };
  }

  const icmsCst = String(formData.get("icms_cst") ?? "").trim();
  const icmsBase = Number(formData.get("icms_base") || 0);
  const icmsAliquota = Number(formData.get("icms_aliquota") || 0);
  const icmsValor = Number(formData.get("icms_valor") || 0);
  if (!icmsCst) return { erro: "Informe o CST do ICMS." };

  const chavesNfe = String(formData.get("chaves_nfe") ?? "")
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  for (const chave of chavesNfe) {
    if (!/^\d{44}$/.test(chave)) {
      return { erro: `Chave de NF-e inválida: "${chave}" (esperado 44 dígitos).` };
    }
  }

  const municipioInicio = String(formData.get("municipio_inicio") ?? frete.coleta_cidade ?? "").trim();
  const ufInicio = String(formData.get("uf_inicio") ?? frete.coleta_uf ?? "").trim().toUpperCase();
  const municipioFim = String(formData.get("municipio_fim") ?? frete.entrega_cidade ?? "").trim();
  const ufFim = String(formData.get("uf_fim") ?? frete.entrega_uf ?? "").trim().toUpperCase();
  if (!municipioInicio || !ufInicio) return { erro: "Informe o município/UF de início da prestação." };
  if (!municipioFim || !ufFim) return { erro: "Informe o município/UF de término da prestação." };

  const criadoPor = await usuarioAtualEmail(supabase);
  const serie = fiscal.serie_cte;
  const numero = fiscal.proximo_numero_cte;

  // Grava a linha ANTES de chamar o provedor (estado 'enviando') — mesmo
  // espírito do resto do fiscal: se o provedor real algum dia demorar
  // (assíncrono de verdade), o registro já existe pra a tela mostrar
  // "enviando" e o webhook completar depois.
  const { data: linha, error: erroInsert } = await supabase
    .from("fretes_cte")
    .insert({
      frete_id: freteId,
      origem: "emitido",
      status: "enviando",
      numero_cte: String(numero),
      serie: String(serie),
      cnpj_emitente: empresa.cnpj,
      nome_emitente: empresa.nome,
      tomador_cnpj: tomadorBase.cnpjCpf,
      tomador_nome: tomadorBase.razaoSocial,
      tomador_papel: tomadorPapel,
      cfop,
      natureza_operacao: naturezaOperacao,
      icms_cst: icmsCst,
      icms_base: icmsBase,
      icms_aliquota: icmsAliquota,
      icms_valor: icmsValor,
      chaves_nfe: chavesNfe,
      valor_prestacao: valorPrestacao,
      provedor_ref: fiscal.provedor_ref,
      provedor_nome: fiscal.provedor,
      ambiente: fiscal.ambiente,
      criado_por: criadoPor,
    })
    .select("id")
    .single();
  if (erroInsert || !linha) {
    return { erro: `Não foi possível iniciar a emissão: ${erroInsert?.message ?? "erro desconhecido"}.` };
  }

  const dados: DadosEmissaoCte = {
    provedorRef: fiscal.provedor_ref,
    ambiente: fiscal.ambiente as "homologacao" | "producao",
    cnpjEmitente: empresa.cnpj,
    serie,
    numero,
    naturezaOperacao,
    cfop,
    municipioInicio,
    ufInicio,
    municipioFim,
    ufFim,
    valorPrestacao,
    valorReceber: Number.isFinite(valorReceber) ? valorReceber : valorPrestacao,
    remetente,
    destinatario,
    tomador: { ...tomadorBase, papel: tomadorPapel },
    chavesNfe,
    icms: { cst: icmsCst, baseCalculo: icmsBase, aliquota: icmsAliquota, valor: icmsValor },
  };

  try {
    const impl = obterProvedorFiscal(fiscal.provedor as ProvedorNome);
    const resultado = await impl.emitirCte(dados);

    if (!resultado.ok) {
      await supabase.from("fretes_cte").update({ status: "rascunho", motivo_rejeicao: resultado.erro, atualizado_em: new Date().toISOString() }).eq("id", linha.id);
      return { erro: resultado.erro };
    }

    if (resultado.situacao === "rejeitado") {
      await supabase
        .from("fretes_cte")
        .update({ status: "rejeitado", motivo_rejeicao: resultado.motivoRejeicao, atualizado_em: new Date().toISOString() })
        .eq("id", linha.id);
      revalidatePath(`/fretes/${freteId}`);
      return { erro: `CT-e rejeitado pela SEFAZ: ${resultado.motivoRejeicao}` };
    }

    await supabase
      .from("fretes_cte")
      .update({
        status: "autorizado",
        chave_acesso: resultado.chaveAcesso,
        numero_cte: resultado.numeroCte,
        serie: resultado.serieCte,
        protocolo_autorizacao: resultado.protocoloAutorizacao,
        data_emissao: resultado.dataAutorizacao,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", linha.id);

    await supabase
      .from("empresas_fiscal")
      .update({ proximo_numero_cte: numero + 1 })
      .eq("empresa_id", empresaId);

    await Promise.all([
      salvarParceiroReutilizavel(supabase, empresaId, "remetente", remetente, criadoPor),
      salvarParceiroReutilizavel(supabase, empresaId, "destinatario", destinatario, criadoPor),
      salvarParceiroReutilizavel(supabase, empresaId, "tomador", tomadorBase, criadoPor),
    ]);

    revalidatePath(`/fretes/${freteId}`);
    return { sucesso: { numeroCte: resultado.numeroCte, chaveAcesso: resultado.chaveAcesso } };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao emitir o CT-e.";
    await supabase.from("fretes_cte").update({ status: "rascunho", motivo_rejeicao: mensagem, atualizado_em: new Date().toISOString() }).eq("id", linha.id);
    return { erro: mensagem };
  }
}

export type ResultadoAcaoCte = { erro?: string; ok?: string };

export async function cancelarCteAcao(cteId: string, empresaId: string, justificativa: string): Promise<ResultadoAcaoCte> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para cancelar documentos neste frete." };
  }

  const { data: cte } = await supabase
    .from("fretes_cte")
    .select("id, frete_id, origem, status, chave_acesso, provedor_ref, provedor_nome")
    .eq("id", cteId)
    .maybeSingle();
  if (!cte) return { erro: "CT-e não encontrado." };
  const { data: freteDoCte } = await supabase.from("fretes").select("empresa_id").eq("id", cte.frete_id).maybeSingle();
  if (freteDoCte?.empresa_id !== empresaId) return { erro: "CT-e não encontrado." };
  if (cte.origem !== "emitido") return { erro: "Só é possível cancelar CT-e emitido pela plataforma (o de upload já foi cancelado/gerido fora daqui)." };
  if (cte.status !== "autorizado") return { erro: `Este CT-e está com status "${cte.status}" — só é possível cancelar um CT-e autorizado.` };
  if (!cte.chave_acesso) return { erro: "CT-e sem chave de acesso — dado inconsistente." };

  try {
    const impl = obterProvedorFiscal(cte.provedor_nome as ProvedorNome);
    const resultado = await impl.cancelarCte(cte.provedor_ref ?? "", cte.chave_acesso, justificativa);
    if (!resultado.ok) return { erro: resultado.erro };

    await supabase
      .from("fretes_cte")
      .update({ status: "cancelado", motivo_rejeicao: `Cancelado: ${justificativa}`, atualizado_em: new Date().toISOString() })
      .eq("id", cteId);

    revalidatePath(`/fretes/${cte.frete_id}`);
    return { ok: "CT-e cancelado com sucesso." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao cancelar o CT-e." };
  }
}

export async function cartaCorrecaoCteAcao(cteId: string, empresaId: string, textoCorrecao: string): Promise<ResultadoAcaoCte> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para corrigir documentos neste frete." };
  }

  const { data: cte } = await supabase
    .from("fretes_cte")
    .select("id, frete_id, origem, status, chave_acesso, provedor_ref, provedor_nome")
    .eq("id", cteId)
    .maybeSingle();
  if (!cte) return { erro: "CT-e não encontrado." };
  const { data: freteDoCte } = await supabase.from("fretes").select("empresa_id").eq("id", cte.frete_id).maybeSingle();
  if (freteDoCte?.empresa_id !== empresaId) return { erro: "CT-e não encontrado." };
  if (cte.origem !== "emitido") return { erro: "Só é possível emitir carta de correção pra CT-e emitido pela plataforma." };
  if (cte.status !== "autorizado") return { erro: `Este CT-e está com status "${cte.status}" — só é possível corrigir um CT-e autorizado.` };
  if (!cte.chave_acesso) return { erro: "CT-e sem chave de acesso — dado inconsistente." };

  try {
    const impl = obterProvedorFiscal(cte.provedor_nome as ProvedorNome);
    const resultado = await impl.cartaCorrecaoCte(cte.provedor_ref ?? "", cte.chave_acesso, textoCorrecao);
    if (!resultado.ok) return { erro: resultado.erro };

    revalidatePath(`/fretes/${cte.frete_id}`);
    return { ok: `Carta de correção nº ${resultado.sequencia} registrada (protocolo ${resultado.protocolo}).` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao registrar a carta de correção." };
  }
}
