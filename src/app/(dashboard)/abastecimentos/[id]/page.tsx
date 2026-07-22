import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import type { AutorAjuste } from "@/lib/ajustesAbastecimentos";
import { AbastecimentoForm } from "../_components/AbastecimentoForm";
import { ExcluirAbastecimento } from "../_components/ExcluirAbastecimento";
import { PainelAjusteAbastecimento } from "../_components/PainelAjusteAbastecimento";

// Fase 27.65 — solicitação de ajuste em abastecimentos, com aprovação da
// contraparte. Só entra nesse fluxo quando o registro tem uma contraparte de
// verdade cadastrada na plataforma: o CLIENTE (empresa_id, já é FK direta) E
// o POSTO (resolvido por CNPJ — pv_cnpj só é texto solto, não FK; precisa
// bater com uma empresa segmento="Revenda" cadastrada). Sem isso (posto
// avulso, não integrado à FNI), a edição continua direta, como sempre foi —
// não tem "outro lado" pra notificar/aprovar.
//
// Fase 27.68 — achado real: a resolução do posto (por CNPJ) e o nome do
// cliente eram lidos direto de `empresas` com o client do usuário logado,
// sujeito à RLS `empresas_select_membro` (só libera ver empresas das quais
// o usuário é membro, ou o e-mail superusuário/admin). Um cliente comum
// NUNCA é "membro" do posto — a busca vinha vazia, `temContraparte` dava
// falso, e a tela caía na edição direta escondendo o painel de ajuste,
// mesmo com uma solicitação de verdade pendente. Corrigido: (1) o nome do
// cliente agora vem do próprio `frota_razao_social` já denormalizado na
// linha do abastecimento (não precisa de join, mesmo espírito da Fase
// 27.51/27.64); (2) a resolução do posto por CNPJ agora usa a RPC
// SECURITY DEFINER `resolver_empresa_por_cnpj_segmento`, que faz essa
// checagem pontual sem depender da RLS de `empresas`.
export default async function EditarAbastecimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: abastecimento } = await supabase
    .from("profrotas_abastecimentos")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();
  if (!abastecimento) notFound();

  const nomeCliente = abastecimento.frota_razao_social ?? undefined;

  let empresaPostoId: string | null = null;
  if (abastecimento.pv_cnpj) {
    const { data } = await supabase.rpc("resolver_empresa_por_cnpj_segmento", {
      p_cnpj: abastecimento.pv_cnpj,
      p_segmento: "Revenda",
    });
    empresaPostoId = data ?? null;
  }

  const temContraparte = !!(abastecimento.empresa_id && empresaPostoId);

  if (!temContraparte) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Editar Abastecimento</h1>
            {/* Fase 27.104 — pedido do Daniel: ID de 10 dígitos por
                abastecimento, pra facilitar localizar/referenciar o registro. */}
            <p className="mt-1 text-xs text-slate-400">ID {abastecimento.codigo_abastecimento}</p>
          </div>
          <ExcluirAbastecimento id={abastecimento.id} />
        </div>
        <AbastecimentoForm abastecimento={abastecimento} empresas={[]} nomeEmpresaAtual={nomeCliente} />
      </div>
    );
  }

  // Resolve de que lado o usuário logado está (cliente ou posto) — mesmo
  // critério já usado em /negociacoes/[id] (Fase 27.51): confere qual das
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
    .eq("abastecimento_id", abastecimento.id)
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimento</h1>
        {/* Fase 27.104 — pedido do Daniel: ID de 10 dígitos por
            abastecimento, pra facilitar localizar/referenciar o registro. */}
        <p className="mt-1 text-xs text-slate-400">ID {abastecimento.codigo_abastecimento}</p>
        <p className="mt-1 text-sm text-slate-500">
          Este registro tem cliente e posto identificados na plataforma — qualquer correção precisa
          ser aprovada pela outra parte antes de valer.
        </p>
      </div>

      <div className="mb-6 card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Valores atuais</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <ValorAtual label="Data e hora" valor={formatarDataHoraBr(abastecimento.data_abastecimento)} />
          <ValorAtual label="Placa" valor={abastecimento.veiculo_placa ?? "—"} />
          <ValorAtual label="Motorista" valor={abastecimento.motorista_nome ?? "—"} />
          <ValorAtual label="Hodômetro" valor={abastecimento.hodometro != null ? `${abastecimento.hodometro.toLocaleString("pt-BR")} km` : "—"} />
          <ValorAtual label="Combustível" valor={abastecimento.item_nome ?? "—"} />
          <ValorAtual label="Litros" valor={abastecimento.item_quantidade != null ? `${abastecimento.item_quantidade.toLocaleString("pt-BR")} L` : "—"} />
          <ValorAtual
            label="Preço por litro"
            valor={abastecimento.item_valor_unitario != null ? abastecimento.item_valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          />
          <ValorAtual
            label="Valor total"
            valor={abastecimento.item_valor_total != null ? abastecimento.item_valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          />
          <ValorAtual label="Cliente" valor={nomeCliente ?? "—"} />
          <ValorAtual label="Posto" valor={abastecimento.pv_razao_social ?? "—"} />
        </div>
      </div>

      <PainelAjusteAbastecimento
        identificador={{ tipo: "profrotas", id: abastecimento.id }}
        empresaClienteId={abastecimento.empresa_id as string}
        empresaPostoId={empresaPostoId as string}
        meuLado={meuLado}
        ajusteAberto={ajusteAberto ?? null}
        rodadas={rodadas ?? []}
        cicloFechado={abastecimento.fatura_posto_id != null}
        valoresAtuais={{
          data_abastecimento: abastecimento.data_abastecimento,
          hodometro: abastecimento.hodometro,
          item_nome: abastecimento.item_nome,
          item_quantidade: abastecimento.item_quantidade,
          item_valor_unitario: abastecimento.item_valor_unitario,
          item_valor_total: abastecimento.item_valor_total,
        }}
      />
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
