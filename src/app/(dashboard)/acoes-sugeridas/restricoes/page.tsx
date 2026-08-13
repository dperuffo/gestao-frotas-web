import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { ToggleRestricaoTipo } from "./_components/ToggleRestricaoTipo";
import { LiberarBloqueio } from "./_components/LiberarBloqueio";

// Fase Bloqueio-por-Anomalia — pedido do Daniel: "colocar um seletor para o
// tipo de anomalia para que o usuário selecione para restringir o
// abastecimento... terá que ser desenvolvida uma API para que sistemas ERPs
// externos consumam a informação e a plataforma seja consultada no ato do
// abastecimento". Decisão confirmada: configuração por tela (liga/desliga
// por tipo, não por aprovação individual) + reaproveitar a API de Antifraude
// já existente (POST /api/integracoes/antifraude/verificar) em vez de criar
// uma rota nova — ver comentário nesse arquivo.
//
// Só os 5 tipos com alvo em veículo/motorista aparecem aqui —
// posto_acima_media já remove o posto da rede negociada, não faz sentido
// "bloquear abastecimento" pra esse tipo (o check da migration já reflete
// isso).
const TIPOS: { tipo: string; label: string; descricao: string }[] = [
  {
    tipo: "cnh_vencida",
    label: "CNH vencida",
    descricao: "Bloqueia o motorista (por CPF) além de deixá-lo Inativo no cadastro.",
  },
  {
    tipo: "hodometro_fora_padrao",
    label: "Hodômetro fora do padrão",
    descricao: "Bloqueia o veículo (por placa) além de cadastrar o limite de variação.",
  },
  {
    tipo: "volume_tanque",
    label: "Volume acima do tanque",
    descricao: "Bloqueia o veículo (por placa) além de cadastrar o limite de volume diário.",
  },
  {
    tipo: "geo_distancia",
    label: "Postos distantes no mesmo dia",
    descricao: "Bloqueia o veículo (por placa) além de cadastrar o intervalo mínimo entre abastecimentos.",
  },
  {
    tipo: "preco_regiao",
    label: "Preço fora da média regional",
    descricao: "Bloqueia o veículo (por placa) além de marcar as anomalias como revisadas.",
  },
  {
    tipo: "posto_nao_autorizado",
    label: "Posto não autorizado",
    // Fase Antifraude→Ações-Sugeridas — migrado do tipo "localizacao_posto"
    // de Antifraude, agora com o mesmo toggle informativo/restritivo.
    descricao: "Bloqueia o veículo (por placa) que abasteceu fora da lista de postos autorizados.",
  },
];

type ConfigRow = { tipo: string; restringir_abastecimento: boolean };
type BloqueioRow = {
  id: number;
  alvo_tipo: string;
  alvo_ref: string;
  alvo_label: string | null;
  tipo_origem: string;
  motivo: string | null;
  criado_em: string;
};

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.label]));

export default async function RestricoesAbastecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let config: ConfigRow[] = [];
  let bloqueiosAtivos: BloqueioRow[] = [];

  if (empresaSelecionada) {
    const [{ data: configRaw }, { data: bloqueiosRaw }] = await Promise.all([
      supabase
        .from("acoes_sugeridas_config_restricao")
        .select("tipo, restringir_abastecimento")
        .eq("empresa_id", empresaSelecionada),
      supabase
        .from("bloqueios_abastecimento")
        .select("id, alvo_tipo, alvo_ref, alvo_label, tipo_origem, motivo, criado_em")
        .eq("empresa_id", empresaSelecionada)
        .eq("ativo", true)
        .order("criado_em", { ascending: false }),
    ]);
    config = configRaw ?? [];
    bloqueiosAtivos = bloqueiosRaw ?? [];
  }

  const configPorTipo = new Map(config.map((c) => [c.tipo, c.restringir_abastecimento]));

  return (
    <div>
      <Link href="/acoes-sugeridas" className="mb-4 inline-block text-sm text-frota-600 hover:underline">
        ← Voltar para Ações Sugeridas
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Restrições Automáticas de Abastecimento</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha quais tipos de anomalia, ao serem aprovados em Ações Sugeridas, também bloqueiam a placa/motorista
          de abastecer — o bloqueio é consultado automaticamente pela API de Antifraude (POST
          /api/integracoes/antifraude/verificar), o mesmo endpoint que sistemas de ERP já chamam antes de autorizar
          um abastecimento{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para configurar as restrições dele.</p>
      ) : (
        <>
          <div className="card mb-8 divide-y divide-slate-100">
            {TIPOS.map((t) => {
              const ativo = configPorTipo.get(t.tipo) ?? false;
              return (
                <div key={t.tipo} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{t.descricao}</p>
                  </div>
                  <ToggleRestricaoTipo empresaId={empresaSelecionada} tipo={t.tipo} ativo={ativo} />
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Bloqueios ativos ({bloqueiosAtivos.length})
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Alvo</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bloqueiosAtivos.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {b.alvo_tipo === "motorista" ? "Motorista" : "Veículo"}
                      </span>
                      <br />
                      <span className="font-medium text-slate-900">{b.alvo_label ?? b.alvo_ref}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{TIPO_LABEL[b.tipo_origem] ?? b.tipo_origem}</td>
                    <td className="px-4 py-3 max-w-md text-slate-600">{b.motivo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(b.criado_em)}</td>
                    <td className="px-4 py-3">
                      <LiberarBloqueio id={b.id} alvoLabel={b.alvo_label ?? b.alvo_ref} />
                    </td>
                  </tr>
                ))}
                {bloqueiosAtivos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum bloqueio ativo no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
