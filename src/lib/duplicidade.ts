// Fase tratamento-cnpj-cpf (27/07/2026, pergunta do Daniel sobre unicidade de
// CPF/CNPJ/e-mail/telefone). Aviso NÃO BLOQUEANTE — não impede o cadastro,
// só avisa que aquele CPF já existe em outra conta (evita a mesma pessoa
// acumular contas duplicadas, inclusive contornando max_usuarios). Chama a
// RPC usuario_app_cpf_duplicado (SECURITY DEFINER — a RLS de usuarios_app
// não libera ver linhas de colegas pra quem não é admin/analista, então sem
// bypass o aviso nunca dispararia pra quem convida via /minha-equipe).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function cpfDuplicadoUsuarioApp(
  supabase: SupabaseClient<Database>,
  cpf: string,
  excluirEmail?: string
): Promise<boolean> {
  const cpfLimpo = cpf.replace(/\D/g, "");
  if (!cpfLimpo) return false;
  const { data } = await supabase.rpc("usuario_app_cpf_duplicado", {
    p_cpf: cpf,
    p_excluir_email: excluirEmail ?? undefined,
  });
  return data === true;
}
