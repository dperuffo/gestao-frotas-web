"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sincronizarProfrotas, validarTokenProfrotas, type ResultadoSync, type ResultadoValidacao } from "@/lib/profrotas";
import { normalizarCNPJ } from "@/lib/utils";
import { verificarLimiteFrota, mensagemLimiteExcedido } from "@/lib/limitePlano";

export type ChaveFormState = { erro?: string; sucesso?: string } | undefined;

// Só testa o token contra a API PróFrotas — não grava nada. Usado pelo
// botão "Validar" do formulário, antes do usuário confirmar o cadastro.
export async function validarTokenAcao(token: string): Promise<ResultadoValidacao> {
  if (!token.trim()) return { ok: false, mensagem: "Informe o token." };
  return validarTokenProfrotas(token.trim());
}

// Cadastra (ou atualiza, se o CNPJ já existir) a chave de acesso de um
// cliente. O CNPJ precisa corresponder a uma empresa já cadastrada em
// /clientes — senão a chave ficaria com empresa_id nulo e invisível pro
// próprio cliente (só admin enxergaria), então validamos isso aqui antes de
// gravar, com uma mensagem clara em vez de deixar o RLS barrar silenciosamente.
export async function salvarChaveAcao(_prev: ChaveFormState, formData: FormData): Promise<ChaveFormState> {
  const supabase = await createClient();

  const cnpjFrota = normalizarCNPJ(String(formData.get("cnpj_frota") ?? ""));
  const nomeEmpresa = String(formData.get("nome_empresa") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (cnpjFrota.length !== 14) return { erro: "CNPJ inválido — informe os 14 caracteres." };
  if (!nomeEmpresa) return { erro: "Nome da empresa é obrigatório." };
  if (!token) return { erro: "Token JWT é obrigatório." };

  const { data: empresaId, error: erroLookup } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: cnpjFrota });
  if (erroLookup) return { erro: `Não foi possível validar o CNPJ: ${erroLookup.message}` };
  if (!empresaId) {
    return {
      erro: "Esse CNPJ não corresponde a nenhum cliente cadastrado em /clientes. Cadastre o cliente primeiro.",
    };
  }

  const agora = new Date().toISOString();
  const { error } = await supabase.from("profrotas_api_keys").upsert(
    {
      cnpj_frota: cnpjFrota,
      nome_empresa: nomeEmpresa,
      token,
      ativo: true,
      data_cadastro: agora,
      data_inicio_sync: agora,
      registros_sync: 0,
    },
    { onConflict: "cnpj_frota" }
  );

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/integracoes");
  return { sucesso: "Chave salva com sucesso." };
}

export async function alternarAtivoAcao(id: number, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("profrotas_api_keys").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/integracoes");
}

export async function removerChaveAcao(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("profrotas_api_keys").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/integracoes");
}

// Sincronização manual, disparada pelo usuário na tela — roda com o client
// da própria sessão (RLS garante que só sincroniza chaves que o usuário
// pode ver: a própria empresa, ou qualquer uma se for admin).
export async function sincronizarAgoraAcao(cnpjFrota: string, dataInicio?: string): Promise<ResultadoSync> {
  const supabase = await createClient();
  const cnpj = normalizarCNPJ(cnpjFrota);

  const { data: chave, error } = await supabase
    .from("profrotas_api_keys")
    .select("token, data_inicio_sync")
    .eq("cnpj_frota", cnpj)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!chave) throw new Error("Chave não encontrada (ou sem permissão para vê-la).");

  // Fase 27.41 — achado real (levantado pelo Daniel): nada impedia um
  // cliente no plano gratuito de sincronizar uma frota gigante via API sem
  // nunca precisar assinar um plano compatível. Antes de rodar o sync,
  // barra aqui se a frota REAL (cadastro + placas já vistas na integração)
  // já estiver acima do limite do plano atual.
  const { data: empresaId } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: cnpj });
  if (empresaId) {
    const limite = await verificarLimiteFrota(supabase, empresaId);
    if (!limite.ok) throw new Error(mensagemLimiteExcedido(limite));
  }

  const inicio = dataInicio
    ? new Date(`${dataInicio}T00:00:00Z`).toISOString().slice(0, 19) + "Z"
    : new Date(chave.data_inicio_sync).toISOString().slice(0, 19) + "Z";

  const resultado = await sincronizarProfrotas(supabase, { cnpjFrota: cnpj, token: chave.token, dataInicio: inicio });
  revalidatePath("/integracoes");
  return resultado;
}
