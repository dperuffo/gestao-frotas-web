import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ClienteSupabase = SupabaseClient<Database>;

// Fase Parcerias Locais (17/07) — imagens dos benefícios do catálogo de
// fidelidade "Estrada que Cuida", pra virarem card de voucher (posto,
// cliente e app do motorista). Bucket PÚBLICO (diferente de
// documentos-empresas) — guardamos a URL pública direto na coluna
// imagem_url, sem precisar gerar signed URL a cada leitura (o app Flutter
// do motorista também consome essa URL direto).

export const BUCKET_FIDELIDADE_IMAGENS = "fidelidade-imagens";

function caminhoImagem(empresaId: string, nomeOriginal: string): string {
  const ponto = nomeOriginal.lastIndexOf(".");
  const ext = ponto >= 0 ? nomeOriginal.slice(ponto) : "";
  // Não precisa remover acentos à parte — qualquer caractere fora de
  // a-z0-9 (acentuado ou não) já cai no replace abaixo e vira "-".
  const base = nomeOriginal
    .slice(0, ponto >= 0 ? ponto : undefined)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  return `${empresaId}/${Date.now()}-${base || "imagem"}${ext}`;
}

export async function enviarImagemBeneficio(
  supabase: ClienteSupabase,
  params: { empresaId: string; arquivo: File }
): Promise<{ url: string } | { erro: string }> {
  if (params.arquivo.size === 0) return { erro: "Selecione uma imagem." };
  if (params.arquivo.size > 3 * 1024 * 1024) return { erro: "Imagem grande demais (máximo 3 MB)." };
  if (!params.arquivo.type.startsWith("image/")) return { erro: "Envie um arquivo de imagem (JPG, PNG...)." };

  const path = caminhoImagem(params.empresaId, params.arquivo.name);
  const bytes = await params.arquivo.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET_FIDELIDADE_IMAGENS)
    .upload(path, bytes, { contentType: params.arquivo.type, upsert: true });
  if (error) return { erro: `Não foi possível enviar a imagem: ${error.message}` };

  const { data } = supabase.storage.from(BUCKET_FIDELIDADE_IMAGENS).getPublicUrl(path);
  return { url: data.publicUrl };
}
