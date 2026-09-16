"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { normalizarCPF } from "@/lib/utils";
import { garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";

// Fase Fila-Motorista-Abastecimento-Externo (16/09/2026, pedido do Daniel: nome
// completo + CPF do motorista é obrigatório em todo abastecimento — regra de
// negócio confirmada). Nos dois canais de integração EXTERNOS onde a FNI não
// controla a origem (Hub genérico de integrações, provedores de cartão de
// combustível — /api/integracoes/abastecimentos — e ERP de automação de
// posto — /api/integracoes/abastecimentos-fornecidos), bloquear a transação
// por falta de motorista derrubaria o integrador (ele não tem como corrigir
// isso na hora). Decisão: ACEITAR o registro sem motorista mesmo assim, mas
// deixá-lo nesta fila de revisão pra alguém completar manualmente depois.
// A PróFrotas (lib/profrotas.ts, sincronizarProfrotas) foi resolvida à parte
// numa fase anterior — a fonte já garante motorista, então
// profrotas_abastecimentos nunca é alvo desta fila (ver comentário grande em
// page.tsx pro porquê disso vale inclusive pro histórico antigo do robô de
// teste que gravava lá com sync_key "robo-...").
export type PendenciaResolvida = { ok: true } | { ok: false; erro: string };

// Mesmo critério de contarCadastrosPendentesAcao (cadastros-pendentes/actions.ts):
// só soma pra quem tem exatamente 1 empresa resolvida, pra não dar número
// ambíguo pra quem gerencia várias empresas (grupo econômico) ou é admin (que
// enxerga a base toda). Sem gate de perfil — RLS de abastecimentos_externos
// já restringe à própria empresa, então quem "precisa ver isso" (cliente
// dono do abastecimento) já é filtrado sozinho, mesmo espírito de
// cadastros-pendentes.
export async function contarAbastecimentosSemMotoristaAcao(): Promise<number> {
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase);
  if (!empresaSelecionada) return 0;

  const { count } = await supabase
    .from("abastecimentos_externos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaSelecionada)
    .or("motorista_nome.is.null,motorista_cpf.is.null");

  return count ?? 0;
}

export type ResolverPendenciaInput = {
  id: number;
  // Quando o usuário escolheu um motorista já cadastrado (autocomplete),
  // vem o id dele — nome/cpf finais são lidos do cadastro, não do que foi
  // digitado (evita divergência de grafia entre o que aparece aqui e o que
  // está em /motoristas). Quando o motorista ainda não existe, vem null e
  // nome/cpf abaixo são usados como digitados (motorista novo).
  motoristaId: string | null;
  nome: string;
  cpf: string;
};

// Vincula um motorista (existente ou novo) a um abastecimento pendente,
// preenchendo motorista_nome/motorista_cpf em abastecimentos_externos —
// única tabela-fonte que alimenta esta fila (ver contarAbastecimentosSemMotoristaAcao).
export async function resolverPendenciaMotoristaAcao(input: ResolverPendenciaInput): Promise<PendenciaResolvida> {
  const supabase = await createClient();

  const nomeDigitado = input.nome.trim();
  if (!nomeDigitado) {
    return { ok: false, erro: "Informe o nome do motorista." };
  }

  const cpfDigitado = normalizarCPF(input.cpf);
  if (!cpfDigitado) {
    return { ok: false, erro: "CPF inválido — confira os 11 dígitos (com ou sem pontuação)." };
  }

  // RLS (abastecimentos_externos_tenant_all) já impede ler/editar
  // abastecimento de outra empresa, mas buscamos aqui mesmo assim pra
  // conseguir validar abaixo que o motorista escolhido é da MESMA empresa —
  // mesmo padrão "sempre validar de novo em código, não só confiar na RLS"
  // já usado em documentos-empresas/actions.ts e gruposEconomicos.ts.
  const { data: abastecimento, error: erroBusca } = await supabase
    .from("abastecimentos_externos")
    .select("id, empresa_id")
    .eq("id", input.id)
    .maybeSingle();
  if (erroBusca || !abastecimento) {
    return { ok: false, erro: "Abastecimento não encontrado (ou você não tem acesso a ele)." };
  }

  let motoristaNomeFinal = nomeDigitado;
  let motoristaCpfFinal = cpfDigitado;

  if (input.motoristaId) {
    const { data: motorista } = await supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("id", input.motoristaId)
      .eq("empresa_id", abastecimento.empresa_id)
      .maybeSingle();
    if (!motorista) {
      return { ok: false, erro: "O motorista selecionado não pertence a esta empresa — tente buscar de novo." };
    }
    motoristaNomeFinal = motorista.nome_completo;
    motoristaCpfFinal = normalizarCPF(motorista.cpf) ?? cpfDigitado;
  } else {
    // Motorista digitado na hora (ainda não cadastrado) — mesmo caminho de
    // auto-cadastro usado por toda integração de abastecimento (ver
    // src/lib/cadastrosAutomaticos.ts): entra em `motoristas` como
    // origem_cadastro='importado' + pendente_revisao=true, pra aparecer em
    // /cadastros-pendentes até alguém completar o resto (CNH, telefone
    // etc.) — nunca duplica se já existir um motorista com o mesmo CPF.
    await garantirMotoristaCadastrado(supabase, abastecimento.empresa_id, {
      nomeCompleto: motoristaNomeFinal,
      cpf: motoristaCpfFinal,
    });
  }

  const { error: erroUpdate } = await supabase
    .from("abastecimentos_externos")
    .update({ motorista_nome: motoristaNomeFinal, motorista_cpf: motoristaCpfFinal })
    .eq("id", input.id);

  if (erroUpdate) {
    return { ok: false, erro: `Não foi possível salvar: ${erroUpdate.message}` };
  }

  revalidatePath("/abastecimentos-sem-motorista");
  return { ok: true };
}
