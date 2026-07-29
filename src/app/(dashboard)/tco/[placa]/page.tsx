import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";

function paraISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type SearchParams = { empresa?: string; inicio?: string; fim?: string };

export default async function TcoVeiculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { placa: placaParam } = await params;
  const placa = decodeURIComponent(placaParam).toUpperCase();
  const { empresa: empresaParam, inicio, fim } = await searchParams;

  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const agora = new Date();
  const inicioDefault = new Date(agora);
  inicioDefault.setDate(inicioDefault.getDate() - 90);
  const dataInicio = inicio || paraISO(inicioDefault);
  const dataFim = fim || paraISO(agora);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o TCO deste veículo.
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

  const { data, error } = await supabase.rpc("tco_veiculo", {
    p_empresa_id: empresaSelecionada,
    p_placa: placa,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
  });

  const v = data?.[0];
  if (error || !v) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/tco" className="text-xs text-slate-500 hover:underline">
            ← Voltar para TCO
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {v.placa} <span className="font-normal text-slate-500">— {[v.marca, v.modelo].filter(Boolean).join(" ") || "veículo sem marca/modelo"}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {v.centro_custo_nome ?? "Sem centro de custo"} · {v.ano_fabricacao ?? "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">TCO total no período</p>
          <p className="text-3xl font-bold text-slate-900">{formatarMoeda(v.tco_total)}</p>
          <p className="text-sm text-slate-500">
            {v.custo_por_km !== null ? `${formatarMoeda(v.custo_por_km)}/km` : "custo/km indisponível (sem km no período)"}
          </p>
        </div>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-2">
        <input type="hidden" name="empresa" value={empresaSelecionada} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className="input text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Recalcular
        </button>
      </form>

      {!v.tco_completo && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Este veículo não tem <strong>valor de aquisição</strong> cadastrado — o TCO acima é{" "}
          <strong>operacional</strong> (sem depreciação).{" "}
          <Link href="/veiculos" className="underline">
            Complete o cadastro
          </Link>{" "}
          pra ver o TCO completo.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ComponenteCard label="⛽ Combustível" valor={v.custo_combustivel} />
        <ComponenteCard label="🔧 Manutenção" valor={v.custo_manutencao} />
        <ComponenteCard label="🚨 Multas" valor={v.custo_multas} />
        <ComponenteCard label="🛠️ Oficinas credenciadas" valor={v.custo_oficinas} />
        <ComponenteCard label="📋 Custos fixos" valor={v.custo_fixos} />
        <ComponenteCard
          label="📉 Depreciação"
          valor={v.custo_depreciacao}
          indisponivel={v.custo_depreciacao === null}
        />
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Dados de aquisição</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Valor de aquisição</p>
            <p className="mt-1 text-slate-900">{v.valor_aquisicao !== null ? formatarMoeda(v.valor_aquisicao) : "Não cadastrado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Data de aquisição</p>
            <p className="mt-1 text-slate-900">
              {v.data_aquisicao ? new Date(v.data_aquisicao + "T00:00:00").toLocaleDateString("pt-BR") : "Não cadastrada"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Valor residual estimado</p>
            <p className="mt-1 text-slate-900">
              {v.valor_residual_estimado !== null
                ? formatarMoeda(v.valor_residual_estimado)
                : v.valor_aquisicao !== null
                  ? `${formatarMoeda(v.valor_aquisicao * 0.2)} (estimado em 20%)`
                  : "—"}
            </p>
          </div>
        </div>
        <Link href={`/veiculos`} className="mt-4 inline-block text-xs text-frota-600 hover:underline">
          Editar dados de aquisição em Veículos →
        </Link>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Km no período:{" "}
        {v.km_periodo !== null
          ? `${Math.round(v.km_periodo).toLocaleString("pt-BR")} km`
          : "sem abastecimentos com hodômetro no período"}
        .
      </p>
    </div>
  );
}

function ComponenteCard({
  label,
  valor,
  indisponivel,
}: {
  label: string;
  valor: number | null;
  indisponivel?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${indisponivel ? "text-slate-300" : "text-slate-900"}`}>
        {indisponivel || valor === null ? "—" : formatarMoeda(valor)}
      </p>
    </div>
  );
}
