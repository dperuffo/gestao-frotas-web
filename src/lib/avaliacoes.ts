// Avaliação da plataforma pelo cliente (estrelas 1-5 + observação livre),
// com espaço pro admin (time interno FNI) responder. A tabela já existia no
// banco (usada pelo app mobile Flutter) — só adicionamos as colunas de
// resposta e as policies de RLS (ver README, Fase 21).

export type Avaliacao = {
  id: string;
  empresa_id: string | null;
  user_email: string;
  estrelas: number;
  comentario: string | null;
  resposta_admin: string | null;
  respondido_por: string | null;
  respondido_em: string | null;
  criado_em: string | null;
};

export const NOTA_MAXIMA = 5;

export function rotuloNota(estrelas: number): string {
  if (estrelas >= 5) return "Excelente";
  if (estrelas === 4) return "Muito boa";
  if (estrelas === 3) return "Razoável";
  if (estrelas === 2) return "Ruim";
  return "Muito ruim";
}
