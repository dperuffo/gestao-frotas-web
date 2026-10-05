"use server";

import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { logger } from "@/lib/logger";

// Fase Aviso-Novo-Abastecimento (27/09/2026, pedido do Daniel: "Achei bem
// legal a notificação de novo abastecimento que aparece como um push no demo
// interativo. Podemos implementar na solução").
//
// Critério de "novo" (v2, mesmo dia): devolve os abastecimentos com data
// dentro de uma JANELA recente (últimos 15 min até agora + 5 min de
// tolerância de relógio) e o navegador mostra só os que ainda não viu.
//
// Por que janela e não "maior data já vista" (v1): achado real no teste do
// Daniel — a Frotas & Frotas tinha um abastecimento ProFrotas datado ~2h no
// futuro, o que empurrava o marcador pra frente e escondia todo abastecimento
// real feito antes daquele horário. A janela:
//   - ignora datas no futuro (limite superior = agora + 5 min);
//   - aceita integrações que chegam alguns minutos atrasadas (15 min);
//   - não dispara avisos em importação em lote de registros antigos.
// A view abastecimentos_unificado não expõe data de inserção, por isso a
// data do próprio abastecimento.
//
// Escopo: empresas do usuário (resolverEmpresaAtual). Admin/analista
// enxergam todos os clientes: só recebem avisos do CLIENTE ATUAL selecionado
// (?empresa= na URL, o mesmo do indicador fixo do menu). Perfil posto fica
// de fora (os abastecimentos são vinculados à empresa cliente).

export type NovoAbastecimento = {
  chave: string;
  empresaId: string | null;
  placa: string | null;
  motoristaNome: string | null;
  postoNome: string | null;
  municipio: string | null;
  uf: string | null;
  produto: string | null;
  litros: number | null;
  valorTotal: number | null;
  data: string;
};

const JANELA_PASSADO_MS = 15 * 60_000;
const TOLERANCIA_FUTURO_MS = 5 * 60_000;
const LIMITE = 20;

export async function novosAbastecimentosAcao(
  empresaParam: string | null
): Promise<{ ativo: boolean; itens: NovoAbastecimento[] }> {
  try {
    const supabase = await createClient();
    const { perfil, empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam ?? undefined);
    if (!perfil || perfil === "posto") return { ativo: false, itens: [] };

    const visaoGlobal = perfil === "admin";
    const ids = empresaSelecionada ? [empresaSelecionada] : visaoGlobal ? [] : empresas.map((e) => e.id);
    if (ids.length === 0) return { ativo: false, itens: [] };

    const agora = Date.now();
    const { data, error } = await supabase
      .from("abastecimentos_unificado")
      .select("id, provedor, empresa_id, placa, motorista_nome, posto_nome, municipio, uf, produto, litros, valor_total, data_abastecimento")
      .in("empresa_id", ids)
      .gte("data_abastecimento", new Date(agora - JANELA_PASSADO_MS).toISOString())
      .lte("data_abastecimento", new Date(agora + TOLERANCIA_FUTURO_MS).toISOString())
      .order("data_abastecimento", { ascending: true })
      .limit(LIMITE);
    if (error) throw error;

    const itens: NovoAbastecimento[] = (data ?? [])
      .filter((r) => r.data_abastecimento)
      .map((r) => ({
        // id é único só dentro de cada fonte (ProFrotas/externo/interno):
        // a chave junta provedor + id.
        chave: `${r.provedor ?? "?"}:${r.id ?? `${r.placa}-${r.data_abastecimento}`}`,
        empresaId: r.empresa_id,
        placa: r.placa,
        motoristaNome: r.motorista_nome,
        postoNome: r.posto_nome,
        municipio: r.municipio,
        uf: r.uf,
        produto: r.produto,
        litros: r.litros,
        valorTotal: r.valor_total,
        data: r.data_abastecimento as string,
      }));

    return { ativo: true, itens };
  } catch (e) {
    void logger.error("dashboard/novos-abastecimentos", "Falha ao buscar novos abastecimentos (ignorado)", e);
    return { ativo: true, itens: [] };
  }
}
