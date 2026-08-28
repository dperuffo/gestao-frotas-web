"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCPF } from "@/lib/utils";
import { empresaDonaDoVeiculoAcao } from "@/lib/empresasGrupo";
import { garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";
import {
  criarSolicitacaoAjuste,
  adicionarContrapropostaAjuste,
  decidirAjuste,
  cancelarAjuste,
  caminhoAbastecimento,
  type AutorAjuste,
  type CamposAjuste,
  type IdentificadorAbastecimento,
} from "@/lib/ajustesAbastecimentos";

export type AbastecimentoFormState = { erro?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Campos que o usuário preenche num lançamento manual. Os campos "técnicos"
// da integração (identificador, sync_key, item_tipo, status_autorizacao,
// importado_em, empresa_id) são preenchidos automaticamente pela action —
// quem lança manualmente não precisa entender essa parte.
function montarPayloadBase(formData: FormData) {
  const dataHora = String(formData.get("data_abastecimento") ?? "");

  return {
    data_abastecimento: dataHora ? new Date(dataHora).toISOString() : null,
    hodometro: numeroOuNull(formData.get("hodometro")),
    veiculo_placa: String(formData.get("veiculo_placa") ?? "").trim().toUpperCase() || null,
    motorista_nome: String(formData.get("motorista_nome") ?? "").trim() || null,
    motorista_cpf: normalizarCPF(String(formData.get("motorista_cpf") ?? "")),
    pv_razao_social: String(formData.get("pv_razao_social") ?? "").trim() || null,
    pv_municipio: String(formData.get("pv_municipio") ?? "").trim() || null,
    pv_uf: String(formData.get("pv_uf") ?? "").trim() || null,
    item_nome: String(formData.get("item_nome") ?? "").trim() || null,
    item_quantidade: numeroOuNull(formData.get("item_quantidade")),
    item_valor_unitario: numeroOuNull(formData.get("item_valor_unitario")),
    item_valor_total: numeroOuNull(formData.get("item_valor_total")),
  };
}

export async function criarAbastecimento(
  _prev: AbastecimentoFormState,
  formData: FormData
): Promise<AbastecimentoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "");
  const payload = montarPayloadBase(formData);

  if (!empresaId) {
    return { erro: "Cliente é obrigatório." };
  }

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("cnpj, nome")
    .eq("id", empresaId)
    .maybeSingle();
  if (empresaError || !empresa?.cnpj) {
    return { erro: "Não foi possível identificar o CNPJ do cliente selecionado." };
  }

  // Gera um "identificador" único (números negativos) para não colidir com os
  // IDs reais que vêm da integração com o PróFrotas.
  const { data: seq, error: seqError } = await supabase.rpc("nextval_identificador_manual");
  if (seqError || seq == null) {
    return { erro: "Não foi possível gerar o identificador do lançamento manual." };
  }
  const identificador = seq as number;

  // Fase Reuso-Operacional-Grupo (Fase 3) — se a placa lançada já tem
  // cadastro e pertence a uma empresa IRMÃ da "Cliente" escolhida no
  // formulário (ex.: lançamento feito na empresa B pra um veículo que é da
  // empresa A do mesmo grupo), o custo fica com a empresa DONA do veículo
  // — mesmo critério do trigger de profrotas_abastecimentos/Hub de
  // Integrações. cnpj_frota/frota_cnpj/frota_razao_social continuam
  // refletindo a empresa escolhida no formulário (quem está reportando).
  const empresaDonaVeiculo = payload.veiculo_placa
    ? await empresaDonaDoVeiculoAcao(supabase, payload.veiculo_placa)
    : null;
  const empresaIdAbastecimento = empresaDonaVeiculo ?? empresaId;

  const { data, error } = await supabase
    .from("profrotas_abastecimentos")
    .insert({
      ...payload,
      cnpj_frota: empresa.cnpj,
      frota_cnpj: empresa.cnpj,
      frota_razao_social: empresa.nome,
      empresa_id: empresaIdAbastecimento,
      identificador,
      sync_key: `manual-${identificador}`,
      abastecimento_estornado: 0,
      status_autorizacao: 1,
      item_tipo: 1,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  // Fase CPF-obrigatorio-fonte (28/08/2026) — mesmo caminho da importação
  // por planilha e da sincronização PróFrotas: garante que o motorista
  // lançado aqui também exista no cadastro, já com CPF quando informado.
  if (payload.motorista_nome) {
    await garantirMotoristaCadastrado(supabase, empresaIdAbastecimento, {
      nomeCompleto: payload.motorista_nome,
      cpf: payload.motorista_cpf,
    });
  }

  revalidatePath("/abastecimentos");
  redirect(`/abastecimentos/${data.id}`);
}

export async function atualizarAbastecimento(
  id: number,
  _prev: AbastecimentoFormState,
  formData: FormData
): Promise<AbastecimentoFormState> {
  const supabase = await createClient();
  const payload = montarPayloadBase(formData);

  const { error } = await supabase.from("profrotas_abastecimentos").update(payload).eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/abastecimentos");
  revalidatePath(`/abastecimentos/${id}`);
  return { erro: undefined };
}

export async function excluirAbastecimento(id: number) {
  const supabase = await createClient();
  await supabase.from("profrotas_abastecimentos").delete().eq("id", id);
  revalidatePath("/abastecimentos");
}

// Fase 27.65 — solicitação de ajuste em abastecimentos, com aprovação da
// contraparte (cliente <-> posto). Só existe quando o abastecimento TEM uma
// contraparte identificada (cliente e posto cadastrados na plataforma) — ver
// resolverContraparteAjuste em abastecimentos/[id]/page.tsx; sem isso, a
// edição continua direta (atualizarAbastecimento acima), sem aprovação.

export type AjusteFormState = { erro?: string } | undefined;

function lerCamposAjuste(formData: FormData): CamposAjuste {
  const dataHora = String(formData.get("data_abastecimento") ?? "").trim();
  const hodometro = String(formData.get("hodometro") ?? "").trim();
  const itemNome = String(formData.get("item_nome") ?? "").trim();
  const quantidade = String(formData.get("item_quantidade") ?? "").trim();
  const valorUnitario = String(formData.get("item_valor_unitario") ?? "").trim();
  const valorTotal = String(formData.get("item_valor_total") ?? "").trim();

  return {
    data_abastecimento: dataHora ? new Date(dataHora).toISOString() : undefined,
    hodometro: hodometro ? Number(hodometro) : undefined,
    item_nome: itemNome || undefined,
    item_quantidade: quantidade ? Number(quantidade) : undefined,
    item_valor_unitario: valorUnitario ? Number(valorUnitario) : undefined,
    item_valor_total: valorTotal ? Number(valorTotal) : undefined,
  };
}

export async function solicitarAjusteAcao(
  identificador: IdentificadorAbastecimento,
  empresaClienteId: string,
  empresaPostoId: string,
  autor: AutorAjuste,
  _prev: AjusteFormState,
  formData: FormData
): Promise<AjusteFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const campos = lerCamposAjuste(formData);
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  // Fase 27.70 — snapshot do valor total ATUAL (antes do ajuste), enviado
  // pelo formulário via campo oculto (ver FormularioSolicitarAjuste.tsx).
  // Usado só pra calcular o impacto financeiro dos ajustes aceitos nos
  // dashboards; não é o valor proposto, é o valor de ANTES.
  const valorOriginal = numeroOuNull(formData.get("valor_original_total"));

  const resultado = await criarSolicitacaoAjuste(supabase, {
    identificador,
    empresaClienteId,
    empresaPostoId,
    autor,
    campos,
    motivo,
    criadoPor: user?.email ?? null,
    valorOriginal,
  });

  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(caminhoAbastecimento(identificador));
  return {};
}

export async function contrapropostaAjusteAcao(
  ajusteId: string,
  identificador: IdentificadorAbastecimento,
  autor: AutorAjuste,
  _prev: AjusteFormState,
  formData: FormData
): Promise<AjusteFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const campos = lerCamposAjuste(formData);
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  const resultado = await adicionarContrapropostaAjuste(supabase, {
    ajusteId,
    autor,
    campos,
    motivo,
    decididoPor: user?.email ?? null,
  });

  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(caminhoAbastecimento(identificador));
  return {};
}

