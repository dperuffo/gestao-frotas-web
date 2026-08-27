import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { CATALOGO_REGRAS_CONFIGURAVEIS } from "@/lib/regrasConfiguraveis";
import { LinhaConfiguracaoRegra } from "./_components/LinhaConfiguracaoRegra";
import { ArrowLeft } from "lucide-react";

// Fase Motor-de-Regras-Unico (27/08/2026, pedido do Daniel: "novas features
// de produto" + "unificar em um motor de regras único") — este é o pedaço
// que faltava pro item "Central de Regras & Alertas unificada" do roadmap
// virar realidade de verdade: "o próprio gestor configura limites... troca
// regra fixa no código por controle nas mãos do cliente". Os 10 limites
// abaixo hoje moram (com fallback pro mesmo comportamento de sempre) dentro
// de detectar_anomalias_abastecimento() e da camada de "mínimo de
// ocorrências" de acoes-sugeridas/actions.ts — ver comment na migration
// configuracoes_regras pro porquê de NÃO ter fundido Antifraude/Ações
// Sugeridas/Central de Avisos num schema único (propósitos incompatíveis).
export default async function ConfiguracoesRegrasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let valoresPersonalizados = new Map<string, number>();
  if (empresaSelecionada) {
    const { data } = await supabase
      .from("configuracoes_regras")
      .select("chave, valor")
      .eq("empresa_id", empresaSelecionada);
    valoresPersonalizados = new Map((data ?? []).map((r) => [r.chave, r.valor]));
  }

  const grupos = Array.from(new Set(CATALOGO_REGRAS_CONFIGURAVEIS.map((d) => d.grupo)));

  return (
    <div>
      <Link href="/central-regras" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Central de Regras & Alertas
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Configurar limites</h1>
        <p className="mt-1 text-sm text-slate-500">
          Os limites que a detecção de anomalias e ações sugeridas usa — mude aqui em vez de depender de valor fixo
          no código{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Quem não mexer em nada continua
          com o comportamento padrão.
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
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Selecione um cliente no seletor acima pra configurar os limites dele.
        </p>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo} className="card p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">{grupo}</h2>
              <div>
                {CATALOGO_REGRAS_CONFIGURAVEIS.filter((d) => d.grupo === grupo).map((definicao) => (
                  <LinhaConfiguracaoRegra
                    key={definicao.chave}
                    empresaId={empresaSelecionada}
                    definicao={definicao}
                    valorAtual={valoresPersonalizados.get(definicao.chave) ?? definicao.padrao}
                    personalizado={valoresPersonalizados.has(definicao.chave)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
