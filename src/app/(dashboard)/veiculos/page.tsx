import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarVeiculosPaginado, buscarContagensVeiculos, buscarDistribuicaoVeiculos } from "@/lib/veiculos";
import { exportarVeiculosAcao } from "./actions";
import { ToggleAtivoVeiculo } from "./_components/ToggleAtivoVeiculo";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";
// Fase Dashboard-Redesign (12/08/2026) — mesmo toque visual do Dashboard
// (cor + ícone por indicador, ver benchmark de UX apps bancários) aplicado
// aqui como exemplo de tela densa (pedido do Daniel).
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, CheckCircle2, XCircle } from "lucide-react";
import { GraficoDistribuicaoVeiculos } from "./_components/GraficoDistribuicaoVeiculos";

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
  // Fase auto-cadastro-abastecimento — true quando o registro nasceu
  // automaticamente de uma importação de abastecimento (só placa, sem o
  // resto do cadastro) e ainda não foi revisado/completado pelo cliente.
  pendente_revisao: boolean;
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

  let veiculosDaPagina: Veiculo[] = [];
  let error: { message: string } | null = null;
  let totalGeral = 0;
  let totalAtivos = 0;
  let totalFiltrado = 0;
  let distribuicao: Awaited<ReturnType<typeof buscarDistribuicaoVeiculos>> = [];

  const termoBusca = (q ?? "").trim();
  // Fase Pente-Fino-Performance (10/09/2026, pedido do Daniel: "melhorar a
  // performance da aplicacao como um todo") — achado real (auditoria):
  // esta página buscava a frota INTEIRA do cliente (em lotes de 1000) em
  // todo carregamento, só pra mostrar 30 linhas por vez e somar uns totais.
  // Pra um cliente de teste com 2385 veículos, isso é 3 requisições HTTP e
  // um payload de ~2MB de JSON, sempre — mesmo abrindo a página 1 e nunca
  // rolando pras próximas. Agora: a tabela busca só a página atual
  // (veiculos_da_empresa_pagina, com LIMIT/OFFSET no banco) e os totais/
  // gráficos vêm de agregação SQL (veiculos_da_empresa_contagens/
  // _distribuicao) — o Node não recebe mais do que precisa mostrar. A
  // frota inteira só é buscada mesmo quando o usuário clica em Exportar
  // (ver exportarVeiculosAcao em actions.ts).
  if (empresaSelecionada) {
    const [contagens, dist, pagina] = await Promise.all([
      buscarContagensVeiculos(supabase, empresaSelecionada, termoBusca),
      buscarDistribuicaoVeiculos(supabase, empresaSelecionada, termoBusca),
      buscarVeiculosPaginado(supabase, empresaSelecionada, termoBusca, POR_PAGINA, offsetDaPagina(POR_PAGINA, pageParam)),
    ]);
    totalGeral = contagens.totalGeral;
    totalAtivos = contagens.totalAtivos;
    totalFiltrado = contagens.totalFiltrado;
    distribuicao = dist;
    error = pagina.error ? { message: pagina.error } : null;
    veiculosDaPagina = pagina.data;
  }

  // Só agora que já sabemos o total (contagem SQL acima) dá pra clampar a
  // página pedida (ex.: ?page=999 numa busca com só 2 resultados).
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalFiltrado, POR_PAGINA, pageParam);
  const porTipo = distribuicao.filter((d) => d.agrupamento === "tipo");
  const porStatus = distribuicao.filter((d) => d.agrupamento === "status");
  const porCentroCusto = distribuicao.filter((d) => d.agrupamento === "centro_custo");

  return (
    <div>
      <CabecalhoPagina
        titulo={
          <>
            Veículos <AjudaIcon chave="veiculos.pagina" />
          </>
        }
        descricao={
          <>
            Cadastro da frota, especificações técnicas e centro de custo
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </>
        }
        acoes={
          <>
            <Link href="/veiculos/importar" className="btn-secondary">
              Importar planilha
            </Link>
            <Link href="/veiculos/novo" className="btn-primary">
              + Novo Veículo
            </Link>
          </>
        }
      />

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
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Truck} label="Total de veículos" valor={String(totalGeral)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivos)} />
            <IndicadorColorido cor="red" icon={XCircle} label="Inativos" valor={String(totalGeral - totalAtivos)} />
          </div>

          {totalFiltrado > 0 && (
            <GraficoDistribuicaoVeiculos porTipo={porTipo} porStatus={porStatus} porCentroCusto={porCentroCusto} />
          )}

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
              carregarLinhas={
                empresaSelecionada
                  ? () => exportarVeiculosAcao(empresaSelecionada, termoBusca)
                  : async () => []
              }
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
                  <tr key={v.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                        <Link href={`/veiculos/${v.id}`} className="font-medium text-frota-600 hover:underline">
                          {v.placa}
                        </Link>
                        {v.pendente_revisao && (
                          <span className="badge-atencao" title="Criado automaticamente pela integração de abastecimentos — falta completar o cadastro">
                            Pendente
                          </span>
                        )}
                      </div>
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
                {totalFiltrado === 0 && (
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
                totalRegistros={totalFiltrado}
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Dashboard-Redesign).
