"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarCNPJ } from "@/lib/utils";
import {
  criarNegociacao,
  adicionarContraproposta,
  decidirNegociacao,
  cancelarNegociacao,
  type AutorNegociacao,
  type DadosRodada,
} from "@/lib/negociacoesPostos";

// Fase 27.50 — Negociação com Postos Revendedores. As Server Actions abaixo
// atendem tanto a tela do CLIENTE (CRUD completo: cria, envia contraproposta,
// aceita/recusa, cancela) quanto a tela do POSTO (quando ele acessa pela UI,
// além de usar a API em /api/integracoes/negociacoes/*). A máquina de estados
// em si mora em src/lib/negociacoesPostos.ts, compartilhada com a API.

type EstadoFormulario = { erro?: string };

function lerDadosRodada(formData: FormData): DadosRodada {
  return {
    combustivel: String(formData.get("combustivel") ?? ""),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    vigencia_fim: String(formData.get("vigencia_fim") ?? ""),
    volume_minimo_mensal: Number(formData.get("volume_minimo_mensal")),
    preco_unitario: Number(formData.get("preco_unitario")),
  };
}

// Cria uma negociação nova. Quando quem cria é o cliente, informa o CNPJ do
// posto-alvo (campo "posto_cnpj" do form); quando é o posto, informa o CNPJ
// do cliente-alvo (campo "cliente_cnpj"). O outro lado da negociação é
// resolvido via empresa_id_do_cnpj — se ainda não existir como empresa
// cadastrada na FNI, a negociação é criada mesmo assim (fica com
// empresa_posto_id nulo), só não aparece na tela desse lado até ele existir.
export async function criarNegociacaoAcao(
  empresaAtualId: string,
  souPosto: boolean,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!empresaAtualId) return { erro: "Selecione uma empresa antes de criar a negociação." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cnpjAlvo = normalizarCNPJ(String(formData.get(souPosto ? "cliente_cnpj" : "posto_cnpj") ?? ""));
  if (!cnpjAlvo) {
    return { erro: souPosto ? "Informe o CNPJ do cliente." : "Informe o CNPJ do posto." };
  }

  const { data: empresaAlvoId } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: cnpjAlvo });

  const dados = lerDadosRodada(formData);

  const resultado = await criarNegociacao(supabase, {
    empresaClienteId: souPosto ? (empresaAlvoId ?? "") : empresaAtualId,
    empresaPostoId: souPosto ? empresaAtualId : (empresaAlvoId ?? null),
    postoCnpj: souPosto ? "" : cnpjAlvo,
    origem: souPosto ? "posto" : "cliente",
    autor: souPosto ? "posto" : "cliente",
    dados,
    criadoPor: user?.email ?? null,
  });

  if ("erro" in resultado) return { erro: resultado.erro };
  if (souPosto && !empresaAlvoId) {
    return { erro: "Nenhum cliente encontrado com esse CNPJ. Confira se o cliente já é cadastrado na FNI." };
  }

  revalidatePath("/negociacoes");
  redirect(`/negociacoes/${resultado.id}`);
}

export async function enviarContrapropostaAcao(
  negociacaoId: string,
  autor: AutorNegociacao,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await adicionarContraproposta(supabase, {
    negociacaoId,
    autor,
    dados: lerDadosRodada(formData),
    decididoPor: user?.email ?? null,
  });

  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(`/negociacoes/${negociacaoId}`);
  revalidatePath("/negociacoes");
  return {};
}

export async function decidirNegociacaoAcao(
  negociacaoId: string,
  autor: AutorNegociacao,
  decisao: "aceita" | "recusada"
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await decidirNegociacao(supabase, {
    negociacaoId,
    autor,
    decisao,
    decididoPor: user?.email ?? null,
  });

  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(`/negociacoes/${negociacaoId}`);
  revalidatePath("/negociacoes");
  return {};
}

export async function cancelarNegociacaoAcao(negociacaoId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await cancelarNegociacao(supabase, negociacaoId, user?.email ?? null);
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(`/negociacoes/${negociacaoId}`);
  revalidatePath("/negociacoes");
  return {};
}

// Badge do menu (layout.tsx) — conta negociações aguardando resposta DESTE
// usuário.
//
// Fase 27.52 — achado real (reportado pelo Daniel): a bolinha nunca
// aparecia, nem pro cliente nem pro posto. Causa: esta função pré-filtrava
// via `usuarios_empresas` (SELECT explícito pra montar a lista de
// empresa_id do usuário) — mas um usuário ADMIN normalmente só tem uma
// linha própria em usuarios_empresas (a empresa "de casa" dele), e enxerga
// as DEMAIS empresas só através da regra "perfil admin" da RLS, não por
// vínculo em usuarios_empresas. Resultado: pra admin, `ids` nunca incluía a
// empresa do cliente/posto sendo testado, e a contagem sempre vinha 0.
//
// Corrigido pra seguir o MESMO padrão já usado em
// contarAnomaliasNaoRevisadasAcao/contarChamadosNaoVistosAcao: confia
// inteiramente na RLS de negociacoes_postos pra decidir quais linhas essa
// pessoa pode ver (as próprias, ou todas se for admin) — nada de montar
// lista de empresa_id manualmente. A única informação que falta pra saber
// SE é a vez desse usuário responder é o lado (cliente vs posto), que vem
// direto do perfil: perfil "posto" só participa como empresa_posto_id;
// qualquer outro perfil de negócio (gestor_frota/analista) só participa
// como empresa_cliente_id. Admin não é parte em nenhum negócio — pra ele, a
// bolinha mostra o total de negociações em aberto no sistema (mesmo
// espírito de monitoramento das demais bolinhas administrativas).
export async function contarNegociacoesPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil === "admin") {
    const { count } = await supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .in("status", ["pendente_cliente", "pendente_posto"]);
    return count ?? 0;
  }

  const statusQueMeCabeResponder = perfil === "posto" ? "pendente_posto" : "pendente_cliente";

  const { count } = await supabase
    .from("negociacoes_postos")
    .select("id", { count: "exact", head: true })
    .eq("status", statusQueMeCabeResponder);

  return count ?? 0;
}
