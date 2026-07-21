"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizarNomeParaStorage } from "@/lib/storageUtils";

// Fase Central-Treinamento (20/07/2026) — CRUD do conteúdo de ajuda
// contextual (ícone "?") e das lições da Central de Treinamento, ambos
// guardados na mesma tabela conteudo_ajuda. RLS já restringe escrita a
// perfil_usuario_atual()='admin' — a checagem aqui é 2ª camada de defesa,
// mesmo padrão de /configuracoes, /assinaturas, /inteligencia-rede.

const BUCKET_IMAGENS = "treinamento-imagens";
const BUCKET_VIDEOS = "treinamento-videos";

export type ConteudoFormState = { erro?: string } | undefined;

async function garantirAdmin() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    throw new Error("Acesso restrito ao time administrador.");
  }
  return supabase;
}

function montarPayload(formData: FormData) {
  const perfisRaw = formData.getAll("perfis").map((v) => String(v)).filter(Boolean);
  return {
    chave: String(formData.get("chave") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "contextual"),
    modulo: String(formData.get("modulo") ?? "").trim() || null,
    ordem: Number(formData.get("ordem") ?? 0) || 0,
    titulo: String(formData.get("titulo") ?? "").trim(),
    texto: String(formData.get("texto") ?? "").trim(),
    perfis: perfisRaw.length > 0 ? perfisRaw : null,
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

// Mesma lógica de processarImagem, pro bucket de vídeo (Fase Central-
// Treinamento — Vídeo, 20/07/2026). Escopo restrito a lições (tipo='licao')
// é garantido no form (o input só aparece nesse caso) — aqui é só
// upload/substituição/remoção, sem checar tipo, então segue funcionando
// mesmo se o campo vier vazio pra ajuda contextual.
async function processarVideo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  videoPathAtual: string | null
): Promise<string | null | undefined> {
  const arquivo = formData.get("video");
  const removerVideo = formData.get("remover_video") === "on";

  if (removerVideo && videoPathAtual) {
    await supabase.storage.from(BUCKET_VIDEOS).remove([videoPathAtual]).catch(() => {});
    return null;
  }

  if (arquivo instanceof File && arquivo.size > 0) {
    const caminho = `${Date.now()}_${sanitizarNomeParaStorage(arquivo.name)}`;
    const { error } = await supabase.storage.from(BUCKET_VIDEOS).upload(caminho, arquivo, {
      contentType: arquivo.type || undefined,
    });
    if (error) {
      throw new Error(`Falha ao enviar vídeo: ${error.message}`);
    }
    // Best-effort: remove o vídeo antigo pra não acumular lixo no bucket.
    if (videoPathAtual) {
      await supabase.storage.from(BUCKET_VIDEOS).remove([videoPathAtual]).catch(() => {});
    }
    return caminho;
  }

  return undefined; // sem mudança
}

export async function criarConteudoAcao(_prev: ConteudoFormState, formData: FormData): Promise<ConteudoFormState> {
  let supabase;
  try {
    supabase = await garantirAdmin();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Acesso restrito." };
  }

  const payload = montarPayload(formData);
  if (!payload.chave || !payload.titulo || !payload.texto) {
    return { erro: "Chave, título e texto são obrigatórios." };
  }

  let imagemPath: string | null = null;
  try {
    const resultado = await processarImagem(supabase, formData, null);
    imagemPath = resultado ?? null;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar imagem." };
  }

  let videoPath: string | null = null;
  try {
    const resultado = await processarVideo(supabase, formData, null);
    videoPath = resultado ?? null;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar vídeo." };
  }

  const { error } = await supabase
    .from("conteudo_ajuda")
    .insert({ ...payload, imagem_path: imagemPath, video_path: videoPath });
  if (error) {
    return { erro: error.message.includes("duplicate") ? "Já existe uma entrada com essa chave." : error.message };
  }

  revalidatePath("/administracao/central-conteudo");
  redirect("/administracao/central-conteudo");
}

export async function atualizarConteudoAcao(
  id: number,
  _prev: ConteudoFormState,
  formData: FormData
): Promise<ConteudoFormState> {
  let supabase;
  try {
    supabase = await garantirAdmin();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Acesso restrito." };
  }

  const payload = montarPayload(formData);
  if (!payload.chave || !payload.titulo || !payload.texto) {
    return { erro: "Chave, título e texto são obrigatórios." };
  }

  const { data: atual } = await supabase
    .from("conteudo_ajuda")
    .select("imagem_path, video_path")
    .eq("id", id)
    .single();

  let imagemUpdate: { imagem_path?: string | null } = {};
  try {
    const resultado = await processarImagem(supabase, formData, atual?.imagem_path ?? null);
    if (resultado !== undefined) imagemUpdate = { imagem_path: resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar imagem." };
  }

  let videoUpdate: { video_path?: string | null } = {};
  try {
    const resultado = await processarVideo(supabase, formData, atual?.video_path ?? null);
    if (resultado !== undefined) videoUpdate = { video_path: resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao enviar vídeo." };
  }

  const { error } = await supabase
    .from("conteudo_ajuda")
    .update({
      ...payload,
      ...imagemUpdate,
      ...videoUpdate,
      atualizado_por: (await supabase.auth.getUser()).data.user?.email,
    })
    .eq("id", id);

  if (error) {
    return { erro: error.message };
  }

  revalidatePath("/administracao/central-conteudo");
  redirect("/administracao/central-conteudo");
}

export async function alternarAtivoConteudoAcao(id: number, ativo: boolean) {
  const supabase = await garantirAdmin();
  const { error } = await supabase.from("conteudo_ajuda").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/central-conteudo");
}

export async function excluirConteudoAcao(id: number) {
  const supabase = await garantirAdmin();
  const { data: atual } = await supabase
    .from("conteudo_ajuda")
    .select("imagem_path, video_path")
    .eq("id", id)
    .single();
  if (atual?.imagem_path) {
    await supabase.storage.from(BUCKET_IMAGENS).remove([atual.imagem_path]).catch(() => {});
  }
  if (atual?.video_path) {
    await supabase.storage.from(BUCKET_VIDEOS).remove([atual.video_path]).catch(() => {});
  }
  const { error } = await supabase.from("conteudo_ajuda").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/administracao/central-conteudo");
}
