import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import type { AutorAjuste } from "@/lib/ajustesAbastecimentos";
import { PainelAjusteAbastecimento } from "../../_components/PainelAjusteAbastecimento";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

// Fase 27.142 — pedido do Daniel, sinalizado como "próximo passo" desde a
// Fase 27.136 ("O posto cobra do cliente sobre abastecimentos de outras
// modalidades de pagamentos [...] pode ter ajuste exatamente como um
// PróFrotas — só muda de qual das 2 tabelas-fonte o registro vem"): mesma
// tela de ajuste de /abastecimentos/[id] (Fase 27.65), agora também pro lado
// de abastecimentos_externos (Valecard/RedeFrota/TicketLog/Veloe...). O
// backend (decidir_ajuste_abastecimento) já sabia lidar com os dois lados
// desde a Fase 27.136 — só faltava esta tela pra CRIAR o pedido de ajuste.
//
// Diferenças de resolução em relação a /abastecimentos/[id]:
// - `empresa_id` já é o cliente diretamente (FK, não precisa resolver por
//   CNPJ como profrotas_abastecimentos.cnpj_frota).
// - Posto continua resolvido por CNPJ (posto_cnpj, texto solto) via a mesma
//   RPC `resolver_empresa_por_cnpj_segmento`.
// - Não existe edição direta pra este lado (os registros vêm só de
//   integração) — sem contraparte identificada, mostra só os dados em modo
//   leitura, sem formulário de edição.
export default async function EditarAbastecimentoExternoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: abastecimento } = await supabase
    .from("abastecimentos_externos")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();
  if (!abastecimento) notFound();

  const { data: nomeCliente } = await supabase.rpc("nome_empresa_publico", {
    p_empresa_id: abastecimento.empresa_id,
  });

  let empresaPostoId: string | null = null;
  if (abastecimento.posto_cnpj) {
    const { data } = await supabase.rpc("resolver_empresa_por_cnpj_segmento", {
      p_cnpj: abastecimento.posto_cnpj,
      p_segmento: "Revenda",
    });
    empresaPostoId = data ?? null;
  }

  const temContraparte = !!empresaPostoId;

  if (!temContraparte) {
    return (
      <div>
        <BotaoVoltar href="/abastecimentos" />
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Abastecimento</h1>
          {/* Fase 27.152/27.153 — mesmo ID de 10 dígitos de /abastecimentos/[id]
              (Fase 27.104), agora também pro lado externo (API/planilha). */}
          <p className="mt-1 text-xs text-slate-400">ID {abastecimento.codigo_abastecimento} · {abastecimento.provedor}</p>
        </div>
        <ValoresCard abastecimento={abastecimento} nomeCliente={nomeCliente ?? null} />
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Este posto ainda não está cadastrado na plataforma, então não há como abrir um pedido de
          ajuste com aprovação da contraparte para este registro.
        </p>
      </div>
    );
  }

  // Mesmo critério de /abastecimentos/[id] (Fase 27.51): confere qual das
  // duas empresas o usuário enxerga via RLS (empresas_do_usuario); quem não
  // bater com o posto é tratado como cliente.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: minhasEmpresas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  const souPostoLado = empresaPostoId && (minhasEmpresas ?? []).includes(empresaPostoId);
  const meuLado: AutorAjuste = souPostoLado ? "posto" : "cliente";

  const { data: ajusteAberto } = await supabase
    .from("ajustes_abastecimentos")
    .select("id, status")
    .eq("abastecimento_externo_id", abastecimento.id)
    .in("status", ["pendente_cliente", "pendente_posto"])
    .maybeSingle();

  const { data: rodadas } = ajusteAberto
    ? await supabase
        .from("ajustes_abastecimentos_rodadas")
        .select(
          "numero_rodada, autor, data_abastecimento, hodometro, item_nome, item_quantidade, item_valor_unitario, item_valor_total, motivo, decisao, criado_em"
        )
        .eq("ajuste_id", ajusteAberto.id)
        .order("numero_rodada", { ascending: true })
    : { data: [] };

  return (
    <div>
      <BotaoVoltar href="/abastecimentos" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimento</h1>
        {/* Fase 27.152/27.153 — mesmo ID de 10 dígitos de /abastecimentos/[id]
            (Fase 27.104), agora também pro lado externo (API/planilha). */}
        <p className="mt-1 text-xs text-slate-400">ID {abastecimento.codigo_abastecimento} · {abastecimento.provedor}</p>
        <p className="mt-1 text-sm text-slate-500">
          Este registro tem cliente e posto identificados na plataforma — qualquer correção precisa
          ser aprovada pela outra parte antes de valer.
        </p>
      </div>

      <ValoresCard abastecimento={abastecimento} nomeCliente={nomeCliente ?? null} />

      <div className="mt-6">
        <PainelAjusteAbastecimento
          identificador={{ tipo: "externo", id: abastecimento.id }}
          empresaClienteId={abastecimento.empresa_id}
          empresaPostoId={empresaPostoId as string}
          meuLado={meuLado}
          ajusteAberto={ajusteAberto ?? null}
          rodadas={rodadas ?? []}
          cicloFechado={abastecimento.fatura_posto_id != null}
          // Fase 27.142 — a rodada de ajuste usa os mesmos nomes de campo
          // genéricos (item_nome/item_quantidade/...) tanto pra
          // profrotas_abastecimentos quanto pra abastecimentos_externos
          // (ver decidir_ajuste_abastecimento, que mapeia item_nome→
          // combustivel etc. na hora de aplicar) — por isso os valores deste
          // lado precisam ser "traduzidos" pros nomes genéricos aqui.
          valoresAtuais={{
            data_abastecimento: abastecimento.data_abastecimento,
            hodometro: abastecimento.hodometro,
            item_nome: abastecimento.combustivel,
            item_quantidade: abastecimento.quantidade,
            item_valor_unitario: abastecimento.valor_unitario,
            item_valor_total: abastecimento.valor_total,
          }}
        />
      </div>
    </div>
  );
}

