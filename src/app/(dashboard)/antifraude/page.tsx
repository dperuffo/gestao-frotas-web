import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { ToggleStatusRegraAntifraude } from "./_components/ToggleStatusRegraAntifraude";
import { ExcluirRegraAntifraude } from "./_components/ExcluirRegraAntifraude";
import { AvisoFalhasVerificacao } from "./_components/AvisoFalhasVerificacao";

// Fase 27.15x — "Regras Antifraude": o cliente cadastra regras (com
// vigência) que um sistema externo (bandeira de cartão, posto, gateway de
// pagamento) consulta ANTES de autorizar um abastecimento — ver
// POST /api/integracoes/antifraude/verificar. Mesmo padrão estrutural de
// /parametros-uso (Fase 27.120): abas trocadas via ?tipo= (Link), filtro de
// status via ?status=, tudo Server Component (sem useState pra navegação).

// Fase Antifraude→Ações-Sugeridas — o tipo "localizacao_posto" foi migrado
// pra Ações Sugeridas (novo tipo "posto_nao_autorizado", ver
// /acoes-sugeridas), reaproveitando parametros_postos_permitidos como fonte
// da lista de postos autorizados e ganhando o toggle informativo/restritivo
// já existente lá. Linhas antigas desse tipo em regras_antifraude continuam
// no banco (não migradas/removidas), só não aparecem mais aqui.
type TipoRegra = "limite_valor_quantidade" | "janela_tempo_frequencia";

const ABAS: { tipo: TipoRegra; label: string }[] = [
  { tipo: "limite_valor_quantidade", label: "Limite de valor/quantidade" },
  { tipo: "janela_tempo_frequencia", label: "Janela de tempo/frequência" },
];

const LABEL_ESCOPO: Record<string, string> = {
  motorista: "Motorista",
  veiculo: "Veículo",
  empresa: "Empresa toda",
};

type RegraRow = {
  id: string;
  nome: string;
  escopo: string;
  escopo_referencia: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  status: string;
};

export default async function AntifraudePage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; status?: string; tipo?: string }>;
}) {
  const { empresa: empresaParam, status: statusParam, tipo: tipoParam } = await searchParams;
  const tipo = ABAS.some((a) => a.tipo === tipoParam) ? (tipoParam as TipoRegra) : ABAS[0].tipo;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  function linkAba(tipoAba: string) {
    const params = new URLSearchParams();
    if (empresaParam) params.set("empresa", empresaParam);
    if (tipoAba !== ABAS[0].tipo) params.set("tipo", tipoAba);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  function linkFiltroStatus(valor: string) {
    const params = new URLSearchParams();
    if (empresaParam) params.set("empresa", empresaParam);
    if (tipo !== ABAS[0].tipo) params.set("tipo", tipo);
    if (valor) params.set("status", valor);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  let regras: RegraRow[] = [];
  let erroConsulta: string | undefined;
  if (empresaSelecionada) {
    let query = supabase
      .from("regras_antifraude")
      .select("id, nome, escopo, escopo_referencia, vigencia_inicio, vigencia_fim, status")
      .eq("empresa_id", empresaSelecionada)
      .eq("tipo", tipo)
      .order("criado_em", { ascending: false });
    if (statusParam === "Ativo" || statusParam === "Inativo") query = query.eq("status", statusParam);
    const { data, error } = await query;
    regras = data ?? [];
    erroConsulta = error?.message;
  }

  // Falhas de verificação (fail-open) ainda não lidas — independem do
  // cliente selecionado acima (a RLS já escopa por todas as empresas que o
  // usuário enxerga), mostradas como aviso no topo da tela.
  const { data: falhasRaw } = await supabase
    .from("antifraude_verificacoes_falhas")
    .select("id, detalhe, criado_em")
    .is("lida_em", null)
    .order("criado_em", { ascending: false });

  return (
    <div>
      <AvisoFalhasVerificacao falhas={falhasRaw ?? []} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🛡️ Antifraude</h1>
          <p className="mt-1 text-sm text-slate-500">
            Regras que sistemas externos (bandeira de cartão, posto, gateway de pagamento) consultam antes de
            autorizar um abastecimento
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/antifraude/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Nova Regra
          </Link>
        )}
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
          <input type="hidden" name="tipo" value={tipo === ABAS[0].tipo ? "" : tipo} />
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {ABAS.map((a) => (
          <Link
            key={a.tipo}
            href={linkAba(a.tipo)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tipo === a.tipo ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver as regras dele.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={linkFiltroStatus("")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!statusParam ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Todos ({regras.length})
            </Link>
            <Link
              href={linkFiltroStatus("Ativo")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusParam === "Ativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Ativas
            </Link>
            <Link
              href={linkFiltroStatus("Inativo")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusParam === "Inativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Inativas
            </Link>
          </div>

          <div className="card overflow-x-auto">
            {erroConsulta && <p className="p-4 text-sm text-red-600">Erro ao carregar regras: {erroConsulta}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Escopo</th>
                  <th className="px-4 py-3">Vigência</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regras.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.nome}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {LABEL_ESCOPO[r.escopo] ?? r.escopo}
                      {r.escopo_referencia ? ` — ${r.escopo_referencia}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(r.vigencia_inicio)} até {r.vigencia_fim ? formatDate(r.vigencia_fim) : "sem prazo"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/antifraude/${r.id}/editar`} className="text-xs font-medium text-frota-600 hover:underline">
                          Editar
                        </Link>
                        <ToggleStatusRegraAntifraude id={r.id} ativo={r.status === "Ativo"} />
                        <ExcluirRegraAntifraude id={r.id} nome={r.nome} />
                      </div>
                    </td>
                  </tr>
                ))}
                {regras.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma regra cadastrada. Clique em &quot;Nova Regra&quot; para começar.
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
