import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { ToggleStatusVinculo } from "./_components/ToggleStatusVinculo";

// Fase 27.120 — primeira tela de "Parâmetros de Uso" (pedido do Daniel: um
// anexo com uma sugestão de tela de referência trazia 10 tipos de regra
// pra balizar abastecimentos feitos em soluções externas de automação de
// posto/meios de pagamento). Construindo um tipo completo (Vínculo
// Motorista ↔ Veículo — banco, tela e API) primeiro pra validar o padrão
// antes de replicar pros outros 9, que aparecem aqui como abas "Em breve".
const OUTRAS_ABAS = [
  "Intervalo",
  "Valor Diário",
  "Vol. Diário",
  "Produto",
  "Hodôm. Leve",
  "Hodôm. Pesado",
  "Dias/Horários",
  "Postos",
  "Serviços",
  "Cotas",
];

type VinculoRow = {
  id: string;
  placa: string;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string; cpf: string } | null;
};

export default async function ParametrosUsoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; status?: string }>;
}) {
  const { empresa: empresaParam, status: statusParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let vinculos: VinculoRow[] = [];
  let error: { message: string } | null = null;

  if (!semClienteEscolhido && empresaSelecionada) {
    let query = supabase
      .from("parametros_vinculo_motorista_veiculo")
      .select("id, placa, data_inicio, data_fim, status, observacao, motoristas(nome_completo, cpf)")
      .eq("empresa_id", empresaSelecionada)
      .order("placa");

    if (statusParam === "Ativo" || statusParam === "Inativo") {
      query = query.eq("status", statusParam);
    }

    const { data, error: queryError } = await query;
    vinculos = (data ?? []) as unknown as VinculoRow[];
    error = queryError;
  }

  function linkFiltroStatus(valor: string) {
    const params = new URLSearchParams();
    if (empresaParam) params.set("empresa", empresaParam);
    if (valor) params.set("status", valor);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Parâmetros de Uso <AjudaIcon chave="parametros-uso.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Regras que balizam abastecimentos feitos em postos ou soluções de automação/meios de pagamento integrados
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href="/parametros-uso/novo" className="btn-primary">
            + Novo Vínculo
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
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {/* Fase 27.120 — barra de abas: só "Vínculo" está implementada; os
          outros 9 tipos do anexo do Daniel entram em fases seguintes. */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <span className="rounded-full bg-frota-600 px-3 py-1 text-xs font-medium text-white">
          Vínculo Motorista ↔ Veículo
        </span>
        {OUTRAS_ABAS.map((aba) => (
          <span
            key={aba}
            title="Em breve"
            className="cursor-not-allowed rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400"
          >
            {aba}
          </span>
        ))}
      </div>

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os parâmetros dele.</p>
      ) : (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm text-slate-600">
              Associa um motorista a um veículo específico. Abastecimentos feitos em postos ou soluções de automação
              integradas via API podem ser autorizados apenas quando o par motorista/veículo estiver{" "}
              <strong>ativo</strong> neste cadastro.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href={linkFiltroStatus("")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                !statusParam ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Todos ({vinculos.length})
            </Link>
            <Link
              href={linkFiltroStatus("Ativo")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusParam === "Ativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Ativos
            </Link>
            <Link
              href={linkFiltroStatus("Inativo")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusParam === "Inativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Inativos
            </Link>
          </div>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar vínculos: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Data início</th>
                  <th className="px-4 py-3">Data fim</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Observação</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vinculos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{v.placa}</td>
                    <td className="px-4 py-3 text-slate-600">{v.motoristas?.nome_completo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.motoristas?.cpf ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(v.data_inicio)}</td>
                    <td className="px-4 py-3 text-slate-600">{v.data_fim ? formatDate(v.data_fim) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={v.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{v.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.observacao ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/parametros-uso/${v.id}/editar`} className="text-xs font-medium text-frota-600 hover:underline">
                          Editar
                        </Link>
                        <ToggleStatusVinculo id={v.id} ativo={v.status === "Ativo"} />
                      </div>
                    </td>
                  </tr>
                ))}
                {vinculos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum vínculo encontrado. Clique em &quot;Novo Vínculo&quot; para associar um motorista a um
                      veículo.
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
