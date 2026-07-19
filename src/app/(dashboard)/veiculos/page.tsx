import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { ToggleAtivoVeiculo } from "./_components/ToggleAtivoVeiculo";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { Paginacao, calcularPaginacao } from "@/components/Paginacao";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";

const POR_PAGINA = 30;

type Veiculo = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  tipo_veiculo: string | null;
  classificacao: string | null;
  tipo: string | null;
  ativo: boolean | null;
  centro_custo_nome: string | null;
  municipio: string | null;
  uf_veiculo: string | null;
};

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string; page?: string }>;
}) {
  const { q, empresa: empresaParam, page: pageParam } = await searchParams;
  const supabase = await createClient();

  // Fase 27.5 — achado real: a visão do admin não tinha seletor de cliente
  // aqui, então misturava a frota de TODOS os clientes numa lista só (2388
  // veículos juntos). Mesmo padrão de /postos, /relatorios e do dashboard.
  // cadastro_veiculos não tem empresa_id (o vínculo é por cnpj_frota) — por
  // isso, quando há cliente selecionado, busca via a RPC veiculos_da_empresa,
  // que já resolve a normalização de CNPJ (ver Fase 14/27.3 no README) em vez
  // de comparar cnpj_frota cru.
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let veiculos: Veiculo[] = [];
  let error: { message: string } | null = null;
  let totalGeral = 0;
  let totalAtivos = 0;

  if (empresaSelecionada) {
    // Fase 27.38 — buscarTodosVeiculosDaEmpresa pagina a RPC em lotes de
    // 1000 (limite padrão de resposta do Supabase/PostgREST) — sem isso,
    // clientes com mais de 1000 veículos só viam parte da frota aqui.
    const { data, error: rpcErro } = await buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada);
    error = rpcErro ? { message: rpcErro } : null;
    veiculos = data;
    totalGeral = veiculos.length;
    totalAtivos = veiculos.filter((v) => v.ativo).length;
  } else if (empresas.length === 0) {
    // Admin sem nenhum cliente selecionado ainda: nada pra listar até
    // escolher (evita repetir o vazamento cross-tenant que gerou este ajuste).
    veiculos = [];
  } else {
    // Só cai aqui pra quem tem exatamente 1 empresa (resolverEmpresaAtual já
    // pré-seleciona nesse caso) — mantém o comportamento anterior via query
    // direta, mais simples que passar por RPC quando não há ambiguidade.
    let query = supabase
      .from("cadastro_veiculos")
      .select(
        "id, placa, marca, modelo, tipo_veiculo, classificacao, tipo, ativo, centro_custo_nome, municipio, uf_veiculo"
      )
      .order("placa");
    const { data, error: queryError } = await query;
    error = queryError;
    veiculos = data ?? [];
    totalGeral = veiculos.length;
    totalAtivos = veiculos.filter((v) => v.ativo).length;
  }

  const termoBusca = (q ?? "").trim().toLowerCase();
  const veiculosFiltrados = termoBusca
    ? veiculos.filter(
        (v) =>
          v.placa?.toLowerCase().includes(termoBusca) ||
          v.marca?.toLowerCase().includes(termoBusca) ||
          v.modelo?.toLowerCase().includes(termoBusca)
      )
    : veiculos;

  // Fase 27.12 — a frota já é buscada inteira nesta página (RPC/queries acima
  // não têm range/offset — ver comentário da Fase 27.5), então a paginação
  // aqui é feita em memória, só na hora de renderizar a tabela: mostra 30 por
  // vez em vez da frota inteira numa lista só. O total do paginador é sobre
  // o resultado JÁ filtrado pela busca (veiculosFiltrados).
  const { paginaAtual, totalPaginas } = calcularPaginacao(veiculosFiltrados.length, POR_PAGINA, pageParam);
  const veiculosDaPagina = veiculosFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Veículos <AjudaIcon chave="veiculos.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro da frota, especificações técnicas e centro de custo
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/veiculos/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/veiculos/novo" className="btn-primary">
            + Novo Veículo
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

      {!empresaSelecionada && empresas.length > 1 ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver a frota dele.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Total de veículos" valor={totalGeral} />
            <Indicador label="Ativos" valor={totalAtivos} />
            <Indicador label="Inativos" valor={totalGeral - totalAtivos} />
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <form>
              {/* Fase 27.31 — achado real: este form é SEPARADO do form do
                  seletor de Cliente acima. Como cada <form> só envia os
                  próprios campos ao submeter (mesmo estando na mesma página),
                  buscar aqui derrubava o ?empresa= da URL e a tela voltava a
                  pedir a seleção do cliente. Mesmo bug corrigido em
                  /abastecimentos e /motoristas. */}
              <input type="hidden" name="empresa" value={empresaParam ?? ""} />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por placa, marca ou modelo..."
                className="input max-w-sm"
              />
            </form>
            <BotaoExportarTabela
              nomeArquivo="veiculos"
              titulo="Veículos"
              subtitulo={nomeEmpresaSelecionada ?? "Fleet Network Intelligence"}
              colunas={[
                { header: "Placa", chave: "placa" },
                { header: "Marca/Modelo", chave: "marcaModelo" },
                { header: "Tipo Veículo", chave: "tipoVeiculo" },
                { header: "Tipo", chave: "tipo" },
                { header: "Classificação", chave: "classificacao" },
                { header: "Centro de custo", chave: "centroCusto" },
                { header: "Localização", chave: "localizacao" },
                { header: "Status", chave: "status" },
              ]}
              linhas={veiculosFiltrados.map((v) => ({
                placa: v.placa,
                marcaModelo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
                tipoVeiculo: v.tipo_veiculo ?? "—",
                tipo: v.tipo ?? "—",
                classificacao: v.classificacao ?? "—",
                centroCusto: v.centro_custo_nome ?? "—",
                localizacao: [v.municipio, v.uf_veiculo].filter(Boolean).join("/") || "—",
                status: v.ativo ? "Ativo" : "Inativo",
              }))}
            />
          </div>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar veículos: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Marca/Modelo</th>
                  <th className="px-4 py-3">Tipo Veículo</th>
                  {/* Fase 27.124 — porte (Leve/Pesado), campo novo e distinto
                      de "Tipo Veículo" (carroceria) e "Classificação"
                      (Próprio/Agregado). */}
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">Centro de custo</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {veiculosDaPagina.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/veiculos/${v.id}`} className="font-medium text-frota-600 hover:underline">
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.tipo_veiculo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.tipo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.classificacao ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{v.centro_custo_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[v.municipio, v.uf_veiculo].filter(Boolean).join("/") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={v.ativo ? "badge-ativo" : "badge-inativo"}>{v.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ToggleAtivoVeiculo id={v.id} ativo={v.ativo ?? false} />
                    </td>
                  </tr>
                ))}
                {veiculosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Nenhum veículo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4">
              <Paginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                totalRegistros={veiculosFiltrados.length}
                porPagina={POR_PAGINA}
                basePath="/veiculos"
                paramsAtuais={{ q, empresa: empresaParam }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
