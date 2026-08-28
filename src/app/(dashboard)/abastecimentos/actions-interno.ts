"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarCPF } from "@/lib/utils";
import { garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";
import { ARLA32 } from "@/lib/constants";

// Fase Abastecimento-Interno (21/08/2026, pedido do Daniel) — lançamento
// manual, pela tela de Abastecimentos, de um abastecimento feito na garagem
// interna do cliente (matriz/filial). Ao contrário do lançamento manual
// "externo" (criarAbastecimento, em actions.ts, que grava em
// profrotas_abastecimentos com identificador negativo), este grava direto em
// abastecimentos_internos — tabela própria, sem reaproveitar a convenção do
// identificador negativo.
//
// Preço unitário NUNCA vem do formulário: é sempre buscado no cadastro do
// posto interno (postos_internos_precos) — mesma disciplina da RPC
// registrar_abastecimento_interno usada pelo PWA Motorista. Isso garante que
// o preço lançado bate com o cadastrado, não importa quem lançou.

export type EstadoFormularioAbastecimentoInterno = { erro?: string; ok?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

export async function criarAbastecimentoInternoAcao(
  _prev: EstadoFormularioAbastecimentoInterno,
  formData: FormData
): Promise<EstadoFormularioAbastecimentoInterno> {
  const supabase = await createClient();

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const motoristaNome = String(formData.get("motorista_nome") ?? "").trim() || null;
  const motoristaCpf = normalizarCPF(String(formData.get("motorista_cpf") ?? ""));
  const combustivel = String(formData.get("combustivel") ?? "").trim();
  const quantidade = numeroOuNull(formData.get("quantidade"));
  const arlaQuantidade = numeroOuNull(formData.get("arla_quantidade"));
  const hodometro = numeroOuNull(formData.get("hodometro"));
  const dataAbastecimento = String(formData.get("data_abastecimento") ?? "").trim();

  if (!empresaId || !placa || !combustivel) {
    return { erro: "Empresa, placa e combustível são obrigatórios." };
  }
  if (!quantidade || quantidade <= 0) {
    return { erro: "Informe uma quantidade válida." };
  }

  // Posto interno da empresa escolhida — RLS de postos_internos já restringe
  // a leitura à própria empresa/grupo econômico do usuário (ou admin).
  const { data: posto } = await supabase
    .from("postos_internos")
    .select("id, ativo")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!posto || !posto.ativo) {
    return { erro: "Esta empresa não tem posto interno ativo configurado. Configure em Postos Internos primeiro." };
  }

  const { data: precoCombustivel } = await supabase
    .from("postos_internos_precos")
    .select("preco")
    .eq("posto_interno_id", posto.id)
    .eq("combustivel", combustivel)
    .maybeSingle();
  if (!precoCombustivel) {
    return { erro: `Não há preço cadastrado para "${combustivel}" no posto interno desta empresa.` };
  }

  let arlaValorUnitario: number | null = null;
  let arlaValorTotal: number | null = null;
  if (arlaQuantidade && arlaQuantidade > 0) {
    const { data: precoArla } = await supabase
      .from("postos_internos_precos")
      .select("preco")
      .eq("posto_interno_id", posto.id)
      .eq("combustivel", ARLA32)
      .maybeSingle();
    if (!precoArla) {
      return { erro: "Não há preço cadastrado para Arla32 no posto interno desta empresa." };
    }
    arlaValorUnitario = Number(precoArla.preco);
    arlaValorTotal = Math.round(arlaQuantidade * arlaValorUnitario * 100) / 100;
  }

  const valorUnitario = Number(precoCombustivel.preco);
  const valorTotal = Math.round(quantidade * valorUnitario * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase CPF-obrigatorio-fonte (28/08/2026) — quem lança aqui é um gestor
  // digitando em nome do motorista (ao contrário do PWA, onde o próprio
  // motorista autenticado lança e o CPF vem garantido do cadastro dele).
  // Sem CPF no formulário, cai no mesmo fallback por nome+empresa contra o
  // cadastro de motoristas usado nos outros caminhos de importação.
  let motoristaCpfFinal = motoristaCpf;
  if (!motoristaCpfFinal && motoristaNome) {
    const { data: motoristaCadastro } = await supabase
      .from("motoristas")
      .select("cpf")
      .eq("empresa_id", empresaId)
      .ilike("nome_completo", motoristaNome)
      .not("cpf", "is", null)
      .maybeSingle();
    motoristaCpfFinal = motoristaCadastro?.cpf ?? null;
  }

  const { data: inserido, error } = await supabase
    .from("abastecimentos_internos")
    .insert({
      empresa_id: empresaId,
      posto_interno_id: posto.id,
      placa,
      motorista_nome: motoristaNome,
      motorista_cpf: motoristaCpfFinal,
      hodometro,
      data_abastecimento: dataAbastecimento ? new Date(dataAbastecimento).toISOString() : new Date().toISOString(),
      combustivel,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      arla_quantidade: arlaQuantidade,
      arla_valor_unitario: arlaValorUnitario,
      arla_valor_total: arlaValorTotal,
      origem: "manual_web",
      criado_por: user?.email ?? null,
    })
    .select("codigo_abastecimento")
    .single();

  if (error) return { erro: `Não foi possível lançar o abastecimento: ${error.message}` };

  if (motoristaNome) {
    await garantirMotoristaCadastrado(supabase, empresaId, { nomeCompleto: motoristaNome, cpf: motoristaCpf });
  }

  revalidatePath("/abastecimentos");
  return {
    ok: `Abastecimento interno registrado (ID ${inserido?.codigo_abastecimento}). Valor total: ${valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
  };
}
