import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.84 — pedido do Daniel: os painéis financeiros só mostravam
// ciclos JÁ FECHADOS (faturas_postos, gerada pelo robô
// gerar_faturas_postos_robo() só quando periodo_fim < hoje) — o ciclo
// ATUAL, em andamento, nunca aparecia em nenhuma tela até fechar no dia
// seguinte. `ciclos_abertos_postos()` (RPC SECURITY DEFINER, mesma lógica
// de corte de período do robô) calcula esse ciclo em andamento, com os
// abastecimentos acumulados até hoje, pra cada negociação aceita visível
// ao usuário logado — reaproveitada nas 4 telas (financeiro-posto,
// financeiro do cliente, /clientes/[id] admin e /clientes-posto/[id]).
export type CicloAberto = Database["public"]["Functions"]["ciclos_abertos_postos"]["Returns"][number];

export async function buscarCiclosAbertos(
  supabase: SupabaseClient<Database>
): Promise<CicloAberto[]> {
  const { data, error } = await supabase.rpc("ciclos_abertos_postos");
  if (error) {
    console.error("[ciclosAbertos] falha ao buscar ciclos em andamento (ignorado):", error);
    return [];
  }
  return data ?? [];
}

// Fase 27.85 — pedido do Daniel: "um posto pode ter muitos ciclos com
// diversos status... precisamos facilitar a visão de postos com um volume
// grande de ciclos, pois possui relacionamento com muitos clientes". A
// lista plana (1 linha por FATURA, todos os clientes misturados) não
// escala — vira 1 linha por CONTRAPARTE (cliente, do ponto de vista do
// posto; ou posto, do ponto de vista do cliente), com o ciclo atual e um
// resumo de quantas faturas em cada status, pra dar pra escanear dezenas
// de relações de uma vez. Compartilhado entre /financeiro-posto e
// /financeiro (cliente) — cada página resolve os nomes/ids da contraparte
// à sua maneira e chama esta função só pra agregar.
// Fase CICLOS-6 — pedido do Daniel: novo modelo de 5 status (ver
// financeiroPostos.ts). "aberta" (fatura real, valor travado, aguardando
// pagamento) virou "aVencer"; ganhou "fechada" (janela terminou mas o
// boleto ainda não foi gerado — valor ainda 0). O ciclo em andamento
// (`cicloAtual`, sem linha em faturas_postos ainda) é o verdadeiro
// "Aberto" do modelo novo — nome mantido pra não quebrar quem já lê
// `l.cicloAtual`. `prazoVencimentoDias` saiu (sempre = cicloFaturamentoDias
// agora, não precisa de 2 campos).
export type LinhaContraparte = {
  contraparteId: string;
  contraparteNome: string;
  cicloFaturamentoDias: number;
  cicloAtual: CicloAberto | null;
  contagem: { fechada: number; aVencer: number; vencida: number; paga: number; cancelada: number };
  valorEmAberto: number;
  valorVencido: number;
};

export function agruparCiclosPorContraparte(params: {
  negociacoes: Array<{
    contraparteId: string;
    contraparteNome: string | null;
    cicloFaturamentoDias: number;
  }>;
  faturas: Array<{ contraparteId: string; contraparteNome: string | null; status: string; vencimento: string; valorTotal: number }>;
  ciclosAbertosPorContraparte: Map<string, CicloAberto>;
  hojeIso: string;
}): LinhaContraparte[] {
  const linhas = new Map<string, LinhaContraparte>();

  for (const n of params.negociacoes) {
    linhas.set(n.contraparteId, {
      contraparteId: n.contraparteId,
      contraparteNome: n.contraparteNome ?? "—",
      cicloFaturamentoDias: n.cicloFaturamentoDias,
      cicloAtual: params.ciclosAbertosPorContraparte.get(n.contraparteId) ?? null,
      contagem: { fechada: 0, aVencer: 0, vencida: 0, paga: 0, cancelada: 0 },
      valorEmAberto: 0,
      valorVencido: 0,
    });
  }

  for (const f of params.faturas) {
    let linha = linhas.get(f.contraparteId);
    if (!linha) {
      // Fatura de uma relação que não veio no filtro de negociações
      // (ex: negociação não está mais "aceita") — cria uma linha mínima
      // só pra não perder a fatura da visão.
      linha = {
        contraparteId: f.contraparteId,
        contraparteNome: f.contraparteNome ?? "—",
        cicloFaturamentoDias: 0,
        cicloAtual: null,
        contagem: { fechada: 0, aVencer: 0, vencida: 0, paga: 0, cancelada: 0 },
        valorEmAberto: 0,
        valorVencido: 0,
      };
      linhas.set(f.contraparteId, linha);
    }

    const vencida = f.status === "a_vencer" && f.vencimento < params.hojeIso;
    if (vencida) linha.contagem.vencida += 1;
    else if (f.status === "fechada") linha.contagem.fechada += 1;
    else if (f.status === "a_vencer") linha.contagem.aVencer += 1;
    else if (f.status === "paga") linha.contagem.paga += 1;
    else if (f.status === "cancelada") linha.contagem.cancelada += 1;

    // "Em aberto" = ainda vai precisar ser pago (fechada ou a_vencer,
    // vencida ou não) — fechada normalmente soma 0 (valor só trava na
    // geração do boleto), mas somar não faz mal.
    if (f.status === "fechada" || f.status === "a_vencer") {
      linha.valorEmAberto += f.valorTotal;
      if (vencida) linha.valorVencido += f.valorTotal;
    }
  }

  // Fase 27.91 — pedido do Daniel: "deveria aparecer fatura 'Em Aberto'
  // visto que o ciclo foi iniciado com abastecimentos já realizados...
  // mesmo que não hajam abastecimentos dentro de um ciclo, ele precisa ser
  // aberto e fechado, posteriormente, no final do ciclo". O ciclo em
  // andamento (`cicloAtual`, calculado ao vivo por ciclos_abertos_postos(),
  // sem linha em faturas_postos ainda) soma no valor em aberto mesmo antes
  // de virar fatura de verdade.
  for (const linha of linhas.values()) {
    if (linha.cicloAtual) {
      linha.valorEmAberto += linha.cicloAtual.valor_acumulado;
    }
  }

  // Ordena: quem tem fatura vencida primeiro, depois com algo em aberto
  // (fechada/a_vencer), depois só ciclo em andamento, por fim só histórico
  // pago/cancelado — dentro de cada grupo, por nome.
  function prioridade(l: LinhaContraparte): number {
    if (l.contagem.vencida > 0) return 0;
    if (l.contagem.fechada > 0 || l.contagem.aVencer > 0) return 1;
    if (l.cicloAtual) return 2;
    return 3;
  }

  return Array.from(linhas.values()).sort((a, b) => {
    const p = prioridade(a) - prioridade(b);
    if (p !== 0) return p;
    return a.contraparteNome.localeCompare(b.contraparteNome, "pt-BR");
  });
}
