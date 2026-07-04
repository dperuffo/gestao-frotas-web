import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.41 — achado real (levantado pelo Daniel): o limite de veículos do
// plano nunca era verificado em lugar nenhum — só exibido como "X / Y" na
// tela de Assinatura, sem bloquear nada. Prova real encontrada: a empresa de
// teste tem 2357 veículos cadastrados e segue no plano gratuito (limite 10).
//
// Este helper centraliza a checagem: conta a frota REAL da empresa (RPC
// `contar_veiculos_reais_empresa`, que soma veículos cadastrados + placas
// distintas vistas nos abastecimentos da integração, mesmo sem cadastro
// formal — decisão confirmada com o Daniel) e compara com
// `empresas.max_veiculos` (mantido em dia pelo webhook do Stripe a cada
// upgrade/downgrade). `max_veiculos < 0` = ilimitado (plano enterprise).
export type LimiteFrotaResultado =
  | { ok: true }
  | { ok: false; quantidade: number; limite: number; plano: string; nomeEmpresa: string };

export async function verificarLimiteFrota(
  supabase: SupabaseClient<Database>,
  empresaId: string
): Promise<LimiteFrotaResultado> {
  const { data: empresa, error: erroEmpresa } = await supabase
    .from("empresas")
    .select("nome, plano, max_veiculos, bypass_limite_frota")
    .eq("id", empresaId)
    .single();

  if (erroEmpresa || !empresa) return { ok: true }; // sem empresa resolvida, não bloqueia — outra camada já barra isso

  // Fase 27.42 — flag de uso interno/teste (editável só por admin em
  // /clientes/[id]) pra empresas de teste do próprio Daniel continuarem
  // liberadas mesmo acima do limite do plano, sem precisar inflar
  // plano/max_veiculos (o que mascararia o comportamento real do plano
  // gratuito no teste).
  if (empresa.bypass_limite_frota) return { ok: true };

  const limite = empresa.max_veiculos;
  if (limite === null || limite < 0) return { ok: true }; // ilimitado (enterprise) ou sem limite configurado

  const { data: quantidade, error: erroContagem } = await supabase.rpc("contar_veiculos_reais_empresa", {
    p_empresa_id: empresaId,
  });
  if (erroContagem || quantidade === null) return { ok: true }; // falha ao contar não deve travar o sync — best-effort

  if (quantidade > limite) {
    return { ok: false, quantidade, limite, plano: empresa.plano, nomeEmpresa: empresa.nome };
  }
  return { ok: true };
}

export function mensagemLimiteExcedido(r: Extract<LimiteFrotaResultado, { ok: false }>): string {
  return (
    `A frota de ${r.nomeEmpresa} já soma ${r.quantidade} veículo(s), acima do limite de ${r.limite} do plano ` +
    `atual. Faça upgrade em Minha Assinatura antes de continuar a sincronização.`
  );
}
