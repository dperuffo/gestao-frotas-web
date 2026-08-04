import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { normalizarCNPJ } from "@/lib/utils";
import { FormularioAjuste } from "./_components/FormularioAjuste";
import { BotaoExcluirAjuste } from "./_components/BotaoExcluirAjuste";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

const TIPO_AJUSTE_LABEL: Record<string, string> = {
  reavaliacao: "Reavaliação",
  melhoria: "Melhoria (capitalização)",
  baixa: "Baixa (venda/perda total)",
};

type SearchParams = { empresa?: string };

export default async function PatrimonioVeiculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { placa: placaParam } = await params;
  const placa = decodeURIComponent(placaParam).toUpperCase();
  const { empresa: empresaParam } = await searchParams;

  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <BotaoVoltar href="/patrimonio" />
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o patrimônio deste veículo.
        </p>
        <form className="mt-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Ver
          </button>
        </form>
      </div>
    );
  }

  const [{ data, error }, { data: empresaRow }] = await Promise.all([
    supabase.rpc("patrimonio_veiculo", { p_empresa_id: empresaSelecionada, p_placa: placa }),
    supabase.from("empresas").select("cnpj").eq("id", empresaSelecionada).maybeSingle(),
  ]);

  const v = data?.[0];
  if (error || !v) {
    notFound();
  }

  // A RPC não devolve o id (uuid) do veículo — resolve aqui pra poder
  // registrar ajustes (patrimonio_ajustes.veiculo_id é FK).
  const { data: candidatos } = await supabase.from("cadastro_veiculos").select("id, cnpj_frota").eq("placa", placa);
  const cnpjEmpresaNorm = normalizarCNPJ(empresaRow?.cnpj);
  const veiculoId = candidatos?.find((c) => normalizarCNPJ(c.cnpj_frota) === cnpjEmpresaNorm)?.id ?? null;

  const { data: ajustes } = veiculoId
    ? await supabase
        .from("patrimonio_ajustes")
        .select("id, tipo, valor, data_ajuste, motivo, criado_em")
        .eq("veiculo_id", veiculoId)
        .order("data_ajuste", { ascending: false })
    : { data: [] };

  return (
    <div>
      <BotaoVoltar href={`/patrimonio?empresa=${empresaSelecionada}`} label="Voltar para Patrimônio" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {v.placa}{" "}
            <span className="font-normal text-slate-500">
              — {[v.marca, v.modelo].filter(Boolean).join(" ") || "veículo sem marca/modelo"}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {v.centro_custo_nome ?? "Sem centro de custo"} · {v.ano_fabricacao ?? "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Valor contábil líquido</p>
          <p className="text-3xl font-bold text-slate-900">
            {v.valor_contabil_liquido !== null ? formatarMoeda(v.valor_contabil_liquido) : "—"}
          </p>
          {v.baixado ? (
            <p className="text-sm font-medium text-slate-500">Baixado em {formatarData(v.data_baixa)}</p>
          ) : (
            v.percentual_depreciado !== null && <p className="text-sm text-slate-500">{v.percentual_depreciado}% depreciado</p>
          )}
        </div>
      </div>

      {!v.patrimonio_completo && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Este veículo não tem <strong>valor de aquisição</strong> cadastrado — não é possível calcular a
          depreciação contábil.{" "}
          <Link href="/veiculos" className="underline">
            Complete o cadastro
          </Link>{" "}
          pra ver o patrimônio completo.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampoResumo label="Valor de aquisição" valor={v.valor_aquisicao !== null ? formatarMoeda(v.valor_aquisicao) : "—"} />
        <CampoResumo label="Data de aquisição" valor={formatarData(v.data_aquisicao)} />
        <CampoResumo
          label="Vida útil"
          valor={v.vida_util_anos !== null ? `${v.vida_util_anos} ano(s) (${v.meses_vida_util} meses)` : "—"}
        />
        <CampoResumo label="Idade" valor={v.meses_decorridos !== null ? `${v.meses_decorridos} mês(es)` : "—"} />
        <CampoResumo label="Valor residual estimado" valor={v.valor_residual_estimado !== null ? formatarMoeda(v.valor_residual_estimado) : "—"} />
        <CampoResumo label="Melhorias capitalizadas" valor={formatarMoeda(v.valor_melhorias)} />
        <CampoResumo label="Reavaliações acumuladas" valor={formatarMoeda(v.valor_reavaliacoes)} />
        <CampoResumo label="Depreciação acumulada" valor={v.depreciacao_acumulada !== null ? formatarMoeda(v.depreciacao_acumulada) : "—"} />
      </div>

      <Link href="/veiculos" className="mb-6 inline-block text-xs text-frota-600 hover:underline">
        Editar valor de aquisição, data e vida útil em Veículos →
      </Link>

      <div className="mb-6 card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Correções do ativo</h2>
        <p className="mb-4 text-xs text-slate-500">
          Reavaliação (ajusta o valor contábil pra cima/baixo), melhoria (capitalização que aumenta a base
          depreciável, ex.: baú novo) ou baixa (venda, perda total, sinistro — encerra a depreciação na data
          informada).
        </p>

        <div className="mb-4 divide-y divide-slate-100">
          {(ajustes ?? []).length === 0 && <p className="py-3 text-sm text-slate-400">Nenhum ajuste registrado ainda.</p>}
          {(ajustes ?? []).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{TIPO_AJUSTE_LABEL[a.tipo] ?? a.tipo}</span>{" "}
                  <span className={a.valor < 0 ? "text-red-600" : "text-slate-600"}>{formatarMoeda(a.valor)}</span>
                  {" · "}
                  {formatarData(a.data_ajuste)}
                </p>
                {a.motivo && <p className="mt-0.5 text-xs text-slate-500">{a.motivo}</p>}
              </div>
              <BotaoExcluirAjuste ajusteId={a.id} placa={placa} empresaId={empresaSelecionada} />
            </div>
          ))}
        </div>

        {veiculoId && <FormularioAjuste veiculoId={veiculoId} placa={placa} empresaId={empresaSelecionada} />}
      </div>
    </div>
  );
}

function CampoResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}
