import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { StatusBadge } from "../_components/StatusBadge";
import { ComponenteCard } from "../_components/ComponenteCard";
import { RegistrarManutencaoForm } from "../_components/RegistrarManutencaoForm";
import { HistoricoManutencoes } from "../_components/HistoricoManutencoes";
import { ORDEM_COMPONENTES, gerarRecomendacoes, type StatusManutencao } from "@/lib/manutencaoPreditiva";

type SearchParams = { empresa?: string };

export default async function DetalheManutencaoPreditivaPage({
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
        <Link href="/manutencao-preditiva" className="mb-4 inline-block text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <div className="card max-w-lg space-y-4 p-6">
          <p className="text-sm text-slate-600">Selecione o cliente para ver a análise deste veículo.</p>
          <form className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
              <select name="empresa" defaultValue="" className="input">
                <option value="">Selecione...</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Ver
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { data: componentesRaw, error } = await supabase.rpc("manutencao_preditiva_base", {
    p_empresa_id: empresaSelecionada,
    p_placa: placa,
  });

  if (error || !componentesRaw || componentesRaw.length === 0) notFound();

  const componentes = componentesRaw;
  const primeiro = componentes[0];
  const somaPeso = componentes.reduce((s, c) => s + c.peso, 0);
  const scoreGeral = Math.round(componentes.reduce((s, c) => s + c.score * c.peso, 0) / somaPeso);
  const status: StatusManutencao = scoreGeral >= 70 ? "ok" : scoreGeral >= 40 ? "alerta" : "critico";

  const componentesOrdenados = [...componentes].sort(
    (a, b) => ORDEM_COMPONENTES.indexOf(a.componente as never) - ORDEM_COMPONENTES.indexOf(b.componente as never)
  );

  const recomendacoes = gerarRecomendacoes(componentes, primeiro.degradacao, primeiro.idade_anos);

  const { data: historicoRaw } = await supabase
    .from("manutencoes_realizadas")
    .select("id, data_manutencao, hodometro, itens_realizados, oficina, custo_total, dias_parado, tipo, criado_por, fotos")
    .eq("placa", placa)
    .order("data_manutencao", { ascending: false })
    .limit(100);

  // Fase Checklist-Digital-Manutenção — o bucket é privado (evidência de
  // manutenção não é dado público), então resolvemos uma signed URL de
  // curta duração pra cada foto aqui no servidor, mesmo padrão já usado em
  // chamados/[id]/page.tsx pros anexos de chamado.
  const historico = await Promise.all(
    (historicoRaw ?? []).map(async (r) => {
      const caminhos = r.fotos ?? [];
      if (caminhos.length === 0) return { ...r, fotosUrls: [] };
      const fotosUrls = await Promise.all(
        caminhos.map(async (caminho) => {
          const { data } = await supabase.storage.from("manutencao-evidencias").createSignedUrl(caminho, 3600);
          return { url: data?.signedUrl ?? "", nome: caminho.split("/").pop() ?? caminho };
        })
      );
      return { ...r, fotosUrls: fotosUrls.filter((f) => f.url) };
    })
  );

  return (
    <div>
      <Link href="/manutencao-preditiva" className="mb-4 inline-block text-sm text-frota-600 hover:underline">
        ← Voltar
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{placa}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[primeiro.marca, primeiro.modelo].filter(Boolean).join(" ") || "Sem marca/modelo cadastrado"}
            {primeiro.tipo_veiculo ? ` · ${primeiro.tipo_veiculo}` : ""}
            {primeiro.idade_anos > 0 ? ` · ${primeiro.idade_anos} anos` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{scoreGeral}/100</p>
            <p className="text-xs text-slate-400">score geral</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Km atual" valor={primeiro.km_atual > 0 ? `${Math.round(primeiro.km_atual).toLocaleString("pt-BR")} km` : "—"} />
        <Indicador
          label="Consumo atual"
          valor={primeiro.consumo_atual != null ? `${primeiro.consumo_atual.toFixed(2)} km/L` : "—"}
        />
        <Indicador
          label="Degradação de consumo"
          valor={primeiro.degradacao > 0 ? `${Math.round(primeiro.degradacao * 100)}%` : "—"}
        />
        <Indicador label="Centro de custo" valor={primeiro.centro_custo_nome ?? "—"} />
      </div>

      {recomendacoes.length > 0 && (
        <div className="mb-6 card space-y-1.5 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">💡 Recomendações</h2>
          {recomendacoes.map((r, i) => (
            <p key={i} className="text-sm text-slate-700">
              {r}
            </p>
          ))}
        </div>
      )}

      <div className="mb-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Detalhamento por componente</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {componentesOrdenados.map((c) => (
            <ComponenteCard key={c.componente} c={c} />
          ))}
        </div>
      </div>

      <div className="mb-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">📝 Registrar Manutenção Realizada</h2>
        <p className="mb-4 text-xs text-slate-500">
          Registre manutenções realizadas para melhorar a precisão da análise preditiva.
        </p>
        <RegistrarManutencaoForm empresaId={empresaSelecionada} placa={placa} kmAtual={primeiro.km_atual} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">📋 Histórico de Manutenções</h2>
        <HistoricoManutencoes placa={placa} registros={historico ?? []} />
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
