import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_ANTIFRAUDE_VERIFICAR } from "@/lib/apiKeys";
import type { Json } from "@/types/database.types";
import { logger } from "@/lib/logger";

// Fase 27.15x — Regras Antifraude (proposta em PROPOSTA-ANTIFRAUDE.md): um
// sistema externo (bandeira de cartão, posto, gateway de pagamento) chama
// este endpoint ANTES de liberar um abastecimento. Diferente dos endpoints
// de "Parâmetros de Uso" (que só devolvem os dados crus da regra e deixam o
// sistema externo decidir), aqui a PLATAFORMA já avalia as regras ativas do
// cliente e devolve o veredito pronto: autorizado ou não, com o motivo.
//
// Decisão importante (confirmada com o Daniel): se algo falhar durante a
// avaliação (erro de banco, timeout etc.), a resposta é FAIL-OPEN —
// `autorizado: true` mesmo assim, nunca trava a operação do cliente por uma
// falha nossa — mas a falha fica registrada em antifraude_verificacoes_falhas
// (alimenta o badge no menu de "Antifraude" e, na Fase seguinte, dispara um
// e-mail de aviso) pra o cliente saber que aquele abastecimento específico
// não foi checado e possa investigar antes do próximo.
//
// Fase Bloqueio-por-Anomalia — esta mesma rota também nega abastecimentos
// para placas/motoristas em bloqueios_abastecimento (ver
// /acoes-sugeridas/restricoes) — reaproveitada em vez de criar uma segunda
// rota, pra um ERP externo continuar fazendo UMA chamada só no ato do
// abastecimento.
export const runtime = "nodejs";

type CorpoRequisicao = {
  placa?: string;
  motorista_cpf?: string;
  posto_cnpj?: string;
  data_hora?: string;
  litros?: number;
  valor_total?: number;
};

type CondicoesLimiteValorQuantidade = {
  litros_max_dia?: number;
  valor_max_abastecimento?: number;
};
type CondicoesJanelaTempoFrequencia = {
  intervalo_minimo_horas?: number;
  horario_permitido?: { inicio?: string | null; fim?: string | null };
};
type RegraRow = {
  id: string;
  tipo: "limite_valor_quantidade" | "janela_tempo_frequencia";
  escopo: "motorista" | "veiculo" | "empresa";
  escopo_referencia: string | null;
  condicoes: CondicoesLimiteValorQuantidade & CondicoesJanelaTempoFrequencia;
};

function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

