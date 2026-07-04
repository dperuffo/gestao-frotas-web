"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { alocarVeiculoCentroCusto } from "@/lib/centroCusto";

export type CentroCustoFormState = { erro?: string } | undefined;

export async function criarCentroCusto(
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const responsavel = String(formData.get("responsavel") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const empresaId = String(formData.get("empresa_id") ?? "").trim() || null;

  if (!nome) return { erro: "Nome do centro de custo é obrigatório." };
  if (!empresaId) return { erro: "Cliente é obrigatório." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("centros_custo")
    .insert({
      nome,
      codigo,
      responsavel,
      descricao,
      empresa_id: empresaId,
      ativo: true,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/centros-custo");
  redirect(`/centros-custo/${data.id}`);
}

export async function atualizarCentroCusto(
  id: string,
  _prev: CentroCustoFormState,
  formData: FormData
): Promise<CentroCustoFormState> {
  const supabase = await createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const responsavel = String(formData.get("responsavel") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const ativo = formData.get("ativo") === "on";

  if (!nome) return { erro: "Nome do centro de custo é obrigatório." };

  const { error } = await supabase
    .from("centros_custo")
    .update({ nome, codigo, responsavel, descricao, ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/centros-custo");
  revalidatePath(`/centros-custo/${id}`);
  return { erro: undefined };
}

// Aloca um veículo (por placa) a este centro de custo, preservando o
// histórico de alocações anteriores (ver src/lib/centroCusto.ts).
export async function alocarVeiculoAcao(centroCustoId: string, empresaId: string | null, placa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await alocarVeiculoCentroCusto(supabase, {
    placa,
    centroCustoId,
    empresaId,
    criadoPor: user?.email ?? undefined,
  });
  if (resultado.erro) throw new Error(resultado.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");
}

// Desaloca (remove) o veículo deste centro de custo, fechando a alocação
// ativa no histórico — o veículo fica sem centro de custo até ser realocado.
export async function desalocarVeiculoAcao(centroCustoId: string, empresaId: string | null, placa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await alocarVeiculoCentroCusto(supabase, {
    placa,
    centroCustoId: null,
    empresaId,
    criadoPor: user?.email ?? undefined,
  });
  if (resultado.erro) throw new Error(resultado.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");
}

// Fase 27.36 — achado real: cliente com frota grande tinha que alocar
// veículo por veículo (um select + um clique em "Alocar" por vez) — em
// centenas de veículos, isso é inviável na prática. As duas ações abaixo
// recebem uma LISTA de placas e alocam/desalocam todas de uma vez (a tela
// já resolve isso com busca + seleção múltipla, ver AlocarVeiculoForm.tsx).
// Reaproveita o mesmo helper `alocarVeiculoCentroCusto` (preserva o
// histórico por veículo, um a um), só que disparado em paralelo via
// Promise.all — o ganho não é menos chamadas ao banco, é menos cliques e
// menos viagens de rede (ida e volta) pro usuário.
export async function alocarVeiculosEmLoteAcao(centroCustoId: string, empresaId: string | null, placas: string[]) {
  if (placas.length === 0) return { erro: "Selecione pelo menos um veículo." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultados = await Promise.all(
    placas.map((placa) =>
      alocarVeiculoCentroCusto(supabase, { placa, centroCustoId, empresaId, criadoPor: user?.email ?? undefined })
    )
  );
  const falhas = resultados.filter((r) => r.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");

  if (falhas.length > 0) {
    return { erro: `${falhas.length} de ${placas.length} veículo(s) não puderam ser alocados: ${falhas[0].erro}` };
  }
  return {};
}

// Desalocação em lote — mesma ideia de alocarVeiculosEmLoteAcao, mas
// fechando a alocação (centroCustoId null) de todas as placas informadas.
export async function desalocarVeiculosEmLoteAcao(centroCustoId: string, empresaId: string | null, placas: string[]) {
  if (placas.length === 0) return { erro: "Selecione pelo menos um veículo." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultados = await Promise.all(
    placas.map((placa) =>
      alocarVeiculoCentroCusto(supabase, { placa, centroCustoId: null, empresaId, criadoPor: user?.email ?? undefined })
    )
  );
  const falhas = resultados.filter((r) => r.erro);

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/veiculos");

  if (falhas.length > 0) {
    return { erro: `${falhas.length} de ${placas.length} veículo(s) não puderam ser removidos: ${falhas[0].erro}` };
  }
  return {};
}

// Fase 27.36 — mesma alocação em massa, agora pra motoristas (pedido do
// Daniel: "assim também em motoristas em centros de custos"). Diferente de
// veículos, motoristas não têm tabela de histórico de alocação
// (centros_custo_motoristas não existe) — só a coluna `centro_custo_id` em
// `motoristas`, então é um único UPDATE em lote via `.in("id", ids)`, sem
// precisar de loop nem Promise.all.
export async function alocarMotoristasEmLoteAcao(centroCustoId: string, motoristaIds: string[]) {
  if (motoristaIds.length === 0) return { erro: "Selecione pelo menos um motorista." };
  const supabase = await createClient();

  const { error } = await supabase.from("motoristas").update({ centro_custo_id: centroCustoId }).in("id", motoristaIds);
  if (error) return { erro: `Não foi possível alocar: ${error.message}` };

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/motoristas");
  return {};
}

export async function desalocarMotoristasEmLoteAcao(centroCustoId: string, motoristaIds: string[]) {
  if (motoristaIds.length === 0) return { erro: "Selecione pelo menos um motorista." };
  const supabase = await createClient();

  const { error } = await supabase.from("motoristas").update({ centro_custo_id: null }).in("id", motoristaIds);
  if (error) return { erro: `Não foi possível remover: ${error.message}` };

  revalidatePath(`/centros-custo/${centroCustoId}`);
  revalidatePath("/motoristas");
  return {};
}
