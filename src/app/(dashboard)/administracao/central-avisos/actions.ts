"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizarNomeParaStorage } from "@/lib/storageUtils";
import { logger } from "@/lib/logger";

// Fase Central-Avisos (28/07/2026) — pedido do Daniel: canal oficial dentro
// da aplicação pra comunicar novidades, correções, manutenções/
// indisponibilidade e avisos gerais, sem depender de e-mail/WhatsApp. Mesmo
// espírito e estrutura de proteção de central-conteudo (RLS
// perfil_usuario_atual()='admin' + garantirAdmin() aqui como 2ª camada),
// tabela `comunicados` (nome técnico — o rótulo visível ao usuário é
// "Central de Avisos", decidido pelo Daniel; mesmo padrão de conteudo_ajuda
// alimentar "Central de Treinamento").
//
// Este arquivo também guarda as funções de LEITURA usadas por qualquer
// perfil (sino/drawer/banner/histórico) — não passam por garantirAdmin(),
// só as de escrita (criar/atualizar/ativar/excluir) passam.

const BUCKET_IMAGENS = "comunicados-imagens";

export type AvisoFormState = { erro?: string } | undefined;

async function garantirAdmin() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    throw new Error("Acesso restrito ao time administrador.");
  }
  return supabase;
}

function montarPayload(formData: FormData) {
  const segmentosAlvo = formData
    .getAll("segmentos_alvo")
    .map((v) => String(v))
    .filter(Boolean);
  const planosAlvo = formData
    .getAll("planos_alvo")
    .map((v) => String(v))
    .filter(Boolean);
  const dataPublicacaoRaw = String(formData.get("data_publicacao") ?? "").trim();
  const dataExpiracaoRaw = String(formData.get("data_expiracao") ?? "").trim();

  return {
    tipo: String(formData.get("tipo") ?? "aviso_geral") as "novidade" | "correcao" | "manutencao" | "aviso_geral",
    urgencia: String(formData.get("urgencia") ?? "informativo") as "informativo" | "atencao" | "critico",
    titulo: String(formData.get("titulo") ?? "").trim(),
    resumo: String(formData.get("resumo") ?? "").trim(),
    corpo: String(formData.get("corpo") ?? "").trim(),
    segmentos_alvo: segmentosAlvo,
    planos_alvo: planosAlvo,
    data_publicacao: dataPublicacaoRaw ? new Date(dataPublicacaoRaw).toISOString() : new Date().toISOString(),
    data_expiracao: dataExpiracaoRaw ? new Date(dataExpiracaoRaw).toISOString() : null,
    fixado: formData.get("fixado") === "on",
    ativo: formData.get("ativo") === "on",
  };
}

async function processarImagem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  imagemPathAtual: string | null
): Promise<string | null | undefined> {
  const arquivo = formData.get("imagem");
  const removerImagem = formData.get("remover_imagem") === "on";

  if (removerImagem && imagemPathAtual) {
    await supabase.storage.from(BUCKET_IMAGENS).remove([imagemPathAtual]).catch(() => {});
    return null;
  }

  if (arquivo instanceof File && arquivo.size > 0) {
    const caminho = `${Date.now()}_${sanitizarNomeParaStorage(arquivo.name)}`;
    const { error } = await supabase.storage.from(BUCKET_IMAGENS).upload(caminho, arquivo, {
      contentType: arquivo.type || undefined,
    });
    if (error) {
      throw new Error(`Falha ao enviar imagem: ${error.message}`);
    }
    // Best-effort: remove a imagem antiga pra não acumular lixo no bucket.
    if (imagemPathAtual) {
      await supabase.storage.from(BUCKET_IMAGENS).remove([imagemPathAtual]).catch(() => {});
    }
    return caminho;
  }

  return undefined; // sem mudança
}

export async function criarAvisoAcao(_prev: AvisoFormState, formData: FormData): Promise<AvisoFormState> {
  let supabase;
  try {
    supabase = await garantirAdmin();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Acesso restrito." };
  }

  const payload = montarPayload(formData);
  if (!payload.titulo || !payload.resumo || !payload.corpo) {
    return { erro: "Título, resumo e corpo são obrigatórios." };
  }

  let imagemPath: string | null = null;
  try {
    const resultado = await processarImagem(supabase, formData, null);
    imagemPath = resultado ?? null;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar imagem." };
  }

  const { error } = await supabase.from("comunicados").insert({
    ...payload,
    imagem_path: imagemPath,
    atualizado_por: (await supabase.auth.getUser()).data.user?.email,
  });
  if (error) {
    return { erro: error.message };
  }

  revalidatePath("/administracao/central-avisos");
  redirect("/administracao/central-avisos");
}

