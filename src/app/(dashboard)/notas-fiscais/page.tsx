import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { mensagemMotivoPendencia } from "@/lib/nfe";
import { RecolhaPorCiclo, type CicloNfe } from "./_components/RecolhaPorCiclo";
import { UploadNotaFiscal } from "./_components/UploadNotaFiscal";

const POR_PAGINA = 20;

// Fase 27.94/27.95 — pedido do Daniel: upload de NF-e (posto), consulta de
// status (cliente/posto/admin) e painel de indicadores (% emitido/pendente,
// barra de progresso). Mesma tela serve as 3 visões — `resolverEmpresaAtual`
// já resolve se o usuário só tem 1 empresa (auto-seleciona) ou precisa
// escolher (admin, ou membro de várias empresas via grupo econômico).
// Fase 27.100 — pedido do Daniel: "criar filtros de seleção de status de NF
// para facilitar a busca pelo usuário". Antes só existia "Todos / Só
// pendentes", que misturava "Rejeitada" (Fase 27.99) e "Pendente" (nunca
// tentou) no mesmo filtro — como a tela já distingue os 2 visualmente, o
// filtro passou a distinguir também.
// Fase NFE-1 — pedido do Daniel: "apresentar o percentual de recolha por
// ciclo, seja o status que ele estiver". O indicador único de "últimos 90
// dias" virou 1 card por ciclo de faturamento (o aberto atual + os últimos
// já fechados, de cada negociação posto↔cliente), e a tabela de
// abastecimentos abaixo passou a ser escopada ao ciclo selecionado (não
// mais uma janela fixa) — ver nfe_recolha_por_ciclo()/abastecimentos_do_ciclo_nfe()
// no banco.
const STATUS_VALIDOS = new Set(["emitida", "rejeitada", "pendente"]);

