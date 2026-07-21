import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { SecaoParametrosNF } from "./_components/SecaoParametrosNF";

// Fase 27.140 — pedido do Daniel: tela de "Parâmetros de NF" pra que o
// cliente frotista configure preferências de emissão de nota fiscal (por
// CNPJ da frota, ou uma regra padrão) — consultadas depois por ERPs e
// software de automação de posto via API (ver
// src/app/api/integracoes/parametros-nf/route.ts e a documentação Curl em
// /integracoes). Mesmo padrão de tela/ação/API de /parametros-uso.
export default async function ParametrosNFPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
          Parâmetros de NF <AjudaIcon chave="parametros-nf.pagina" />
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Preferências de emissão de nota fiscal por CNPJ da frota — consultadas por ERPs e sistemas de automação de
          posto integrados via API{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
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
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os parâmetros dele.</p>
      ) : (
        <ConteudoParametrosNF empresaId={empresaSelecionada} />
      )}
    </div>
  );
}

async function ConteudoParametrosNF({ empresaId }: { empresaId: string }) {
  const supabase = await createClient();

  const [{ data }, { data: veiculosData }] = await Promise.all([
    supabase
      .from("parametros_nota_fiscal")
      .select(
        "id, cnpj_frota, exige_nota_fiscal, separar_nf_combustivel, forma_emissao, local_destino, cnpj_destino_personalizado, dados_adicionais, status, observacao, parametros_nota_fiscal_destino_uf(uf, cnpj_destino)"
      )
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false }),
    buscarTodosVeiculosDaEmpresa(supabase, empresaId),
  ]);

  const cnpjsFrota = Array.from(
    new Set((veiculosData ?? []).map((v) => v.cnpj_frota).filter((c): c is string => !!c))
  ).sort();

  return <SecaoParametrosNF linhas={data ?? []} empresaId={empresaId} cnpjsFrota={cnpjsFrota} />;
}