// Extrai HH:MM do horário de "parede" indicado no ISO 8601 recebido (ex.:
// "2026-07-16T14:30:00-03:00" → "14:30") — não converte pra UTC de
// propósito: "horário permitido" precisa comparar com o horário local de
// quem abasteceu, não com UTC.
function horaMinutoLocal(dataHoraIso: string): string | null {
  const m = dataHoraIso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function dentroDoHorario(horaMin: string, inicio?: string | null, fim?: string | null): boolean {
  if (!inicio && !fim) return true;
  if (inicio && horaMin < inicio) return false;
  if (fim && horaMin > fim) return false;
  return true;
}

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_ANTIFRAUDE_VERIFICAR);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  let corpo: CorpoRequisicao;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  const placa = corpo.placa?.trim() ? normalizarPlaca(corpo.placa) : null;
  const motoristaCpf = corpo.motorista_cpf?.trim() || null;
  const dataHora = corpo.data_hora?.trim() || new Date().toISOString();
  const litros = Number(corpo.litros ?? 0);
  const valorTotal = Number(corpo.valor_total ?? 0);

  if (Number.isNaN(new Date(dataHora).getTime())) {
    return NextResponse.json({ erro: '"data_hora" precisa ser uma data/hora válida (ISO 8601).' }, { status: 400 });
  }

  try {
    const hoje = dataHora.slice(0, 10);
    const inicioDoDia = `${hoje}T00:00:00`;
    const fimDoDiaExclusivo = new Date(new Date(`${hoje}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Fase Bloqueio-por-Anomalia — pedido do Daniel: quando uma ação sugerida
    // (CNH vencida, hodômetro fora do padrão, volume acima do tanque, postos
    // distantes, preço fora da média) é aprovada E o cliente tem essa
    // restrição ligada (ver /acoes-sugeridas/restricoes), a placa/motorista
    // fica registrada em bloqueios_abastecimento até alguém liberar
    // manualmente. Checado ANTES das regras_antifraude porque é um bloqueio
    // mais direto (originado de uma ação já aprovada por um gestor, não uma
    // regra genérica) — mas o efeito é o mesmo: nega a autorização.
    if (placa || motoristaCpf) {
      const { data: bloqueiosRaw, error: erroBloqueios } = await supabase
        .from("bloqueios_abastecimento")
        .select("id, alvo_tipo, alvo_ref, alvo_label, tipo_origem, motivo")
        .eq("empresa_id", chave.empresaId)
        .eq("ativo", true);

      if (erroBloqueios) throw new Error(erroBloqueios.message);

      const bloqueioAplicavel = (bloqueiosRaw ?? []).find((b) => {
        if (b.alvo_tipo === "veiculo") return placa !== null && normalizarPlaca(b.alvo_ref) === placa;
        if (b.alvo_tipo === "motorista") return motoristaCpf !== null && b.alvo_ref === motoristaCpf;
        return false;
      });

      if (bloqueioAplicavel) {
        await marcarUsoChaveApi(supabase, chave.id);
        return NextResponse.json({
          autorizado: false,
          motivo: bloqueioAplicavel.motivo ?? `Abastecimento restrito (${bloqueioAplicavel.alvo_label ?? bloqueioAplicavel.alvo_ref}).`,
          bloqueio_id: bloqueioAplicavel.id,
        });
      }
    }

    const { data: regrasRaw, error: erroRegras } = await supabase
      .from("regras_antifraude")
      .select("id, tipo, escopo, escopo_referencia, condicoes")
      .eq("empresa_id", chave.empresaId)
      .eq("status", "Ativo")
      .lte("vigencia_inicio", hoje)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`);

    if (erroRegras) throw new Error(erroRegras.message);

    const regras = (regrasRaw ?? []) as unknown as RegraRow[];

    // Só as regras que de fato se aplicam a esta transação: empresa toda,
    // ou o motorista/veículo específico informado no corpo da requisição.
    const regrasAplicaveis = regras.filter((r) => {
      if (r.escopo === "empresa") return true;
      if (r.escopo === "motorista") return motoristaCpf !== null && r.escopo_referencia === motoristaCpf;
      if (r.escopo === "veiculo") return placa !== null && r.escopo_referencia !== null && normalizarPlaca(r.escopo_referencia) === placa;
      return false;
    });

    for (const regra of regrasAplicaveis) {
      if (regra.tipo === "limite_valor_quantidade") {
        const { valor_max_abastecimento, litros_max_dia } = regra.condicoes;

        if (valor_max_abastecimento !== undefined && valorTotal > valor_max_abastecimento) {
          return NextResponse.json({
            autorizado: false,
            motivo: `Valor do abastecimento (R$ ${valorTotal.toFixed(2)}) excede o limite de R$ ${valor_max_abastecimento.toFixed(2)} por abastecimento.`,
            regra_id: regra.id,
          });
        }

        if (litros_max_dia !== undefined) {
          let query = supabase
            .from("abastecimentos_unificado")
            .select("litros")
            .eq("empresa_id", chave.empresaId)
            .gte("data_abastecimento", inicioDoDia)
            .lt("data_abastecimento", fimDoDiaExclusivo);
          if (regra.escopo === "veiculo" && placa) query = query.eq("placa", placa);
          if (regra.escopo === "motorista" && motoristaCpf) {
            // abastecimentos_unificado só tem motorista_nome (texto livre),
            // não CPF — resolve o nome uma vez a partir do cadastro de
            // motoristas pra poder filtrar.
            const { data: motorista } = await supabase
              .from("motoristas")
              .select("nome_completo")
              .eq("empresa_id", chave.empresaId)
              .eq("cpf", motoristaCpf)
              .maybeSingle();
            if (motorista?.nome_completo) query = query.eq("motorista_nome", motorista.nome_completo);
          }
          const { data: abastecimentosHoje } = await query;
          const litrosJaHoje = (abastecimentosHoje ?? []).reduce((soma, a) => soma + Number(a.litros ?? 0), 0);
          const litrosComEsteAbastecimento = litrosJaHoje + litros;

          if (litrosComEsteAbastecimento > litros_max_dia) {
            return NextResponse.json({
              autorizado: false,
              motivo: `Limite diário de ${litros_max_dia}L excedido (já abastecido hoje: ${litrosJaHoje.toFixed(1)}L, mais este de ${litros.toFixed(1)}L).`,
              regra_id: regra.id,
            });
          }
        }
      }

      if (regra.tipo === "janela_tempo_frequencia") {
        const { intervalo_minimo_horas, horario_permitido } = regra.condicoes;

        if (horario_permitido) {
          const horaMin = horaMinutoLocal(dataHora);
          if (horaMin && !dentroDoHorario(horaMin, horario_permitido.inicio, horario_permitido.fim)) {
            return NextResponse.json({
              autorizado: false,
              motivo: `Fora do horário permitido (${horario_permitido.inicio ?? "00:00"}–${horario_permitido.fim ?? "23:59"}).`,
              regra_id: regra.id,
            });
          }
        }

        if (intervalo_minimo_horas !== undefined && placa) {
          const { data: ultimo } = await supabase
            .from("abastecimentos_unificado")
            .select("data_abastecimento")
            .eq("empresa_id", chave.empresaId)
            .eq("placa", placa)
            .lt("data_abastecimento", dataHora)
            .order("data_abastecimento", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ultimo?.data_abastecimento) {
            const horasDesdeUltimo =
              (new Date(dataHora).getTime() - new Date(ultimo.data_abastecimento).getTime()) / (1000 * 60 * 60);
            if (horasDesdeUltimo < intervalo_minimo_horas) {
              return NextResponse.json({
                autorizado: false,
                motivo: `Intervalo mínimo de ${intervalo_minimo_horas}h entre abastecimentos não respeitado (último foi há ${horasDesdeUltimo.toFixed(1)}h).`,
                regra_id: regra.id,
              });
            }
          }
        }
      }

    }

    // Fase Pré-Pedido — pedido do Daniel: quando o parâmetro de uso
    // "Pré-Pedido" está habilitado (ver /parametros-uso), presume-se que
    // toda viagem tem um Plano de Viagem com pontos de abastecimento
    // pré-agendados (gerados automaticamente a partir do Roteirizador
    // Inteligente — ver planos-viagem/actions.ts). Abastecimento só é
    // autorizado num posto que conste como parada pendente daquela placa
    // — checado por último, depois de bloqueios/regras, e só marca a
    // parada como atendida na borda do sucesso (se algo acima já tivesse
    // negado, a parada continuaria disponível pro próximo posto).
    const { data: paramPrePedido } = await supabase
      .from("parametros_pre_pedido")
      .select("habilitado")
      .eq("empresa_id", chave.empresaId)
      .maybeSingle();

    if (paramPrePedido?.habilitado) {
      if (!placa) {
        return NextResponse.json({
          autorizado: false,
          motivo: "Pré-Pedido habilitado para este cliente: é necessário informar a placa do veículo pra autorizar o abastecimento.",
        });
      }

      const postoCnpj = corpo.posto_cnpj?.replace(/\D/g, "") ?? "";
      if (!postoCnpj) {
        return NextResponse.json({
          autorizado: false,
          motivo: "Pré-Pedido habilitado para este cliente: é necessário informar o CNPJ do posto pra autorizar o abastecimento.",
        });
      }

      const { data: prePedidosRaw, error: erroPrePedidos } = await supabase
        .from("pre_pedidos")
        .select("id, pre_pedidos_paradas(id, posto_cnpj, atendido)")
        .eq("empresa_id", chave.empresaId)
        .eq("placa", placa)
        .eq("status", "ativo");

      if (erroPrePedidos) throw new Error(erroPrePedidos.message);

      const paradaPendente = (prePedidosRaw ?? [])
        .flatMap((pp) => pp.pre_pedidos_paradas)
        .find((parada) => !parada.atendido && parada.posto_cnpj.replace(/\D/g, "") === postoCnpj);

      if (!paradaPendente) {
        return NextResponse.json({
          autorizado: false,
          motivo: "Nenhum Pré-Pedido ativo desta empresa prevê abastecimento desta placa neste posto.",
        });
      }

      await supabase
        .from("pre_pedidos_paradas")
        .update({
          atendido: true,
          atendido_em: new Date().toISOString(),
          abastecimento_referencia: corpo as unknown as Json,
        })
        .eq("id", paradaPendente.id);
    }

    await marcarUsoChaveApi(supabase, chave.id);
    return NextResponse.json({ autorizado: true });
  } catch (erro) {
    // Fail-open: nunca bloqueia o cliente por uma falha nossa, mas registra
    // pra ele saber e poder investigar antes do próximo abastecimento (Fase
    // seguinte adiciona o e-mail de aviso — ver antifraude_verificacoes_falhas
    // e PROPOSTA-ANTIFRAUDE.md, seção 6).
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido ao avaliar as regras.";
    const { data: falhaRegistrada } = await supabase
      .from("antifraude_verificacoes_falhas")
      .insert({
        empresa_id: chave.empresaId,
        detalhe: mensagem,
        abastecimento_referencia: corpo as unknown as Json,
      })
      .select("id")
      .single();

    // Best-effort (mesmo padrão de notificarNegociacao em
    // negociacoesPostos.ts) — se o e-mail falhar, o registro da falha já foi
    // salvo normalmente, só o aviso por e-mail que não sai.
    if (falhaRegistrada?.id) {
      try {
        await supabase.functions.invoke("antifraude-email", { body: { falha_id: falhaRegistrada.id } });
      } catch (erroEmail) {
        void logger.error("antifraude", "Falha ao notificar por e-mail (ignorado)", erroEmail);
      }
    }

    await marcarUsoChaveApi(supabase, chave.id);
    return NextResponse.json({
      autorizado: true,
      aviso:
        "Não foi possível concluir a verificação antifraude — abastecimento autorizado por padrão. O cliente foi notificado para revisar.",
    });
  }
}
