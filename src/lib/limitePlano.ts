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

// Fase Convite-Self-Service (26/07/2026, pedido do Daniel: "criar um
// convite self-service... respeitando max_usuarios") — mesmo espírito de
// verificarLimiteFrota acima, só que pra usuários. Ao contrário de
// max_veiculos (que usa uma RPC de contagem, porque a "frota real" soma
// fontes fora de cadastro_veiculos), a contagem de usuários é direta: só
// conta vínculos ATIVOS em usuarios_empresas da empresa exata (não expande
// pra empresas irmãs de grupo econômico — cada empresa tem seu próprio
// limite de assento). `max_usuarios` é lido direto de `empresas` (mantido
// em dia pelo webhook do Stripe/bootstrap), não da constante estática
// LIMITES_PLANO — mesma lógica de max_veiculos ser lido ao vivo.
export type LimiteUsuariosResultado =
  | { ok: true; quantidade: number; limite: number }
  | { ok: false; quantidade: number; limite: number; plano: string; nomeEmpresa: string };

export async function verificarLimiteUsuarios(
  supabase: SupabaseClient<Database>,
  empresaId: string
): Promise<LimiteUsuariosResultado> {
  const { data: empresa, error: erroEmpresa } = await supabase
    .from("empresas")
    .select("nome, plano, max_usuarios")
    .eq("id", empresaId)
    .single();

  const { count } = await supabase
    .from("usuarios_empresas")
    .select("user_email", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("ativo", true);
  const quantidade = count ?? 0;

  if (erroEmpresa || !empresa) return { ok: true, quantidade, limite: -1 }; // sem empresa resolvida, não bloqueia — outra camada já barra isso

  const limite = empresa.max_usuarios;
  if (limite === null || limite < 0) return { ok: true, quantidade, limite: -1 }; // ilimitado (enterprise) ou sem limite configurado

  if (quantidade >= limite) {
    return { ok: false, quantidade, limite, plano: empresa.plano, nomeEmpresa: empresa.nome };
  }
  return { ok: true, quantidade, limite };
}

export function mensagemLimiteUsuariosExcedido(r: Extract<LimiteUsuariosResultado, { ok: false }>): string {
  return (
    `${r.nomeEmpresa} já usa ${r.quantidade} de ${r.limite} vaga(s) de usuário do plano atual. ` +
    `Faça upgrade em Minha Assinatura para convidar mais colegas.`
  );
}

// Pedido do Daniel (18/07): Gestão de Fretes vira exclusividade do plano
// Enterprise — com uma exceção: continua liberada durante o período de
// trial self-service (status "trial", plano "gratuito" nesse momento — ver
// /cadastro/actions.ts), pra quem está avaliando a plataforma não perder a
// funcionalidade antes de decidir por um plano pago.
//
// Calibração TMS/ERP (23/07/2026, ajuste pedido pelo Daniel): o Profissional
// passa a incluir Gestão de Fretes também, só que com um limite de 30 fretes
// CRIADOS por mês (conta todo `fretes` com `criado_em` dentro do mês
// corrente, qualquer status — é um limite de uso/criação, não de fretes
// "ativos"). Enterprise continua ilimitado. Básico (Essencial) continua sem
// acesso nenhum, mesmo padrão de antes. Mesmo padrão de "best-effort" de
// verificarLimiteFrota acima: falha ao resolver a empresa não bloqueia
// (outra camada já barra isso).
export type AcessoFretesResultado =
  | { ok: true }
  | { ok: false; motivo: "plano"; plano: string; status: string }
  | { ok: false; motivo: "limite_mensal"; quantidade: number; limite: number };

// Quantos fretes o plano Profissional pode CRIAR por mês antes de bloquear
// (calibração TMS/ERP de 23/07/2026) — Enterprise não usa este limite.
export const LIMITE_FRETES_MENSAL_PROFISSIONAL = 30;

export async function verificarAcessoFretes(
  supabase: SupabaseClient<Database>,
  empresaId: string
): Promise<AcessoFretesResultado> {
  const { data: empresa, error } = await supabase
    .from("empresas")
    .select("plano, status")
    .eq("id", empresaId)
    .single();

  if (error || !empresa) return { ok: true };
  if (empresa.plano === "enterprise" || empresa.status === "trial") return { ok: true };

  if (empresa.plano === "profissional") {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count, error: erroContagem } = await supabase
      .from("fretes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .gte("criado_em", inicioMes.toISOString());

    // Falha ao contar não deve travar quem tem direito de usar — best-effort,
    // mesmo espírito de verificarLimiteFrota acima.
    if (erroContagem || count === null) return { ok: true };

    if (count >= LIMITE_FRETES_MENSAL_PROFISSIONAL) {
      return { ok: false, motivo: "limite_mensal", quantidade: count, limite: LIMITE_FRETES_MENSAL_PROFISSIONAL };
    }
    return { ok: true };
  }

  return { ok: false, motivo: "plano", plano: empresa.plano, status: empresa.status };
}

export function mensagemAcessoFretesBloqueado(r: Extract<AcessoFretesResultado, { ok: false }>): string {
  if (r.motivo === "limite_mensal") {
    return (
      `Seu plano Profissional já usou ${r.quantidade} de ${r.limite} fretes disponíveis este mês. ` +
      `O limite renova no início do próximo mês — ou faça upgrade para Enterprise em Minha Assinatura para fretes ilimitados.`
    );
  }
  return (
    "Gestão de Fretes é liberada a partir do plano Profissional (até 30 fretes/mês) ou Enterprise (ilimitado), " +
    "além do período de trial. Faça upgrade em Minha Assinatura para publicar novos fretes."
  );
}
