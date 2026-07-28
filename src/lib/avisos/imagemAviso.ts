// Bucket público (comunicados-imagens) — URL pública é só concatenação, sem
// precisar de signed URL (mesmo racional de urlImagemTreinamento: imagem
// ilustrativa/banner, sem dado sensível de cliente real).
export function urlImagemAviso(caminho: string | null): string | null {
  if (!caminho) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/comunicados-imagens/${caminho}`;
}
