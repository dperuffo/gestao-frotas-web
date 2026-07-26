import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function normalizarCnpjLocal(v: string | null | undefined): string {
  return (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

// Aloca (ou realoca, ou desaloca — quando centroCustoId é null) um veículo a
// um centro de custo, mantendo o HISTÓRICO em centros_custo_veiculos: fecha
// a alocação ativa atual (data_fim = hoje) e abre uma nova, em vez de
// sobrescrever. Também sincroniza cadastro_veiculos.centro_custo_id/nome,
// que funciona como um cache da alocação "atual" usado pelo restante do
// app (formulário do veículo, filtros, etc.) sem precisar de join.
//
// Achado real (Daniel reportou: alocar SSZ2C51 em "SP" não movia pra
// "Alocados" nem "salvava"). Duas causas, corrigidas aqui:
//
// 1) A consulta/atualização abaixo filtrava só por `placa`, sem escopar
//    por empresa — e existem placas repetidas entre empresas de teste
//    diferentes (achado ao investigar: SSZ2C51 existe em duas empresas).
//    Sem escopo, dava pra ler/gravar o veículo/histórico da empresa ERRADA.
//    Agora toda consulta é escopada por empresa_id (centros_custo_veiculos,
//    que já tem a coluna) ou pelo cnpj_frota da empresa, resolvido via `id`
//    exato do veículo (cadastro_veiculos usa cnpj_frota, não empresa_id).
// 2) O atalho "já está no centro pedido, nada a fazer" comparava só contra
//    o HISTÓRICO (centros_custo_veiculos) — se o cache em
//    cadastro_veiculos.centro_custo_id ficasse dessincronizado por qualquer
//    motivo (achado: exatamente o caso do SSZ2C51, histórico já dizia "SP"
//    desde 23/06 mas o cache continuava null), o atalho pulava o único
//    passo que resincronizaria o cache — o veículo ficava preso pra sempre
//    aparecendo como "Disponível" mesmo já alocado no histórico. Agora a
//    sincronização do cache roda SEMPRE (é idempotente/barata), então um
//    drift antigo se autocorrige na próxima vez que alguém mexer na
//    alocação, em vez de ficar travado.
export async function alocarVeiculoCentroCusto(
  supabase: Supabase,
  params: {
    placa: string;
    centroCustoId: string | null;
    empresaId: string | null;
    criadoPor?: string;
  }
): Promise<{ erro?: string }> {
  const { placa, centroCustoId, empresaId, criadoPor } = params;
  const hoje = new Date().toISOString().slice(0, 10);

  let queryAtual = supabase
    .from("centros_custo_veiculos")
    .select("id, centro_custo_id")
    .eq("placa", placa)
    .eq("ativo", true)
    .is("data_fim", null);
  if (empresaId) queryAtual = queryAtual.eq("empresa_id", empresaId);
  const { data: atual } = await queryAtual.maybeSingle();

  // Evita "churn" no histórico ao salvar sem trocar o centro de custo —
  // mas (ver achado 2 acima) isso NÃO pula a sincronização do cache mais
  // abaixo, só o registro de uma nova entrada de histórico.
  const jaEstaNoCentroPedido = (atual?.centro_custo_id ?? null) === centroCustoId;

  if (!jaEstaNoCentroPedido) {
    if (atual) {
      const { error } = await supabase
        .from("centros_custo_veiculos")
        .update({ data_fim: hoje, ativo: false })
        .eq("id", atual.id);
      if (error) return { erro: `Não foi possível encerrar a alocação anterior: ${error.message}` };
    }

    if (centroCustoId) {
      const { error } = await supabase.from("centros_custo_veiculos").insert({
        centro_custo_id: centroCustoId,
        empresa_id: empresaId,
        placa,
        data_inicio: hoje,
        ativo: true,
        criado_por: criadoPor ?? "",
      });
      if (error) return { erro: `Não foi possível registrar a nova alocação: ${error.message}` };
    }
  }

  let nomeCentroCusto: string | null = null;
  if (centroCustoId) {
    const { data: cc } = await supabase.from("centros_custo").select("nome").eq("id", centroCustoId).maybeSingle();
    nomeCentroCusto = cc?.nome ?? null;
  }

  // Resolve o `id` exato do veículo (placa + cnpj_frota da empresa) antes
  // de atualizar — nunca faz update só por placa quando dá pra escopar por
  // empresa, pra nunca arriscar mexer no veículo de outra empresa com a
  // mesma placa.
  let idVeiculoAlvo: string | null = null;
  if (empresaId) {
    const { data: empresa } = await supabase.from("empresas").select("cnpj").eq("id", empresaId).maybeSingle();
    const cnpjEmpresaNormalizado = normalizarCnpjLocal(empresa?.cnpj);
    if (cnpjEmpresaNormalizado) {
      const { data: candidatos } = await supabase.from("cadastro_veiculos").select("id, cnpj_frota").eq("placa", placa);
      idVeiculoAlvo = (candidatos ?? []).find((c) => normalizarCnpjLocal(c.cnpj_frota) === cnpjEmpresaNormalizado)?.id ?? null;
    }
  }

  const updateBase = supabase
    .from("cadastro_veiculos")
    .update({ centro_custo_id: centroCustoId, centro_custo_nome: nomeCentroCusto });
  const { error: erroVeiculo } = idVeiculoAlvo
    ? await updateBase.eq("id", idVeiculoAlvo)
    : await updateBase.eq("placa", placa);
  if (erroVeiculo) return { erro: `Não foi possível atualizar o veículo: ${erroVeiculo.message}` };

  return {};
}
