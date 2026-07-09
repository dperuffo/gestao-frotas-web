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
export type LinhaContraparte = {
  contraparteId: string;
  contraparteNome: string;
  cicloFaturamentoDias: number;
  prazoVencimentoDias: number;
  cicloAtual: CicloAberto | null;
  contagem: { aberta: number; vencida: number; paga: number; cancelada: number };
  valorEmAberto: number;
  valorVencido: number;
};

export function agruparCiclosPorContraparte(params: {
  negociacoes: Array<{
    contraparteId: string;
    contraparteNome: string | null;
    cicloFaturamentoDias: number;
    prazoVencimentoDias: number;
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
      prazoVencimentoDias: n.prazoVencimentoDias,
      cicloAtual: params.ciclosAbertosPorContraparte.get(n.contraparteId) ?? null,
      contagem: { aberta: 0, vencida: 0, paga: 0, cancelada: 0 },
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
        prazoVencimentoDias: 0,
        cicloAtual: null,
        contagem: { aberta: 0, vencida: 0, paga: 0, cancelada: 0 },
        valorEmAberto: 0,
        valorVencido: 0,
      };
      linhas.set(f.contraparteId, linha);
    }

    const vencida = f.status === "aberta" && f.vencimento < params.hojeIso;
    if (vencida) linha.contagem.vencida += 1;
    else if (f.status in linha.contagem) linha.contagem[f.status as keyof LinhaContraparte["contagem"]] += 1;

    if (f.status === "aberta") {
      linha.valorEmAberto += f.valorTotal;
      if (vencida) linha.valorVencido += f.valorTotal;
    }
  }

  // Fase 27.91 — pedido do Daniel: "deveria aparecer fatura 'Em Aberto'
  // visto que o ciclo foi iniciado com abastecimentos já realizados...
  // mesmo que não hajam abastecimentos dentro de um ciclo, ele precisa ser
  // aberto e fechado, posteriormente, no final do ciclo". Até aqui,
  // `contagem`/`valorEmAberto` só contavam faturas REAIS (linhas em
  // `faturas_postos`, geradas pelo robô só depois que o período fecha) — o
  // ciclo em andamento (`cicloAtual`, calculado ao vivo por
  // ciclos_abertos_postos()) nunca contribuía pra esse total, mesmo já
  // tendo abastecimentos e valor acumulado. Cada negociação com ciclo em
  // andamento agora soma como 1 "aberta" a mais (mesmo com valor 0 — o
  // ciclo já está "aberto" desde o primeiro dia, só ainda não fechou).
  for (const linha of linhas.values()) {
    if (linha.cicloAtual) {
      linha.contagem.aberta += 1;
      linha.valorEmAberto += linha.cicloAtual.valor_acumulado;
    }
  }

  // Ordena: quem tem fatura vencida primeiro, depois em aberto, depois
  // ciclo em andamento, por fim só histórico pago/cancelado — dentro de
  // cada grupo, por nome.
  function prioridade(l: LinhaContraparte): number {
    if (l.contagem.vencida > 0) return 0;
    if (l.contagem.aberta > 0) return 1;
    if (l.cicloAtual) return 2;
    return 3;
  }

  return Array.from(linhas.values()).sort((a, b) => {
    const p = prioridade(a) - prioridade(b);
    if (p !== 0) return p;
    return a.contraparteNome.localeCompare(b.contraparteNome, "pt-BR");
  });
}
