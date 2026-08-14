import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarProfrotas } from "@/lib/profrotas";
import { verificarLimiteFrota, mensagemLimiteExcedido } from "@/lib/limitePlano";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

// Sincronização automática agendada de todos os clientes com integração
// PróFrotas ativa — substitui o worker em background por cliente que o
// Streamlit mantinha (thread persistente, inviável em Next.js/serverless).
// Aqui é uma chamada disparada de fora (cron), que percorre todas as chaves
// ativas de uma vez.
//
// Proteção: exige `Authorization: Bearer <CRON_SECRET>`. Configure
// CRON_SECRET em .env.local (produção) e aponte o agendador pra esta rota —
// ver README (seção "Fase 11") para as opções (Vercel Cron, cron externo,
// pg_cron do Supabase).
//
// Roda em runtime Node (não Edge): precisa do módulo `crypto` (hash do
// sync_key) e de chamadas de rede potencialmente longas.
export const runtime = "nodejs";
export const maxDuration = 300;

// Janela de segurança: reprocessa 2h antes do último sync bem-sucedido (ou
// as últimas 4h, se o cliente nunca sincronizou), pra cobrir qualquer
// atraso entre execuções do agendador sem perder registros — mesmo overlap
// usado no worker original do Streamlit. Duplicatas não são um problema:
// o upsert por cnpj_frota+identificador+item_id apenas sobrescreve.
function calcularDataInicio(ultimoSync: string | null): string {
  const agora = new Date();
  if (ultimoSync) {
    const base = new Date(ultimoSync);
    base.setHours(base.getHours() - 2);
    return base.toISOString().slice(0, 19) + "Z";
  }
  const base = new Date(agora);
  base.setHours(base.getHours() - 4);
  return base.toISOString().slice(0, 19) + "Z";
}

async function executar(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  const autorizacao = request.headers.get("authorization");
  if (!segredoConfere(autorizacao, `Bearer ${segredoEsperado}`)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // M2 — mesma defesa em profundidade contra força bruta do CRON_SECRET
  // usada em /api/cron/atualizar-precos-anp.
  const limite = verificarLimite(`cron-profrotas:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const supabase = createAdminClient();
  const { data: chaves, error } = await supabase
    .from("profrotas_api_keys")
    .select("cnpj_frota, nome_empresa, token, ultimo_sync")
    .eq("ativo", true);

  if (error) {
    return NextResponse.json({ erro: `Falha ao listar chaves: ${error.message}` }, { status: 500 });
  }

  const resultados = [];
  for (const chave of chaves ?? []) {
    const dataInicio = calcularDataInicio(chave.ultimo_sync);
    try {
      // Fase 27.41 — mesma checagem do sync manual (ver integracoes/actions.ts):
      // se a frota real da empresa já estiver acima do limite do plano
      // atual, pula essa chave (sem derrubar o cron pras demais empresas) e
      // registra o motivo no resultado, pra ficar visível em /integracoes.
      const { data: empresaId } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: chave.cnpj_frota });
      if (empresaId) {
        const limite = await verificarLimiteFrota(supabase, empresaId);
        if (!limite.ok) {
          resultados.push({
            cnpj_frota: chave.cnpj_frota,
            nome_empresa: chave.nome_empresa,
            paginas: 0,
            salvos: 0,
            totalApi: 0,
            novoToken: null,
            erro: mensagemLimiteExcedido(limite),
          });
          continue;
        }
      }

      const resultado = await sincronizarProfrotas(supabase, {
        cnpjFrota: chave.cnpj_frota,
        token: chave.token,
        dataInicio,
      });
      resultados.push({ cnpj_frota: chave.cnpj_frota, nome_empresa: chave.nome_empresa, ...resultado });
    } catch (erroSync) {
      resultados.push({
        cnpj_frota: chave.cnpj_frota,
        nome_empresa: chave.nome_empresa,
        paginas: 0,
        salvos: 0,
        totalApi: 0,
        novoToken: null,
        erro: erroSync instanceof Error ? erroSync.message : String(erroSync),
      });
    }
  }

  return NextResponse.json({
    processados: resultados.length,
    salvos_total: resultados.reduce((soma, r) => soma + r.salvos, 0),
    resultados,
  });
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