export async function decidirAjusteAcao(
  ajusteId: string,
  identificador: IdentificadorAbastecimento,
  decisao: "aceita" | "recusada"
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await decidirAjuste(supabase, { ajusteId, decisao, decididoPor: user?.email ?? null });
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath("/abastecimentos");
  revalidatePath(caminhoAbastecimento(identificador));
  return {};
}

export async function cancelarAjusteAcao(
  ajusteId: string,
  identificador: IdentificadorAbastecimento
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await cancelarAjuste(supabase, ajusteId, user?.email ?? null);
  if ("erro" in resultado) return { erro: resultado.erro };

  revalidatePath(caminhoAbastecimento(identificador));
  return {};
}

// Badge do menu (layout.tsx) — conta ajustes de abastecimento aguardando
// resposta DESTE usuário. Mesmo espírito de contarNegociacoesPendentesAcao
// (negociacoes/actions.ts), mas SEM branch de admin: a RLS de
// ajustes_abastecimentos não dá bypass nenhum (decisão do Daniel — ajuste é
// sempre só entre cliente e posto), então a contagem já sai certa sozinha —
// quem não é parte de nenhum ajuste (inclusive admin) naturalmente vê 0.
export async function contarAjustesAbastecimentosPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const statusQueMeCabeResponder = perfil === "posto" ? "pendente_posto" : "pendente_cliente";

  const { count } = await supabase
    .from("ajustes_abastecimentos")
    .select("id", { count: "exact", head: true })
    .eq("status", statusQueMeCabeResponder);

  return count ?? 0;
}
