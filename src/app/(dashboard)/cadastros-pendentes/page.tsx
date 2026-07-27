import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// Fase auto-cadastro-abastecimento (27/07/2026, pedido do Daniel: "quando
// uma placa e um motorista são importados atraves da integracao de
// abastecimentos, os registros já devem ser criados no cadastro de
// veiculos e motoristas pra o usuario cliente complementar as
// informacoes... atrelar sistema de notificação"). Painel dedicado que
// reúne os dois tipos de cadastro criados automaticamente (origem_cadastro
// = 'importado') e ainda pendentes de revisão (pendente_revisao = true) —
// mesmos registros que já aparecem com o badge "Pendente" em /veiculos e
// /motoristas, só que juntos aqui num só lugar de trabalho.
export default async function CadastrosPendentesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let veiculosPendentes: { id: string; placa: string; marca: string | null; modelo: string | null }[] = [];
  let motoristasPendentes: { id: string; nome_completo: string; telefone: string | null }[] = [];
  let erro: string | null = null;

  if (empresaSelecionada) {
    const { data: veiculos, error: erroVeiculos } = await buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada);
    if (erroVeiculos) erro = erroVeiculos;
    veiculosPendentes = veiculos
      .filter((v) => v.pendente_revisao)
      .map((v) => ({ id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo }));

    const { data: motoristas, error: erroMotoristas } = await supabase
      .from("motoristas")
      .select("id, nome_completo, telefone")
      .eq("empresa_id", empresaSelecionada)
      .eq("pendente_revisao", true)
      .order("nome_completo");
    if (erroMotoristas) erro = erroMotoristas.message;
    motoristasPendentes = motoristas ?? [];
  }

  const total = veiculosPendentes.length + motoristasPendentes.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
          Cadastros Pendentes <AjudaIcon chave="cadastros-pendentes.pagina" />
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Veículos e motoristas criados automaticamente a partir de abastecimentos importados — complete o cadastro
          para sair da lista
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
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

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione um cliente acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar: {erro}</p>}

          {total === 0 ? (
            <div className="card p-6 text-sm text-slate-500">
              Nenhum cadastro pendente — tudo o que veio de importações já foi revisado.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="card overflow-x-auto">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Veículos ({veiculosPendentes.length})
                  </h2>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Placa</th>
                      <th className="px-4 py-3">Marca/Modelo</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {veiculosPendentes.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{v.placa}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/veiculos/${v.id}`} className="text-xs font-medium text-frota-600 hover:underline">
                            Completar cadastro
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {veiculosPendentes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                          Nenhum veículo pendente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card overflow-x-auto">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Motoristas ({motoristasPendentes.length})
                  </h2>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {motoristasPendentes.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{m.nome_completo}</td>
                        <td className="px-4 py-3 text-slate-500">{m.telefone ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/motoristas/${m.id}`} className="text-xs font-medium text-frota-600 hover:underline">
                            Completar cadastro
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {motoristasPendentes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                          Nenhum motorista pendente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
