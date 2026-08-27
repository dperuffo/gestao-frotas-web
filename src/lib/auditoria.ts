import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Log de auditoria centralizado") —
// achado real da varredura: o app já grava `atualizado_por`/`criado_por` em
// boa parte das tabelas sensíveis, mas isso é sobrescrito a cada edição, sem
// histórico de "quem mudou o quê, quando". Este helper centraliza a escrita
// nesse log (tabela `log_auditoria`, ver migração log_auditoria) — chamar em
// QUALQUER Server Action que faça uma mudança sensível (permissão, preço,
// exclusão de cadastro, etc.), sempre no final, depois que a mudança em si
// já foi salva com sucesso.
//
// Fail-open de propósito (mesmo espírito do antifraude/registrarAcessoMenuAcao):
// uma falha ao REGISTRAR o log nunca pode quebrar a ação principal que o
// usuário estava tentando fazer — só loga o problema e segue.
export async function registrarAuditoria(params: {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
  empresaId?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("registrar_log_auditoria", {
      p_acao: params.acao,
      p_entidade: params.entidade,
      p_entidade_id: params.entidadeId ?? undefined,
      p_detalhes: (params.detalhes as never) ?? undefined,
      p_empresa_id: params.empresaId ?? undefined,
    });
    if (error) throw error;
  } catch (e) {
    void logger.error("auditoria", "Falha ao registrar log de auditoria (ignorado)", e);
  }
}
