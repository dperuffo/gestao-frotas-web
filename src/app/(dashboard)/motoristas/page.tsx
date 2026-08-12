import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { ToggleAtivoMotorista } from "./_components/ToggleAtivoMotorista";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";
// Fase Redesign-Telas-Densas (12/08/2026) — pedido do Daniel: "tem
// motoristas tambem para padronizar" — mesmo toque visual já aplicado em
// Veículos (mesmo padrão de ícones: total/ativos/inativos).
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Users, CheckCircle2, XCircle } from "lucide-react";

const POR_PAGINA = 30;

type Motorista = {
  id: string;
  nome_completo: string;
  // Fase auto-cadastro-abastecimento (27/07/2026) — cpf virou opcional no
  // banco (motorista pode nascer só com o nome, vindo de uma importação).
  cpf: string | null;
  telefone: string | null;
  classificacao: string;
  status: string;
  cnh_vencimento: string;
  empresas: { nome: string } | null;
  pendente_revisao: boolean;
};

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string; page?: string }>;
}) {
  const { q, empresa: empresaParam, page: pageParam } = await searchParams;
  const supabase = await createClient();

  // Fase 27.5 — mesmo ajuste de /veiculos: a visão do admin não tinha
  // seletor de cliente aqui e misturava motoristas de todos os clientes.
  // motoristas já tem empresa_id (uuid), então o filtro é um .eq() direto.
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  // Fase 27.12 — lista paginada (30 por página) via .range() no banco, em
  // vez de trazer todos os motoristas do cliente de uma vez. A contagem
  // usada no paginador é a do resultado JÁ filtrado por busca (q) — diferente
  // de totalGeral/totalAtivos abaixo, que são os totais da empresa (sem
  // filtro de busca), usados só nos cards de indicador.
  const offset = offsetDaPagina(POR_PAGINA, pageParam);

  let queryPagina = supabase
    .from("motoristas")
    .select("id, nome_completo, cpf, telefone, classificacao, status, cnh_vencimento, empresas(nome), pendente_revisao")
    .order("nome_completo");
  let queryContagemFiltrada = supabase.from("motoristas").select("id", { count: "exact", head: true });
  // Fase Exportar-Cadastros — a exportação (PDF/XLSX) precisa da lista
  // INTEIRA que bate com o filtro atual, não só os 30 da página em tela
  // (queryPagina tem .range()) — mesmos filtros de q/empresa, sem paginação.
  let queryExportacao = supabase
    .from("motoristas")
    .select("nome_completo, cpf, telefone, classificacao, status, cnh_vencimento, empresas(nome)")
    .order("nome_completo");

  if (q) {
    queryPagina = queryPagina.or(`nome_completo.ilike.%${q}%,cpf.ilike.%${q}%`);
    queryContagemFiltrada = queryContagemFiltrada.or(`nome_completo.ilike.%${q}%,cpf.ilike.%${q}%`);
    queryExportacao = queryExportacao.or(`nome_completo.ilike.%${q}%,cpf.ilike.%${q}%`);
  }
  if (empresaSelecionada) {
    queryPagina = queryPagina.eq("empresa_id", empresaSelecionada);
    queryContagemFiltrada = queryContagemFiltrada.eq("empresa_id", empresaSelecionada);
    queryExportacao = queryExportacao.eq("empresa_id", empresaSelecionada);
  }
  queryPagina = queryPagina.range(offset, offset + POR_PAGINA - 1);

  let totalAtivos = 0;
  let totalGeral = 0;
  let motoristas: Motorista[] = [];
  let motoristasExportacao: Omit<Motorista, "id">[] = [];
  let error: { message: string } | null = null;
  let totalFiltrado = 0;

  if (!semClienteEscolhido) {
    let queryAtivos = supabase.from("motoristas").select("id", { count: "exact", head: true }).eq("status", "Ativo");
    let queryGeral = supabase.from("motoristas").select("id", { count: "exact", head: true });
    if (empresaSelecionada) {
      queryAtivos = queryAtivos.eq("empresa_id", empresaSelecionada);
      queryGeral = queryGeral.eq("empresa_id", empresaSelecionada);
    }
    const [
      { count: ativos },
      { count: geral },
      { count: filtrado },
      { data, error: queryError },
      { data: dadosExportacao },
    ] = await Promise.all([queryAtivos, queryGeral, queryContagemFiltrada, queryPagina, queryExportacao]);
    totalAtivos = ativos ?? 0;
    totalGeral = geral ?? 0;
    totalFiltrado = filtrado ?? 0;
    motoristas = (data ?? []) as unknown as Motorista[];
    motoristasExportacao = (dadosExportacao ?? []) as unknown as Omit<Motorista, "id">[];
    error = queryError;
  }

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalFiltrado, POR_PAGINA, pageParam);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Motoristas <AjudaIcon chave="motoristas.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro de motoristas, CNH e vencimento, classificação e centro de custo
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/motoristas/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/motoristas/novo" className="btn-primary">
            + Novo Motorista
          </Link>
        </div>
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

      {semClienteEscolhido ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os motoristas dele.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Users} label="Total de motoristas" valor={String(totalGeral)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivos)} />
            <IndicadorColorido cor="red" icon={XCircle} label="Inativos" valor={String(totalGeral - totalAtivos)} />
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <form>
              {/* Fase 27.31 — achado real: este form é SEPARADO do form do
                  seletor de Cliente acima. Como cada <form> só envia os
                  próprios campos ao submeter (mesmo estando na mesma página),
                  buscar aqui derrubava o ?empresa= da URL e a tela voltava a
                  pedir a seleção do cliente. Mesmo bug corrigido em
                  /abastecimentos e /veiculos. */}
              <input type="hidden" name="empresa" value={empresaParam ?? ""} />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nome ou CPF..."
                className="input max-w-sm"
              />
            </form>
            <BotaoExportarTabela
              nomeArquivo="motoristas"
              titulo="Motoristas"
              subtitulo={nomeEmpresaSelecionada ?? "Fleet Network Intelligence"}
              colunas={[
                { header: "Nome", chave: "nome" },
                { header: "CPF", chave: "cpf" },
                { header: "Telefone", chave: "telefone" },
                { header: "Classificação", chave: "classificacao" },
                { header: "CNH vence em", chave: "cnhVencimento" },
                { header: "Cliente", chave: "cliente" },
                { header: "Status", chave: "status" },
              ]}
              linhas={motoristasExportacao.map((m) => ({
                nome: m.nome_completo,
                cpf: m.cpf,
                telefone: m.telefone ?? "—",
                classificacao: m.classificacao,
                cnhVencimento: formatDate(m.cnh_vencimento),
                cliente: m.empresas?.nome ?? "—",
                status: m.status,
              }))}
            />
          </div>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar motoristas: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">CNH vence em</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {motoristas.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/motoristas/${m.id}`} className="font-medium text-frota-600 hover:underline">
                          {m.nome_completo}
                        </Link>
                        {m.pendente_revisao && (
                          <span className="badge-atencao" title="Criado automaticamente pela integração de abastecimentos — falta completar o cadastro">
                            Pendente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.cpf ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m.telefone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m.classificacao}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(m.cnh_vencimento)}</td>
                    <td className="px-4 py-3 text-slate-600">{m.empresas?.nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={m.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ToggleAtivoMotorista id={m.id} ativo={m.status === "Ativo"} />
                    </td>
                  </tr>
                ))}
                {motoristas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum motorista encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4">
              <Paginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                totalRegistros={totalFiltrado}
                porPagina={POR_PAGINA}
                basePath="/motoristas"
                paramsAtuais={{ q, empresa: empresaParam }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
