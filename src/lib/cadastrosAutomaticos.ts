// Fase auto-cadastro-abastecimento (27/07/2026, pedido do Daniel: "quando
// uma placa e um motorista são importados atraves da integracao de
// abastecimentos, os registros já devem ser criados no cadastro de
// veiculos e motoristas pra o usuario cliente complementar as
// informacoes" — e depois: "Nao é somente via meio de pagamento
// Pró-Frotas e sim, qualquer outra integracao com meios de pagamento ou
// carga via planilha"). Usado por TODO ponto de entrada que traz
// abastecimento de fora da plataforma:
//   - src/lib/profrotas.ts (sincronização PróFrotas, cron/manual)
//   - /api/integracoes/abastecimentos (Hub de Integrações — cartão de
//     combustível, lado frota)
//   - /api/integracoes/abastecimentos-fornecidos (posto lançando em nome
//     do cliente que atendeu)
//   - /api/integracoes/faturas-meio-pagamento (qualquer provedor de meio
//     de pagamento que já fecha e cobra a própria fatura — Ticket Log,
//     Edenred, Veloe, RedeFrota, Valecard etc.)
//   - /abastecimentos/importar (carga manual via planilha XLSX)
// Cria um registro MÍNIMO (só o que a importação traz — placa, ou
// nome/CPF do motorista) marcado como origem_cadastro='importado' e
// pendente_revisao=true, pra aparecer com o badge "Pendente" nas listas e
// no painel /cadastros-pendentes até o cliente completar o resto do
// cadastro (marca/modelo, CNH, etc.) — ver migração
// origem_cadastro_pendente_revisao. Qualquer NOVA integração de
// abastecimento que vier a existir deve chamar estas mesmas funções.
//
// Nunca sobrescreve um registro já existente (mesmo que incompleto) — só
// cria quando realmente não encontra nada, reaproveitando os mesmos RPCs
// de dedupe já usados nas telas manuais (veiculo_duplicado/
// motorista_duplicado). Erros de inserção são só logados (nunca travam a
// sincronização principal do abastecimento em si).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function garantirVeiculoCadastrado(
  supabase: SupabaseClient<Database>,
  cnpjFrota: string,
  placaBruta: string
): Promise<void> {
  const placa = placaBruta.trim().toUpperCase();
  if (!placa || !cnpjFrota) return;

  const { data: duplicado } = await supabase.rpc("veiculo_duplicado", {
    p_cnpj_frota: cnpjFrota,
    p_placa: placa,
  });
  if (duplicado) return;

  const { error } = await supabase.from("cadastro_veiculos").insert({
    cnpj_frota: cnpjFrota,
    placa,
    origem_cadastro: "importado",
    pendente_revisao: true,
  });
  if (error && error.code !== "23505") {
    console.error(`garantirVeiculoCadastrado (${placa}): ${error.message}`);
  }
}

// CPF é opcional — quando vier (integrações que já mandam CPF do
// motorista, ex. fidelidade), usa motorista_duplicado (RPC normalizada) pra
// achar/evitar duplicar. Sem CPF (caso da PróFrotas, que só manda nome),
// cai pra um match por nome normalizado dentro da mesma empresa — não é
// tão preciso quanto CPF, mas é o único dado disponível nesse caminho.
export async function garantirMotoristaCadastrado(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  dados: { nomeCompleto: string; cpf?: string | null }
): Promise<void> {
  const nome = dados.nomeCompleto.trim();
  const cpf = dados.cpf?.trim() || null;
  if (!nome || !empresaId) return;

  if (cpf) {
    const { data: duplicado } = await supabase.rpc("motorista_duplicado", {
      p_empresa_id: empresaId,
      p_cpf: cpf,
    });
    if (duplicado) return;
  } else {
    const { data: existente } = await supabase
      .from("motoristas")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("nome_completo", nome)
      .maybeSingle();
    if (existente) return;
  }

  const { error } = await supabase.from("motoristas").insert({
    empresa_id: empresaId,
    nome_completo: nome,
    cpf,
    origem_cadastro: "importado",
    pendente_revisao: true,
  });
  if (error && error.code !== "23505") {
    console.error(`garantirMotoristaCadastrado (${nome}): ${error.message}`);
  }
}

// Versões em lote — usadas pela sincronização PróFrotas (dezenas/centenas
// de linhas por execução), pra não repetir placa/nome já processado no
// mesmo lote antes de checar o banco.
export async function garantirVeiculosCadastrados(
  supabase: SupabaseClient<Database>,
  cnpjFrota: string,
  placas: Iterable<string>
): Promise<void> {
  const unicas = [...new Set([...placas].map((p) => p.trim().toUpperCase()).filter(Boolean))];
  for (const placa of unicas) {
    await garantirVeiculoCadastrado(supabase, cnpjFrota, placa);
  }
}

export async function garantirMotoristasCadastrados(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  nomes: Iterable<string>
): Promise<void> {
  const unicos = [...new Set([...nomes].map((n) => n.trim()).filter(Boolean))];
  for (const nome of unicos) {
    await garantirMotoristaCadastrado(supabase, empresaId, { nomeCompleto: nome });
  }
}