export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{
    empresa?: string;
    pagina?: string;
    status?: string;
    busca?: string;
    ciclo?: string;
  }>;
}) {
  const { empresa: empresaParam, pagina: paginaParam, status: statusParam, busca: buscaParam, ciclo: cicloParam } =
    await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const pagina = Math.max(1, Number(paginaParam) || 1);
  const status = statusParam && STATUS_VALIDOS.has(statusParam) ? statusParam : null;
  // Fase 27.104 — pedido do Daniel: ID de 10 dígitos por abastecimento,
  // buscável nos filtros ("em todas as visões").
  const busca = buscaParam?.trim() || null;

  if (!empresaSelecionada) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Notas Fiscais</h1>
        </div>
        {empresas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa disponível.</p>
        ) : (
          <form className="mb-4 flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
              <select name="empresa" defaultValue="" className="input text-sm">
                <option value="" disabled>
                  Selecione...
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary text-sm">
              Trocar
            </button>
          </form>
        )}
      </div>
    );
  }

  const { data: empresaInfo } = await supabase
    .from("empresas")
    .select("segmento")
    .eq("id", empresaSelecionada)
    .maybeSingle();
  const ehPosto = empresaInfo?.segmento === "Revenda";

  const { data: ciclosData } = await supabase.rpc("nfe_recolha_por_ciclo", {
    p_empresa_id: empresaSelecionada,
    p_qtd_fechados: 6,
  });
  const ciclos: CicloNfe[] = (ciclosData ?? [])
    .map((c) => ({
      negociacaoId: c.negociacao_id as string,
      postoNome: c.posto_nome as string,
      clienteNome: c.cliente_nome as string,
      faturaPostoId: c.fatura_posto_id as string | null,
      status: c.status as string,
      periodoInicio: c.periodo_inicio as string,
      periodoFim: c.periodo_fim as string,
      vencimento: c.vencimento as string,
      total: Number(c.total ?? 0),
      comNota: Number(c.com_nota ?? 0),
      semNota: Number(c.sem_nota ?? 0),
      rejeitadas: Number(c.rejeitadas ?? 0),
      percentual: c.percentual === null ? null : Number(c.percentual),
    }))
    // ciclo aberto primeiro, depois os fechados do mais recente pro mais antigo
    .sort((a, b) => {
      if (a.status === "aberto" && b.status !== "aberto") return -1;
      if (b.status === "aberto" && a.status !== "aberto") return 1;
      return b.periodoFim.localeCompare(a.periodoFim);
    });

  // Ciclo selecionado: vem do param `ciclo` (formato "negociacaoId|periodoInicio|periodoFim"),
  // ou cai no primeiro card da lista (ciclo aberto mais relevante) por padrão.
  const cicloAtivo =
    (cicloParam ? ciclos.find((c) => `${c.negociacaoId}|${c.periodoInicio}|${c.periodoFim}` === cicloParam) : null) ??
    ciclos[0] ??
    null;

  const { data: linhas } = cicloAtivo
    ? await supabase.rpc("abastecimentos_do_ciclo_nfe", {
        p_negociacao_id: cicloAtivo.negociacaoId,
        p_periodo_inicio: cicloAtivo.periodoInicio,
        p_periodo_fim: cicloAtivo.periodoFim,
        p_status: status,
        p_busca: busca,
        p_limit: POR_PAGINA,
        p_offset: (pagina - 1) * POR_PAGINA,
      })
    : { data: null };
  const totalLinhas = linhas?.[0]?.total_count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(Number(totalLinhas) / POR_PAGINA));

  // Contadores dos filtros "Todos/Emitida/Rejeitada/Pendente" vêm do próprio
  // ciclo selecionado (já calculados na RPC de ciclos), não mais de um
  // indicador global de 90 dias.
  const contagem = cicloAtivo
    ? {
        total: cicloAtivo.total,
        comNota: cicloAtivo.comNota,
        rejeitadas: cicloAtivo.rejeitadas,
        pendentes: cicloAtivo.semNota - cicloAtivo.rejeitadas,
      }
    : { total: 0, comNota: 0, rejeitadas: 0, pendentes: 0 };

  // Fase 27.99 — pedido do Daniel: evidenciar rejeições de upload de NF-e
  // com mais detalhe, não só "Pendente" genérico. Pendências sem
  // abastecimento identificado (ex.: CNPJ do cliente não cadastrado) não
  // aparecem na tabela abaixo (não tem em qual linha mostrar) — só o posto
  // vê essa seção, já que é ele quem precisa corrigir e reenviar o XML.
  const { data: pendenciasSemAbastecimento } = ehPosto
    ? await supabase.rpc("pendencias_sem_abastecimento", { p_empresa_id: empresaSelecionada, p_limit: 20 })
    : { data: null };

  const cicloParamAtivo = cicloAtivo ? `${cicloAtivo.negociacaoId}|${cicloAtivo.periodoInicio}|${cicloAtivo.periodoFim}` : "";

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({
      empresa: empresaSelecionada,
      ...(cicloParamAtivo ? { ciclo: cicloParamAtivo } : {}),
      ...(status ? { status } : {}),
      ...(busca ? { busca } : {}),
      ...overrides,
    });
    return `/notas-fiscais?${params.toString()}`;
  };

  const linkParaCiclo = (c: CicloNfe) =>
    qs({ ciclo: `${c.negociacaoId}|${c.periodoInicio}|${c.periodoFim}`, status: "", busca: "", pagina: "1" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Notas Fiscais</h1>
        {nomeEmpresaSelecionada && <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>}
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada} className="input text-sm">
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      <RecolhaPorCiclo
        ciclos={ciclos}
        ehPosto={ehPosto}
        cicloSelecionado={cicloAtivo ? { negociacaoId: cicloAtivo.negociacaoId, periodoInicio: cicloAtivo.periodoInicio, periodoFim: cicloAtivo.periodoFim } : null}
        linkParaCiclo={linkParaCiclo}
      />

      {ehPosto && <UploadNotaFiscal />}

      {/* Fase 27.104 — pedido do Daniel: "servirá de base e consulta para
          que o usuário encontre, rapidamente, o registro, seja ele com NFe
          ok ou com NFe rejeitada" — busca pelo ID de 10 dígitos do
          abastecimento (ILIKE parcial, aceita só o final do número).
          Fase 27.143 — o ID de 10 dígitos só existe pro lado PróFrotas; pra
          abastecimentos de outros provedores (Valecard, RedeFrota...) a
          mesma busca agora também casa placa, posto ou cliente. */}
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="empresa" value={empresaSelecionada} />
        <input type="hidden" name="ciclo" value={cicloParamAtivo} />
        <input type="hidden" name="status" value={status ?? ""} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar por ID, placa, posto ou cliente</label>
          <input
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Ex.: 1000165865, ABC1D23 ou nome do posto"
            className="input max-w-xs"
          />
        </div>
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {cicloAtivo
              ? `Abastecimentos do ciclo (${formatarDataBr(cicloAtivo.periodoInicio)} – ${formatarDataBr(cicloAtivo.periodoFim)})`
              : "Abastecimentos"}
          </h2>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href={qs({ status: "", pagina: "1" })} className={!status ? "font-semibold text-frota-600" : "text-slate-500"}>
              Todos ({contagem.total})
            </Link>
            <Link
              href={qs({ status: "emitida", pagina: "1" })}
              className={status === "emitida" ? "font-semibold text-green-700" : "text-slate-500"}
            >
              Emitida ({contagem.comNota})
            </Link>
            <Link
              href={qs({ status: "rejeitada", pagina: "1" })}
              className={status === "rejeitada" ? "font-semibold text-red-700" : "text-slate-500"}
            >
              Rejeitada ({contagem.rejeitadas})
            </Link>
            <Link
              href={qs({ status: "pendente", pagina: "1" })}
              className={status === "pendente" ? "font-semibold text-amber-700" : "text-slate-500"}
            >
              Pendente ({contagem.pendentes})
            </Link>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Fonte</th>
              <th className="px-4 py-3">NF-e</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Fase 27.143 — abastecimento_id só é único DENTRO de cada
                provedor (bigint de sequências independentes por
                tabela-fonte) — a chave da linha precisa incluir o
                provedor, senão um id PróFrotas e um id externo que
                coincidem por acaso colidiriam no React. */}
            {(linhas ?? []).map((l) => (
              <tr key={`${l.provedor}-${l.abastecimento_id}`} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{l.codigo_abastecimento ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{formatarDataBr(l.data_abastecimento)}</td>
                <td className="px-4 py-3 text-slate-600">{l.cliente_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.posto_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.veiculo_placa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.item_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatarMoeda(l.item_valor_total)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {l.provedor === "profrotas" ? (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">PróFrotas</span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                      {l.provedor}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.nota_id ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Emitida{l.nota_numero ? ` · Nº ${l.nota_numero}` : ""}
                    </span>
                  ) : l.pendencia_motivo ? (
                    <div>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejeitada</span>
                      <p className="mt-1 max-w-xs text-xs text-red-600">
                        {l.pendencia_motivo === "erro_leitura_xml" && l.pendencia_detalhe_texto
                          ? l.pendencia_detalhe_texto
                          : mensagemMotivoPendencia(l.pendencia_motivo)}
                      </p>
                      {/* Fase 27.103 — pedido do Daniel: "não deveria ter uma
                          relação do registro rejeitado com a tela de detalhe
                          abaixo?" — mesmos dados extraídos do XML já
                          mostrados na seção "Uploads sem abastecimento
                          correspondente", agora também aqui na própria
                          linha. */}
                      {(l.pendencia_nome_arquivo || l.pendencia_cnpj_emitente || l.pendencia_produto_nome_xml) && (
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          {l.pendencia_nome_arquivo ? `Arquivo: ${l.pendencia_nome_arquivo}` : ""}
                          {l.pendencia_cnpj_emitente ? `${l.pendencia_nome_arquivo ? " · " : ""}CNPJ emitente ${l.pendencia_cnpj_emitente}` : ""}
                          {l.pendencia_produto_nome_xml ? `, ${l.pendencia_produto_nome_xml}` : ""}
                          {l.pendencia_quantidade !== null ? `, ${l.pendencia_quantidade} L` : ""}
                          {l.pendencia_valor_total !== null ? `, ${formatarMoeda(l.pendencia_valor_total)}` : ""}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pendente</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {l.nota_id && (
                    <Link href={`/notas-fiscais/${l.nota_id}`} className="text-frota-600 hover:underline">
                      Ver NF-e
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {(linhas ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {cicloAtivo ? "Nenhum abastecimento encontrado neste ciclo." : "Nenhum ciclo de faturamento encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Página {pagina} de {totalPaginas} · {totalLinhas} abastecimento{Number(totalLinhas) === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={qs({ pagina: String(pagina - 1) })} className="text-frota-600 hover:underline">
                  Anterior
                </Link>
              )}
              {pagina < totalPaginas && (
                <Link href={qs({ pagina: String(pagina + 1) })} className="text-frota-600 hover:underline">
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {ehPosto && pendenciasSemAbastecimento && pendenciasSemAbastecimento.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Uploads sem abastecimento correspondente ({pendenciasSemAbastecimento.length})
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Estes XMLs foram rejeitados antes de encontrar um abastecimento pra vincular — confira os dados abaixo, corrija o
              que estiver errado (CNPJ, quantidade, valor) e envie o XML de novo.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Dados extraídos do XML</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendenciasSemAbastecimento.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatarDataBr(p.criado_em)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.nome_arquivo ?? "—"}</td>
                  <td className="px-4 py-3 text-red-700">
                    {p.motivo === "erro_leitura_xml" && p.detalhe_texto ? p.detalhe_texto : mensagemMotivoPendencia(p.motivo)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.cnpj_emitente || p.cnpj_destinatario ? (
                      <>
                        CNPJ emitente {p.cnpj_emitente ?? "—"}, CNPJ destinatário {p.cnpj_destinatario ?? "—"}
                        {p.produto_nome_xml ? `, ${p.produto_nome_xml}` : ""}
                        {p.quantidade !== null ? `, ${p.quantidade} L` : ""}
                        {p.valor_total !== null ? `, ${formatarMoeda(p.valor_total)}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
