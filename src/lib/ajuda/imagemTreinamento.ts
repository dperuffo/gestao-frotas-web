// Bucket público (treinamento-imagens) — URL pública é só concatenação,
// sem precisar de signed URL (mesmo racional de LogoProvedor: imagem
// ilustrativa de UI, sem dado sensível de cliente real).
export function urlImagemTreinamento(caminho: string | null): string | null {
  if (!caminho) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/treinamento-imagens/${caminho}`;
}

// Mesmo racional do helper acima, mas pro bucket treinamento-videos (Fase
// Central-Treinamento — Vídeo, 20/07/2026): pílula de vídeo anexada a cada
// lição, bucket público separado do de imagens por causa do tamanho/mime
// type do arquivo.
export function urlVideoTreinamento(caminho: string | null): string | null {
  if (!caminho) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/treinamento-videos/${caminho}`;
}
