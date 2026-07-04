"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import type { Json } from "@/types/database.types";
import type { RotogramaParada, RotogramaRisco } from "./tipos";

export type RotogramaFormState = { erro?: string } | undefined;

function parseItens<T>(formData: FormData, prefixo: string): T[] {
  // Os campos dinâmicos de risco/parada chegam como
  // `${prefixo}[0][local]`, `${prefixo}[0][categoria]`, ... — reconstruímos
  // a lista aqui em vez de usar um array serializado, para o form continuar
  // funcionando sem JS (progressive enhancement básico) e ficar simples de
  // debugar no DevTools.
  const indices = new Set<number>();
  for (const chave of formData.keys()) {
    const m = chave.match(new RegExp(`^${prefixo}\\[(\\d+)\\]`));
    if (m) indices.add(Number(m[1]));
  }
  const ordenados = Array.from(indices).sort((a, b) => a - b);
  const itens: T[] = [];
  for (const i of ordenados) {
    const local = String(formData.get(`${prefixo}[${i}][local]`) ?? "").trim();
    const categoria = String(formData.get(`${prefixo}[${i}][categoria]`) ?? "").trim();
    const descricao = String(formData.get(`${prefixo}[${i}][descricao]`) ?? "").trim();
    const kmBruto = String(formData.get(`${prefixo}[${i}][km]`) ?? "").trim();
    const km = kmBruto ? Number(kmBruto.replace(",", ".")) : null;
    if (!local && !descricao) continue; // linha vazia (usuário adicionou e não preencheu) — ignora
    itens.push({ local, categoria, descricao, km: km !== null && Number.isFinite(km) ? km : null } as T);
  }
  return itens;
}

function montarPayload(formData: FormData) {
  return {
    origem: String(formData.get("origem") ?? "").trim() || null,
    destino: String(formData.get("destino") ?? "").trim() || null,
    veiculo: String(formData.get("veiculo") ?? "").trim() || null,
    motorista: String(formData.get("motorista") ?? "").trim() || null,
    placa: String(formData.get("placa") ?? "").trim() || null,
    data_viagem: String(formData.get("data_viagem") ?? "").trim() || null,
    carga: String(formData.get("carga") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    riscos: parseItens<RotogramaRisco>(formData, "riscos") as unknown as Json,
    paradas: parseItens<RotogramaParada>(formData, "paradas") as unknown as Json,
  };
}

export async function criarRotogramaAcao(_prev: RotogramaFormState, formData: FormData): Promise<RotogramaFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "") || null;
  const payload = montarPayload(formData);

  if (!payload.origem || !payload.destino) {
    return { erro: "Origem e destino são obrigatórios." };
  }
  if (!empresaId) {
    return { erro: "Selecione o cliente." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const { data, error } = await supabase
    .from("rotogramas")
    .insert({ ...payload, empresa_id: empresaId, user_email: user.email })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/rotograma");
  redirect(`/rotograma/${data.id}`);
}

export async function atualizarRotogramaAcao(
  id: string,
  _prev: RotogramaFormState,
  formData: FormData
): Promise<RotogramaFormState> {
  const supabase = await createClient();
  const payload = montarPayload(formData);

  if (!payload.origem || !payload.destino) {
    return { erro: "Origem e destino são obrigatórios." };
  }

  const { error } = await supabase
    .from("rotogramas")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/rotograma");
  revalidatePath(`/rotograma/${id}`);
  redirect(`/rotograma/${id}`);
}

export async function excluirRotogramaAcao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rotogramas").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };
  revalidatePath("/rotograma");
  redirect("/rotograma");
}

export type OpcaoMotoristaRotograma = { id: string; nome: string };
export type OpcaoVeiculoRotograma = { id: string; placa: string; descricao: string | null };

// Lista os motoristas e veículos ativos cadastrados do cliente selecionado
// no formulário — alimenta os selects de "Motorista" e "Placa", em vez de
// digitação livre. cadastro_veiculos não tem empresa_id (o vínculo é por
// cnpj_frota) — usamos a RPC `veiculos_da_empresa`, que resolve isso no
// banco com a mesma normalização (só alfanuméricos, maiúsculo) já usada
// pela RLS da tabela via `empresa_id_do_cnpj`. Comparar `cnpj_frota` direto
// com `empresas.cnpj` via `.eq()` não funciona: `empresas.cnpj` sempre vem
// pontuado ("25.265.787/0001-44"), enquanto `cadastro_veiculos.cnpj_frota`
// tem registros com e sem pontuação — achado real testando este formulário.
export async function listarMotoristasEVeiculosAcao(empresaId: string): Promise<{
  motoristas: OpcaoMotoristaRotograma[];
  veiculos: OpcaoVeiculoRotograma[];
}> {
  if (!empresaId) return { motoristas: [], veiculos: [] };
  const supabase = await createClient();

  // Fase 27.38 — buscarTodosVeiculosDaEmpresa pagina a RPC em lotes de 1000
  // (limite padrão de resposta do Supabase/PostgREST) — sem isso, clientes
  // com mais de 1000 veículos só viam parte da frota neste select.
  const [{ data: motoristas }, { data: veiculos }] = await Promise.all([
    supabase
      .from("motoristas")
      .select("id, nome_completo")
      .eq("empresa_id", empresaId)
      .eq("status", "Ativo")
      .order("nome_completo"),
    buscarTodosVeiculosDaEmpresa(supabase, empresaId),
  ]);

  const veiculosAtivosOrdenados = (veiculos ?? [])
    .filter((v) => v.ativo)
    .sort((a, b) => a.placa.localeCompare(b.placa));

  return {
    motoristas: (motoristas ?? []).map((m) => ({ id: m.id, nome: m.nome_completo })),
    veiculos: veiculosAtivosOrdenados.map((v) => ({
      id: v.id,
      placa: v.placa,
      descricao: [v.marca, v.modelo].filter(Boolean).join(" ") || null,
    })),
  };
}

// Usado pelo formulário de novo Rotograma para pré-preencher origem/destino/
// veículo/motorista/placa a partir de uma rota já salva na Roteirização
// (tabela rotas_salvas, tipo "roteirizacao"), poupando o usuário de digitar
// tudo de novo.
export async function buscarRotaSalvaParaRotogramaAcao(rotaSalvaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rotas_salvas")
    .select("dados")
    .eq("id", rotaSalvaId)
    .maybeSingle();

  if (error || !data) return null;

  const dados = data.dados as Record<string, unknown> | null;
  if (!dados) return null;

  // dados.origem/destino são objetos { lat, lon, label } (ver FormRoteirizacao),
  // salvos assim pela tela de Roteirização — extraímos só o label para
  // pré-preencher texto livre aqui.
  const origem = dados.origem as { label?: string } | undefined;
  const destino = dados.destino as { label?: string } | undefined;

  return {
    origem: String(origem?.label ?? ""),
    destino: String(destino?.label ?? ""),
    placa: String(dados.placa ?? ""),
  };
}
