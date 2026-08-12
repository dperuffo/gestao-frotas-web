import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";
import { ReplicarParaGrupoButton } from "@/components/replicacao/ReplicarParaGrupoButton";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// em Dashboard/Veículos/Financeiro/Abastecimentos/Manutenção/Notas Fiscais.
// AjudaIcon saiu daqui: só era usado dentro do Indicador() local removido
// abaixo — IndicadorColorido já expõe ajudaChave por conta própria.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Receipt, CheckCircle2, Truck } from "lucide-react";

type SearchParams = { empresa?: string };

export default async function CentrosCustoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let centros: {
    id: string;
    nome: string;
    codigo: string | null;
    responsavel: string | null;
    ativo: boolean | null;
    cadastro_veiculos: { count: number }[];
  }[] = [];
  let error: { message: string } | null = null;

  if (empresaSelecionada) {
    const resultado = await supabase
      .from("centros_custo")
      .select("id, nome, codigo, responsavel, ativo, cadastro_veiculos(count)")
      .eq("empresa_id", empresaSelecionada)
      .order("nome");
    centros = resultado.data ?? [];
    error = resultado.error;
  }

  const totalCentros = centros.length;
  const totalAtivos = centros.filter((c) => c.ativo).length;
  const totalVeiculosAlocados = centros.reduce((soma, c) => soma + (c.cadastro_veiculos?.[0]?.count ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Centros de Custo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize a frota do cliente em centros de custo e acompanhe a alocação dos veículos.
          </p>
        </div>
        {empresaSelecionada && (
          <div className="flex gap-2">
            <Link href="/centros-custo/importar" className="btn-secondary">
              Importar planilha
            </Link>
            <Link href={`/centros-custo/novo?empresa=${empresaSelecionada}`} className="btn-primary">
              + Novo Centro de Custo
            </Link>
          </div>
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

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver os centros de custo dele.
        </p>
      )}

      {empresaSelecionada && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Receipt} label="Total de centros" valor={String(totalCentros)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivos)} />
            <IndicadorColorido
              cor="violet"
              icon={Truck}
              label="Veículos alocados"
              valor={String(totalVeiculosAlocados)}
              ajudaChave="centros_custo.veiculos_alocados"
            />
          </div>

          <div className="mb-4 flex justify-end gap-3">
            <ReplicarParaGrupoButton
              chaveTabela="centros_custo"
              empresaId={empresaSelecionada}
              rotuloRegistro="os centros de custo"
            />
            <BotaoExportarTabela
              nomeArquivo="centros-de-custo"
              titulo="Centros de Custo"
              colunas={[
                { header: "Nome", chave: "nome" },
                { header: "Código", chave: "codigo" },
                { header: "Responsável", chave: "responsavel" },
                { header: "Veículos alocados", chave: "veiculos" },
                { header: "Status", chave: "status" },
              ]}
              linhas={centros.map((c) => ({
                nome: c.nome,
                codigo: c.codigo ?? "—",
                responsavel: c.responsavel ?? "—",
                veiculos: c.cadastro_veiculos?.[0]?.count ?? 0,
                status: c.ativo ? "Ativo" : "Inativo",
              }))}
            />
          </div>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar centros de custo: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Veículos alocados</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centros.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/centros-custo/${c.id}`} className="font-medium text-frota-600 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.codigo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.responsavel ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.cadastro_veiculos?.[0]?.count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={c.ativo ? "badge-ativo" : "badge-inativo"}>{c.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                  </tr>
                ))}
                {centros.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum centro de custo cadastrado para este cliente.
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
