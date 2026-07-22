"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterProvedorFiscal } from "@/lib/fiscal";
import type { ProvedorNome } from "@/lib/fiscal";

// Fase P0.1 — Server Actions da tela /fiscal (cadastro fiscal do emitente).
// Regra de ouro da fase: o certificado A1 (.pfx) passa por aqui só em
// memória, direto pro provedor — NUNCA é gravado em banco ou Storage.

const REGIMES = ["simples", "presumido", "real"] as const;
const AMBIENTES = ["homologacao", "producao"] as const;
const PROVEDORES: ProvedorNome[] = ["mock", "focusnfe", "plugnotas"];

type Resultado = { erro?: string; ok?: string };

async function usuarioAtualEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function salvarDadosFiscaisAcao(formData: FormData): Promise<Resultado> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Empresa não informada." };

  const regime = String(formData.get("regime_tributario") ?? "");
  if (!REGIMES.includes(regime as (typeof REGIMES)[number])) return { erro: "Regime tributário inválido." };

  const ambiente = String(formData.get("ambiente") ?? "");
  if (!AMBIENTES.includes(ambiente as (typeof AMBIENTES)[number])) return { erro: "Ambiente inválido." };

  const provedor = String(formData.get("provedor") ?? "") as ProvedorNome;
  if (!PROVEDORES.includes(provedor)) return { erro: "Provedor inválido." };

  const serieCte = Number(formData.get("serie_cte"));
  const serieMdfe = Number(formData.get("serie_mdfe"));
  if (!Number.isInteger(serieCte) || serieCte < 1 || !Number.isInteger(serieMdfe) || serieMdfe < 1) {
    return { erro: "Séries de CT-e/MDF-e devem ser números inteiros a partir de 1." };
  }

  const supabase = await createClient();

  // O RLS de empresas já garante que o usuário só enxerga as próprias
  // empresas — se a consulta não retornar nada, ou o id não existe ou o
  // usuário não tem vínculo com ele.
  const { data: empresa } = await supabase.from("empresas").select("id, nome, cnpj").eq("id", empresaId).maybeSingle();
  if (!empresa) return { erro: "Empresa não encontrada (ou você não tem acesso a ela)." };
  if (!empresa.cnpj) return { erro: "A empresa precisa ter CNPJ preenchido no cadastro de Clientes antes de configurar o fiscal." };

  // Cadastra/atualiza o emitente no provedor ANTES de gravar — se o
  // provedor recusar, nada é persistido (mesmo espírito transacional das
  // integrações existentes).
  let provedorRef: string;
  try {
    const impl = obterProvedorFiscal(provedor);
    const resultado = await impl.cadastrarEmitente({
      empresaId,
      cnpj: empresa.cnpj,
      razaoSocial: empresa.nome,
      inscricaoEstadual: String(formData.get("inscricao_estadual") ?? "").trim() || null,
      regimeTributario: regime as (typeof REGIMES)[number],
      ambiente: ambiente as (typeof AMBIENTES)[number],
    });
    if (!resultado.ok) return { erro: resultado.erro };
    provedorRef = resultado.provedorRef;
  } catch (e) {
    // obterProvedorFiscal lança pra provedores reais ainda não implementados
    // (P0.2) — vira mensagem amigável, não erro 500.
    return { erro: e instanceof Error ? e.message : "Falha ao falar com o provedor fiscal." };
  }

  const { error } = await supabase.from("empresas_fiscal").upsert(
    {
      empresa_id: empresaId,
      inscricao_estadual: String(formData.get("inscricao_estadual") ?? "").trim() || null,
      rntrc: String(formData.get("rntrc") ?? "").trim() || null,
      regime_tributario: regime,
      serie_cte: serieCte,
      serie_mdfe: serieMdfe,
      ambiente,
      provedor,
      provedor_ref: provedorRef,
      atualizado_em: new Date().toISOString(),
      atualizado_por: await usuarioAtualEmail(),
    },
    { onConflict: "empresa_id" }
  );
  if (error) return { erro: `Falha ao salvar: ${error.message}` };

  revalidatePath("/fiscal");
  return { ok: "Dados fiscais salvos e emitente cadastrado no provedor." };
}

export async function enviarCertificadoAcao(formData: FormData): Promise<Resultado> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Empresa não informada." };

  const arquivo = formData.get("certificado");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione o arquivo do certificado (.pfx)." };
  if (!arquivo.name.toLowerCase().match(/\.(pfx|p12)$/)) return { erro: "O certificado A1 deve ser um arquivo .pfx ou .p12." };

  const senha = String(formData.get("senha") ?? "");
  if (!senha) return { erro: "Informe a senha do certificado." };

  const supabase = await createClient();
  const { data: fiscal } = await supabase
    .from("empresas_fiscal")
    .select("empresa_id, provedor, provedor_ref")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fiscal?.provedor_ref) return { erro: "Salve os dados fiscais primeiro — o emitente precisa existir no provedor antes do certificado." };

  try {
    const impl = obterProvedorFiscal(fiscal.provedor as ProvedorNome);
    const resultado = await impl.enviarCertificado(fiscal.provedor_ref, await arquivo.arrayBuffer(), senha);
    if (!resultado.ok) return { erro: resultado.erro };

    const { error } = await supabase
      .from("empresas_fiscal")
      .update({
        certificado_vencimento: resultado.vencimento,
        certificado_enviado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        atualizado_por: await usuarioAtualEmail(),
      })
      .eq("empresa_id", empresaId);
    if (error) return { erro: `Certificado aceito pelo provedor, mas falhou ao registrar aqui: ${error.message}` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar o certificado ao provedor." };
  }

  revalidatePath("/fiscal");
  return { ok: "Certificado enviado ao provedor com sucesso." };
}

export async function testarConexaoAcao(formData: FormData): Promise<Resultado> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) return { erro: "Empresa não informada." };

  const supabase = await createClient();
  const { data: fiscal } = await supabase
    .from("empresas_fiscal")
    .select("empresa_id, provedor, provedor_ref, ambiente")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fiscal) return { erro: "Salve os dados fiscais primeiro." };

  let statusTexto: string;
  let resultadoFinal: Resultado;
  try {
    const impl = obterProvedorFiscal(fiscal.provedor as ProvedorNome);
    const resultado = await impl.testarConexao(fiscal.provedor_ref ?? "", fiscal.ambiente as "homologacao" | "producao");
    statusTexto = resultado.ok ? `OK: ${resultado.mensagem}` : `ERRO: ${resultado.erro}`;
    resultadoFinal = resultado.ok ? { ok: resultado.mensagem } : { erro: resultado.erro };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha no teste de conexão.";
    statusTexto = `ERRO: ${mensagem}`;
    resultadoFinal = { erro: mensagem };
  }

  // O resultado do teste (bom ou ruim) fica registrado na própria linha —
  // a tela mostra o último status sem precisar retestar.
  await supabase
    .from("empresas_fiscal")
    .update({ status_conexao: statusTexto, status_conexao_em: new Date().toISOString() })
    .eq("empresa_id", empresaId);

  revalidatePath("/fiscal");
  return resultadoFinal;
}