export async function atualizarAvisoAcao(
  id: string,
  _prev: AvisoFormState,
  formData: FormData
): Promise<AvisoFormState> {
  let supabase;
  try {
    supabase = await garantirAdmin();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Acesso restrito." };
  }

  const payload = montarPayload(formData);
  if (!payload.titulo || !payload.resumo || !payload.corpo) {
    return { erro: "Título, resumo e corpo são obrigatórios." };
  }

  const { data: atual } = await supabase.from("comunicados").select("imagem_path").eq("id", id).single();

  let imagemUpdate: { imagem_path?: string | null } = {};
  try {
    const resultado = await processarImagem(supabase, formData, atual?.imagem_path ?? null);
    if (resultado !== undefined) imagemUpdate = { imagem_path: resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar imagem." };
  }

  const { error } = await supabase
    .from("comunicados")
    .update({
      ...payload,
      ...imagemUpdate,
      atualizado_por: (await supabase.auth.getUser()).data.user?.email,
    })
    .eq("id", id);

  if (error) {
    return { erro: error.message };
  }

  revalidatePath("/administracao/central-avisos");
  redirect("/administracao/central-avisos");
}

export async function alternarAtivoAvisoAcao(id: string, ativo: boolean) {
  const supabase = await garantirAdmin();
  const { error } = await supabase.from("comunicados").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/central-avisos");
}

export async function excluirAvisoAcao(id: string) {
  const supabase = await garantirAdmin();
  const { data: atual } = await supabase.from("comunicados").select("imagem_path").eq("id", id).single();
  if (atual?.imagem_path) {
    await supabase.storage.from(BUCKET_IMAGENS).remove([atual.imagem_path]).catch(() => {});
  }
  const { error } = await supabase.from("comunicados").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/central-avisos");
}

// ---------------------------------------------------------------------
// Leitura — usada por qualquer perfil autenticado (sino, drawer, banner
// fixo e página de histórico). Sem garantirAdmin(): RLS já libera SELECT
// de comunicados ativos pra qualquer autenticado.
// ---------------------------------------------------------------------

export type AvisoParaUsuario = {
  id: string;
  tipo: "novidade" | "correcao" | "manutencao" | "aviso_geral";
  urgencia: "informativo" | "atencao" | "critico";
  titulo: string;
  resumo: string;
  corpo: string;
  imagem_path: string | null;
  fixado: boolean;
  data_publicacao: string;
  data_expiracao: string | null;
  lido: boolean;
};

// Busca os avisos ativos dentro da janela de publicação/expiração,
// segmentados pra empresa(s) do usuário logado (segmentos_alvo/planos_alvo/
// empresas_alvo vazios = visível a todos), com o campo `lido` já calculado.
// Usada tanto pra contar não lidos (badge do sino) quanto pra listar no
// drawer/banner/histórico — mantém a regra de segmentação em UM lugar só.
export async function listarAvisosAcao(opts?: { incluirExpirados?: boolean }): Promise<AvisoParaUsuario[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return [];

  const agora = new Date().toISOString();
  let query = supabase
    .from("comunicados")
    .select(
      "id, tipo, urgencia, titulo, resumo, corpo, imagem_path, segmentos_alvo, planos_alvo, empresas_alvo, fixado, data_publicacao, data_expiracao"
    )
    .eq("ativo", true)
    .lte("data_publicacao", agora);
  // Histórico completo (/central-avisos) mostra tudo que já foi publicado,
  // inclusive avisos já expirados (ex.: manutenção que já terminou) — só o
  // sino/drawer/banner (uso normal) escondem o que já saiu da janela.
  if (!opts?.incluirExpirados) {
    query = query.or(`data_expiracao.is.null,data_expiracao.gte.${agora}`);
  }
  const { data: avisos } = await query.order("fixado", { ascending: false }).order("data_publicacao", { ascending: false });

  if (!avisos || avisos.length === 0) return [];

  // Resolve segmento/plano/empresa(s) do usuário — mesma RPC usada em
  // resolverEmpresaAtual (src/lib/empresaAtual.ts). Admin (sem empresa
  // própria) só enxerga avisos sem alvo definido (pra todos).
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user.email });
  const idsEmpresa = (minhasEmpresasIds ?? []) as string[];

  let segmentosUsuario: string[] = [];
  let planosUsuario: string[] = [];
  if (idsEmpresa.length > 0) {
    const { data: empresasData } = await supabase.from("empresas").select("id, segmento, plano").in("id", idsEmpresa);
    segmentosUsuario = Array.from(new Set((empresasData ?? []).map((e) => e.segmento).filter(Boolean) as string[]));
    planosUsuario = Array.from(new Set((empresasData ?? []).map((e) => e.plano).filter(Boolean) as string[]));
  }

  const visiveis = avisos.filter((a) => {
    const segOk = !a.segmentos_alvo?.length || a.segmentos_alvo.some((s) => segmentosUsuario.includes(s));
    const planoOk = !a.planos_alvo?.length || a.planos_alvo.some((p) => planosUsuario.includes(p));
    const empresaOk = !a.empresas_alvo?.length || a.empresas_alvo.some((id) => idsEmpresa.includes(id));
    return segOk && planoOk && empresaOk;
  });

  const { data: leituras } = await supabase
    .from("comunicados_leituras")
    .select("comunicado_id")
    .eq("usuario_email", user.email);
  const lidosSet = new Set((leituras ?? []).map((l) => l.comunicado_id));

  return visiveis.map((a) => ({
    id: a.id,
    tipo: a.tipo as AvisoParaUsuario["tipo"],
    urgencia: a.urgencia as AvisoParaUsuario["urgencia"],
    titulo: a.titulo,
    resumo: a.resumo,
    corpo: a.corpo,
    imagem_path: a.imagem_path,
    fixado: a.fixado,
    data_publicacao: a.data_publicacao,
    data_expiracao: a.data_expiracao,
    lido: lidosSet.has(a.id),
  }));
}

// Fase 27.29 — mesma blindagem "falha vira 0" das demais contagens do
// layout (ver dashboard/layout.tsx): nunca derruba o dashboard inteiro.
export async function contarAvisosNaoLidosAcao(): Promise<number> {
  try {
    const avisos = await listarAvisosAcao();
    return avisos.filter((a) => !a.lido).length;
  } catch (e) {
    void logger.error("central-avisos", "Falha ao contar avisos não lidos (ignorado)", e);
    return 0;
  }
}

export async function marcarAvisoLidoAcao(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;
  await supabase
    .from("comunicados_leituras")
    .upsert({ comunicado_id: id, usuario_email: user.email }, { onConflict: "comunicado_id,usuario_email", ignoreDuplicates: true });
}
