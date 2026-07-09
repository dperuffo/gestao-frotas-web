import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { IndicadorNotasFiscais } from "./_components/IndicadorNotasFiscais";
import { UploadNotaFiscal } from "./_components/UploadNotaFiscal";

const POR_PAGINA = 20;

// Fase 27.94/27.95 — pedido do Daniel: upload de NF-e (posto), consulta de
// status (cliente/posto/admin) e painel de indicadores (% emitido/pendente,
// barra de progresso). Mesma tela serve as 3 visões — `resolverEmpresaAtual`
// já resolve se o usuário só tem 1 empresa (auto-seleciona) ou precisa
// escolher (admin, ou membro de várias empresas via grupo econômico).
export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; pagina?: string; apenasPendentes?: string }>;
}) {
  const { empresa: empresaParam, pagina: paginaParam, apenasPendentes: apenasPendentesParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const pagina = Math.max(1, Number(paginaParam) || 1);
  const apenasPendentes = apenasPendentesParam === "1";

  if (!empresaSelecionada) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Notas Fiscais</h1>
        {empresas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa disponível.</p>
        ) : (
          <div className="card p-4">
            <p className="mb-3 text-sm text-slate-600">Selecione a empresa:</p>
            <div className="flex flex-wrap gap-2">
              {empresas.map((e) => (
                <Link key={e.id} href={`/notas-fiscais?empresa=${e.id}`} className="btn-secondary">
                  {e.nome}
                </Link>
              ))}
            </div>
          </div>
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

  const { data: indicadorData } = await supabase.rpc("indicador_notas_fiscais", { p_empresa_id: empresaSelecionada });
  const indicador = (indicadorData ?? { total: 0, com_nota: 0, sem_nota: 0, percentual: 0 }) as {
    total: number;
    com_nota: number;
    sem_nota: number;
    percentual: number;
  };

  const { data: linhas } = await supabase.rpc("abastecimentos_com_status_nota_fiscal", {
    p_empresa_id: empresaSelecionada,
    p_apenas_pendentes: apenasPendentes,
    p_limit: POR_PAGINA,
    p_offset: (pagina - 1) * POR_PAGINA,
  });
  const totalLinhas = linhas?.[0]?.total_count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(Number(totalLinhas) / POR_PAGINA));

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({
      empresa: empresaSelecionada,
      ...(apenasPendentes ? { apenasPendentes: "1" } : {}),
      ...overrides,
    });
    return `/notas-fiscais?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notas Fiscais</h1>
          {nomeEmpresaSelecionada && <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>}
        </div>
        {empresas.length > 1 && (
          <Link href="/notas-fiscais" className="text-sm text-frota-600 hover:underline">
            Trocar empresa
          </Link>
        )}
      </div>

      <IndicadorNotasFiscais
        total={indicador.total}
        comNota={indicador.com_nota}
        semNota={indicador.sem_nota}
        percentual={indicador.percentual}
      />

      {ehPosto && <UploadNotaFiscal />}

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Abastecimentos (últimos 90 dias)</h2>
          <div className="flex gap-2 text-xs">
            <Link href={qs({ apenasPendentes: "", pagina: "1" })} className={!apenasPendentes ? "font-semibold text-frota-600" : "text-slate-500"}>
              Todos
            </Link>
            <Link href={qs({ apenasPendentes: "1", pagina: "1" })} className={apenasPendentes ? "font-semibold text-frota-600" : "text-slate-500"}>
              Só pendentes
            </Link>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">NF-e</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(linhas ?? []).map((l) => (
              <tr key={l.abastecimento_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{formatarDataBr(l.data_abastecimento)}</td>
                <td className="px-4 py-3 text-slate-600">{l.cliente_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.posto_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.veiculo_placa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{l.item_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatarMoeda(l.item_valor_total)}</td>
                <td className="px-4 py-3">
                  {l.nota_id ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Emitida{l.nota_numero ? ` · Nº ${l.nota_numero}` : ""}
                    </span>
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
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento encontrado nos últimos 90 dias.
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
    </div>
  );
}
