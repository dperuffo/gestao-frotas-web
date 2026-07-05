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
  const resultado = await cancelarNegociacao(supabase, negociacaoId);
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(`/negociacoes/${negociacaoId}`);
  revalidatePath("/negociacoes");
  return {};
}

// Badge do menu (layout.tsx) — conta negociações aguardando resposta DESTE
// usuário, nos dois papéis possíveis (como cliente e como posto — um
// mesmo usuário não costuma ser os dois, mas a consulta cobre ambos os
// casos sem precisar saber de antemão qual é o perfil de quem está logado).
export async function contarNegociacoesPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return 0;

  const { data: minhasEmpresas } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", user.email);
  const ids = (minhasEmpresas ?? []).map((e) => e.empresa_id);
  if (ids.length === 0) return 0;

  const [{ count: comoCliente }, { count: comoPosto }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente_cliente")
      .in("empresa_cliente_id", ids),
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente_posto")
      .in("empresa_posto_id", ids),
  ]);

  return (comoCliente ?? 0) + (comoPosto ?? 0);
}
