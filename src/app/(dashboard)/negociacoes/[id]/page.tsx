import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";
import { formatarDataBr, formatarDataHoraBr } from "@/lib/utils";
import { formatarMoeda } from "@/lib/financeiro";
import { FormularioContraproposta } from "../_components/FormularioContraproposta";
import { BotaoCancelarNegociacao } from "../_components/BotaoCancelarNegociacao";

export default async function DetalheNegociacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fase 27.51 — cliente_nome/posto_nome são colunas denormalizadas (não um
  // join pra empresas): um join respeitaria a RLS de empresas, que só
  // libera enxergar quem é membro daquela empresa, deixando o nome da
  // contraparte sempre em branco pro outro lado da negociação.
  const { data: negociacao } = await supabase
    .from("negociacoes_postos")
    .select(
      "id, empresa_cliente_id, empresa_posto_id, posto_cnpj, origem, status, rodada_atual, criado_em, atualizado_em, atualizado_por, cliente_nome, posto_nome"
    )
    .eq("id", id)
    .maybeSingle();

  if (!negociacao) notFound();

  // Fase 27.62 — "atualizado_por" guarda só o e-mail; resolve o nome à
  // parte via usuarios_app (mesmo padrão de dashboard/layout.tsx e da lista
  // /negociacoes — sem FK entre as tabelas, e-mail é a chave de junção).
  let nomeAtualizadoPor: string | null = null;
  if (negociacao.atualizado_por) {
    const { data: usuario } = await supabase
      .from("usuarios_app")
      .select("nome")
      .eq("email", negociacao.atualizado_por)
      .maybeSingle();
    nomeAtualizadoPor = usuario?.nome || negociacao.atualizado_por;
  }

  const { data: rodadas } = await supabase
    .from("negociacoes_postos_rodadas")
    .select("*")
    .eq("negociacao_id", id)
    .order("numero_rodada", { ascending: true });

  // Determina de que lado o usuário logado está olhando (cliente ou posto),
  // via segmento da empresa vinculada — mesmo critério da tela de lista.
  let empresaSegmento: string | null = null;
  const empresaParaChecar = negociacao.empresa_posto_id ?? negociacao.empresa_cliente_id;
  if (empresaParaChecar) {
    // Confere qual das duas empresas (cliente/posto) o usuário atual enxerga
    // via RLS — a que aparecer é o "lado" dele.
    const { data: minhasEmpresas } = await supabase.rpc("empresas_do_usuario", {
      p_email: (await supabase.auth.getUser()).data.user?.email ?? "",
    });
    const souPostoLado = negociacao.empresa_posto_id && (minhasEmpresas ?? []).includes(negociacao.empresa_posto_id);
    empresaSegmento = souPostoLado ? "Revenda" : "Frota";
  }
  const souPosto = empresaSegmento === "Revenda";

  const ultimaRodada = rodadas?.[rodadas.length - 1];
  const statusAtual = negociacao.status as StatusNegociacao;
  const minhaVezDeResponder =
    (souPosto && statusAtual === "pendente_posto") || (!souPosto && statusAtual === "pendente_cliente");
  const emAndamento = statusAtual === "pendente_posto" || statusAtual === "pendente_cliente";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/negociacoes" className="text-xs text-frota-600 hover:underline">
            ← Voltar
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Negociação com {souPosto ? (negociacao.cliente_nome ?? "cliente") : (negociacao.posto_nome ?? negociacao.posto_cnpj)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Status:{" "}
            <span className="font-medium text-slate-700">
              {STATUS_NEGOCIACAO_LABEL[statusAtual] ?? statusAtual}
            </span>{" "}
            · Rodada #{negociacao.rodada_atual}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Atualizado em {formatarDataHoraBr(negociacao.atualizado_em)}
            {nomeAtualizadoPor && (
              <>
                {" "}
                por <span className="font-medium text-slate-500">{nomeAtualizadoPor}</span>
                {negociacao.atualizado_por && negociacao.atualizado_por !== nomeAtualizadoPor && (
                  <> ({negociacao.atualizado_por})</>
                )}
              </>
            )}
          </p>
        </div>
        {emAndamento && <BotaoCancelarNegociacao id={negociacao.id} />}
      </div>

      {minhaVezDeResponder && ultimaRodada && (
        <div className="mb-6">
          <FormularioContraproposta
            negociacaoId={negociacao.id}
            autor={souPosto ? "posto" : "cliente"}
            ultimaRodada={{
              combustivel: ultimaRodada.combustivel,
              vigencia_inicio: ultimaRodada.vigencia_inicio,
              vigencia_fim: ultimaRodada.vigencia_fim,
              volume_minimo_mensal: ultimaRodada.volume_minimo_mensal,
              preco_unitario: ultimaRodada.preco_unitario,
            }}
          />
        </div>
      )}

      {emAndamento && !minhaVezDeResponder && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aguardando resposta {souPosto ? "do cliente" : "do posto"}.
        </p>
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-900">Histórico de rodadas</h2>
      <div className="space-y-3">
        {(rodadas ?? []).map((r) => (
          <div key={r.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rodada #{r.numero_rodada} — proposta de {r.autor === "cliente" ? "cliente" : "posto"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {r.decisao === "pendente"
                  ? "Aguardando"
                  : r.decisao === "aceita"
                    ? "Aceita"
                    : r.decisao === "recusada"
                      ? "Recusada"
                      : "Contraproposta enviada"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Combustível</p>
                <p className="text-slate-700">{r.combustivel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Volume mínimo</p>
                <p className="text-slate-700">{r.volume_minimo_mensal.toLocaleString("pt-BR")} L/mês</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Preço por litro</p>
                <p className="text-slate-700">{formatarMoeda(r.preco_unitario)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vigência</p>
                <p className="text-slate-700">
                  {formatarDataBr(r.vigencia_inicio)} – {formatarDataBr(r.vigencia_fim)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
