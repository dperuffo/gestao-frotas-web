// Bucket público (treinamento-imagens) — URL pública é só concatenação,
// sem precisar de signed URL (mesmo racional de LogoProvedor: imagem
// ilustrativa de UI, sem dado sensível de cliente real).
export function urlImagemTreinamento(caminho: string | null): string | null {
  if (!caminho) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/treinamento-imagens/${caminho}`;
}