type AbastecimentoExterno = {
  data_abastecimento: string;
  placa: string;
  motorista_nome: string | null;
  hodometro: number | null;
  combustivel: string | null;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number;
  posto_nome: string | null;
};

function ValoresCard({ abastecimento, nomeCliente }: { abastecimento: AbastecimentoExterno; nomeCliente: string | null }) {
  return (
    <div className="mb-6 card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Valores atuais</h2>
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <ValorAtual label="Data e hora" valor={formatarDataHoraBr(abastecimento.data_abastecimento)} />
        <ValorAtual label="Placa" valor={abastecimento.placa ?? "—"} />
        <ValorAtual label="Motorista" valor={abastecimento.motorista_nome ?? "—"} />
        <ValorAtual
          label="Hodômetro"
          valor={abastecimento.hodometro != null ? `${abastecimento.hodometro.toLocaleString("pt-BR")} km` : "—"}
        />
        <ValorAtual label="Combustível" valor={abastecimento.combustivel ?? "—"} />
        <ValorAtual label="Litros" valor={abastecimento.quantidade != null ? `${abastecimento.quantidade.toLocaleString("pt-BR")} L` : "—"} />
        <ValorAtual
          label="Preço por litro"
          valor={
            abastecimento.valor_unitario != null
              ? abastecimento.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
        <ValorAtual
          label="Valor total"
          valor={
            abastecimento.valor_total != null
              ? abastecimento.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
        <ValorAtual label="Cliente" valor={nomeCliente ?? "—"} />
        <ValorAtual label="Posto" valor={abastecimento.posto_nome ?? "—"} />
      </div>
    </div>
  );
}

function ValorAtual({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-700">{valor}</p>
    </div>
  );
}
