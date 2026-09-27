"use server";

import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { logger } from "@/lib/logger";

// Fase Aviso-Novo-Abastecimento (27/09/2026, pedido do Daniel: "Achei bem
// legal a notificação de novo abastecimento que aparece como um push no demo
// interativo. Podemos implementar na solução").
//
// O navegador guarda um "marcador" (data do abastecimento mais recente que
// já conhece) e pergunta periodicamente se chegou algo mais novo. Na
// primeira chamada (marcador nulo) só devolve o marcador atual, sem avisos:
// quem acabou de abrir o sistema não recebe uma rajada do histórico.
//
// Por que a data do abastecimento e não uma data de inserção: a view
// abastecimentos_unificado (ProFrotas + externos + internos) não expõe
// quando o registro entrou no banco. Usar a data do abastecimento tem um
// efeito colateral desejável — importação em lote de registros antigos não
// dispara avisos, só o que acontece "agora" na operação.
//
// Escopo: empresas do usuário (mesma regra de resolverEmpresaAtual). Admin/
// analista enxergam todos os clientes e ficariam soterrados de avisos, então
// ficam de fora nesta primeira versão; perfil posto também (os
// abastecimentos são vinculados à empresa cliente, não ao posto).

export type NovoAbastecimento = {
  id: string;
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

const LIMITE = 6;

export async function novosAbastecimentosAcao(
  marcador: string | null
): Promise<{ marcador: string | null; itens: NovoAbastecimento[] }> {
  try {
    const supabase = await createClient();
    const { perfil, empresas } = await resolverEmpresaAtual(supabase);
    if (!perfil || perfil === "admin" || perfil === "analista" || perfil === "posto") {
      return { marcador: null, itens: [] };
    }
    const ids = empresas.map((e) => e.id);
    if (ids.length === 0) return { marcador: null, itens: [] };

    if (!marcador) {
      const { data } = await supabase
        .from("abastecimentos_unificado")
        .select("data_abastecimento")
        .in("empresa_id", ids)
        .not("data_abastecimento", "is", null)
        .order("data_abastecimento", { ascending: false })
        .limit(1);
      return { marcador: data?.[0]?.data_abastecimento ?? new Date(0).toISOString(), itens: [] };
    }

    const { data, error } = await supabase
      .from("abastecimentos_unificado")
      .select("id, placa, motorista_nome, posto_nome, municipio, uf, produto, litros, valor_total, data_abastecimento")
      .in("empresa_id", ids)
      .gt("data_abastecimento", marcador)
      .order("data_abastecimento", { ascending: true })
      .limit(LIMITE);
    if (error) throw error;

    const itens: NovoAbastecimento[] = (data ?? [])
      .filter((r) => r.data_abastecimento)
      .map((r) => ({
        id: r.id ?? `${r.placa}-${r.data_abastecimento}`,
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

    return { marcador: itens.length ? itens[itens.length - 1].data : marcador, itens };
  } catch (e) {
    void logger.error("dashboard/novos-abastecimentos", "Falha ao buscar novos abastecimentos (ignorado)", e);
    return { marcador, itens: [] };
  }
}
