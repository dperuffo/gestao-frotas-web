"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Fretes (Fase Fretes) — mecanismo de contratação de frete entre cliente e
// motorista, dois modos:
//   - Direto: cliente já define o motorista (próprio, via `empresa_id`, ou
//     agregado/terceiro, via empresas_motoristas_parceiros ativo) — frete
//     nasce com status "aguardando_confirmacao", só o motorista escolhido
//     vê, sem negociação (valor já combinado).
//   - Mercado aberto: cliente não define motorista — frete nasce
//     "disponivel", visível pra rede toda, com negociação de valor
//     (fretes_negociacoes/fretes_negociacoes_rodadas, RPCs SECURITY DEFINER).
// Mesmo padrão de autorização de /parcerias-locais: RLS já protege de
// verdade, esta checagem só devolve mensagem amigável antes de bater nela.

export type FreteFormState = { erro?: string } | undefined;

async function empresaPertenceAoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

export async function criarFrete(empresaId: string, _prev: FreteFormState, formData: FormData): Promise<FreteFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para publicar fretes nesta empresa." };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const origemLabel = String(formData.get("origem_label") ?? "").trim();
  const origemLat = Number(formData.get("origem_lat") ?? "");
  const origemLon = Number(formData.get("origem_lon") ?? "");
  const destinoLabel = String(formData.get("destino_label") ?? "").trim();
  const destinoLat = Number(formData.get("destino_lat") ?? "");
  const destinoLon = Number(formData.get("destino_lon") ?? "");
  const tipoCarga = String(formData.get("tipo_carga") ?? "").trim() || null;
  const pesoCargaRaw = String(formData.get("peso_carga_kg") ?? "").trim();
  const pesoCarga = pesoCargaRaw ? Number(pesoCargaRaw) : null;
  const dataSaida = String(formData.get("data_saida_prevista") ?? "").trim() || null;
  const prazoEntrega = String(formData.get("prazo_entrega") ?? "").trim() || null;
  const kmEstimadoRaw = String(formData.get("km_estimado") ?? "").trim();
  const kmEstimado = kmEstimadoRaw ? Number(kmEstimadoRaw) : null;
  const valorOferecido = Number(formData.get("valor_oferecido") ?? "");
  const motoristaId = String(formData.get("motorista_id") ?? "").trim() || null;

  if (!titulo) return { erro: "Título é obrigatório." };
  if (!origemLabel || !Number.isFinite(origemLat) || !Number.isFinite(origemLon)) {
    return { erro: "Escolha a origem na lista de sugestões." };
  }
  if (!destinoLabel || !Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) {
    return { erro: "Escolha o destino na lista de sugestões." };
  }
  if (!Number.isFinite(valorOferecido) || valorOferecido <= 0) {
    return { erro: "Informe um valor de frete válido." };
  }
  if (pesoCargaRaw && (!Number.isFinite(pesoCarga) || (pesoCarga as number) <= 0)) {
    return { erro: "Peso da carga precisa ser maior que zero." };
  }

  // Modo direto exige que o motorista escolhido seja próprio (empresa_id
  // igual) ou parceiro ativo — a RLS não valida isso sozinha (motorista_id
  // é só uma FK solta), então checamos aqui antes de gravar.
  if (motoristaId) {
    const { data: proprio } = await supabase
      .from("motoristas")
      .select("id")
      .eq("id", motoristaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!proprio) {
      const { data: parceiro } = await supabase
        .from("empresas_motoristas_parceiros")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("motorista_id", motoristaId)
        .eq("status", "ativo")
        .maybeSingle();
      if (!parceiro) {
        return { erro: "Esse motorista não é da sua empresa nem um parceiro ativo." };
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fretes").insert({
    empresa_id: empresaId,
    titulo,
    descricao,
    origem_label: origemLabel,
    origem_lat: origemLat,
    origem_lon: origemLon,
    destino_label: destinoLabel,
    destino_lat: destinoLat,
    destino_lon: destinoLon,
    tipo_carga: tipoCarga,
    peso_carga_kg: pesoCarga,
    data_saida_prevista: dataSaida,
    prazo_entrega: prazoEntrega,
    km_estimado: kmEstimado,
    valor_oferecido: valorOferecido,
    motorista_id: motoristaId,
    status: motoristaId ? "aguardando_confirmacao" : "disponivel",
    criado_por: user?.email ?? null,
  });
  if (error) return { erro: `Não foi possível publicar o frete: ${error.message}` };

  revalidatePath("/fretes");
  redirect(`/fretes?empresa=${empresaId}`);
}

export async function cancelarFrete(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fretes").update({ status: "cancelado", atualizado_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/fretes");
}

// Reabre pro mercado (limpa motorista_id) — usado quando o motorista
// designado recusa o frete direto e o cliente prefere abrir pra rede.
export async function reabrirFreteParaMercado(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase
    .from("fretes")
    .update({ motorista_id: null, status: "disponivel", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/fretes");
}

export async function aceitarPropostaAcao(negociacaoId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("aceitar_negociacao_frete", { p_negociacao_id: negociacaoId });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

export async function recusarPropostaAcao(negociacaoId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("recusar_negociacao_frete", { p_negociacao_id: negociacaoId });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

export async function contraporPropostaAcao(negociacaoId: string, empresaId: string, valor: number, mensagem: string | null) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("propor_rodada_negociacao", {
    p_negociacao_id: negociacaoId,
    p_valor_proposto: valor,
    p_mensagem: mensagem,
  });
  if (error) return { erro: error.message };
  revalidatePath("/fretes");
}

// Fase Fretes B — postos recomendados, linha do tempo e avaliação.

export async function adicionarPostoRecomendadoAcao(
  freteId: string,
  empresaId: string,
  formData: FormData
): Promise<{ erro?: string } | undefined> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const nomePosto = String(formData.get("nome_posto") ?? "").trim();
  const itemCatalogoId = String(formData.get("item_catalogo_id") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!nomePosto) return { erro: "Digite o nome do posto." };

  const { error } = await supabase.from("fretes_postos_recomendados").insert({
    frete_id: freteId,
    nome_posto: nomePosto,
    item_catalogo_id: itemCatalogoId,
    observacao,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/fretes/${freteId}`);
}

export async function removerPostoRecomendadoAcao(id: string, freteId: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fretes_postos_recomendados").delete().eq("id", id);
  revalidatePath(`/fretes/${freteId}`);
}

export async function avaliarMotoristaAcao(freteId: string, empresaId: string, estrelas: number, comentario: string | null) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };
  const { error } = await supabase.rpc("avaliar_frete", {
    p_frete_id: freteId,
    p_estrelas: estrelas,
    p_comentario: comentario,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/fretes/${freteId}`);
}
