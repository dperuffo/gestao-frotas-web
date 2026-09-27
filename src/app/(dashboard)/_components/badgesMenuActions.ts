"use server";

import { logger } from "@/lib/logger";
import { contarChamadosNaoVistosAcao } from "../chamados/actions";
import { contarAvaliacoesPendentesAcao } from "../avaliacoes/actions";
import { contarAcessosClientesNaoVistosAcao } from "../clientes/actions";
import { contarNegociacoesPendentesAcao } from "../negociacoes/actions";
import { contarAjustesAbastecimentosPendentesAcao } from "../abastecimentos/actions";
import { contarAcoesSugeridasPendentesAcao } from "../acoes-sugeridas/actions";
import { contarDocumentosPendentesAcao } from "../documentos-empresas/actions";
import { contarCadastrosPendentesAcao } from "../cadastros-pendentes/actions";
import { contarAbastecimentosSemMotoristaAcao } from "../abastecimentos-sem-motorista/actions";
import { contarMultasPendentesAcao } from "../multas/actions";
import { contarDuplicidadesPlacaGrupoAcao } from "../duplicidade-placas-grupo/actions";
import { contarDivergenciasPrecoPostoAcao, contarDivergenciasPrecoClienteAcao } from "../conferencia-precos/actions";

// Fase Bolinhas-Automáticas (27/09/2026, pedido do Daniel: "precisamos
// analisar se o sistema de notificações, bolinhas vermelhas, está
// funcionando corretamente... não estão totalmente automatizadas").
//
// Diagnóstico: as contagens eram calculadas só no layout do dashboard, que o
// Next.js NÃO re-renderiza em navegação entre telas (partial rendering). Na
// prática a bolinha só mudava com F5: não acendia quando chegava algo novo
// (chamado de outro usuário, abastecimento de integração, ação sugerida do
// motor) e não apagava depois de abrir/resolver o item.
//
// Agora esta é a fonte única das contagens do menu: o layout usa na primeira
// renderização e o <ProvedorBadgesMenu> chama de novo no navegador ao trocar
// de tela, ao voltar para a aba e a cada 60s. Mantém a blindagem de sempre:
// cada contagem é best-effort (falha vira 0 = bolinha escondida) e nunca
// derruba o dashboard.
function seguro(nome: string, p: Promise<number>): Promise<number> {
  return p.catch((e) => {
    void logger.error("dashboard/badges", `Falha ao contar ${nome} (ignorado)`, e);
    return 0;
  });
}

export async function contarBadgesMenuAcao(): Promise<Record<string, number>> {
  const [
    chamadosNaoVistos,
    avaliacoesPendentes,
    acessosClientesNaoVistos,
    negociacoesPendentes,
    ajustesAbastecimentosPendentes,
    documentosPendentes,
    acoesSugeridasPendentes,
    cadastrosPendentes,
    abastecimentosSemMotorista,
    multasPendentes,
    duplicidadesPlacaGrupo,
    divergenciasPrecoPosto,
    divergenciasPrecoCliente,
  ] = await Promise.all([
    seguro("chamados não vistos", contarChamadosNaoVistosAcao()),
    seguro("avaliações pendentes", contarAvaliacoesPendentesAcao()),
    seguro("acessos de clientes não vistos", contarAcessosClientesNaoVistosAcao()),
    seguro("negociações pendentes", contarNegociacoesPendentesAcao()),
    seguro("ajustes de abastecimento pendentes", contarAjustesAbastecimentosPendentesAcao()),
    seguro("documentos pendentes", contarDocumentosPendentesAcao()),
    seguro("ações sugeridas pendentes", contarAcoesSugeridasPendentesAcao()),
    seguro("cadastros pendentes", contarCadastrosPendentesAcao()),
    seguro("abastecimentos sem motorista", contarAbastecimentosSemMotoristaAcao()),
    seguro("multas pendentes", contarMultasPendentesAcao()),
    seguro("duplicidades de placa", contarDuplicidadesPlacaGrupoAcao()),
    seguro("divergências de preço (posto)", contarDivergenciasPrecoPostoAcao()),
    seguro("divergências de preço (cliente)", contarDivergenciasPrecoClienteAcao()),
  ]);

  return {
    "/clientes": acessosClientesNaoVistos,
    "/cadastros-pendentes": cadastrosPendentes,
    "/abastecimentos-sem-motorista": abastecimentosSemMotorista,
    "/duplicidade-placas-grupo": duplicidadesPlacaGrupo,
    "/negociacoes": negociacoesPendentes,
    "/abastecimentos": ajustesAbastecimentosPendentes,
    "/acoes-sugeridas": acoesSugeridasPendentes,
    "/multas": multasPendentes,
    "/chamados": chamadosNaoVistos,
    // Soma os dois lados: pra qualquer usuário, só um dos dois vem
    // diferente de zero (posto vs. cliente, ver as duas Server Actions).
    "/conferencia-precos": divergenciasPrecoPosto + divergenciasPrecoCliente,
    // Só aparecem no bloco Administração (admin) — ver layout.tsx.
    "/avaliacoes": avaliacoesPendentes,
    "/documentos-empresas": documentosPendentes,
  };
}
