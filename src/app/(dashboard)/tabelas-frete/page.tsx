import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ReplicarParaGrupoButton } from "@/components/replicacao/ReplicarParaGrupoButton";
import { AlternarAtivoTabela } from "./_components/AlternarAtivoTabela";
import { BotaoExcluirTabela } from "./_components/BotaoExcluirTabela";

// Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — tabelas de frete: cada
// linha alimenta o simulador de /cotacoes (frete-peso por faixa + ad
// valorem/GRIS/TDE/TDA/despacho/pedágio/ICMS "por dentro").
export default async function TabelasFretePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let tabelas: {
    id: string;
    nome: string;
    ativo: boolean;
    uf_origem: string | null;
    cidade_origem: string | null;
    uf_destino: string | null;
    cidade_destino: string | null;
    percentual_ad_valorem: number;
    percentual_gris: number;
    percentual_icms: number;
    cliente_tomador_id: string | null;
  }[] = [];
  let nomesParceiros = new Map<string, string>();

  if (empresaSelecionada) {
    const { data } = await supabase
      .from("tabelas_frete")
      .select(
        "id, nome, ativo, uf_origem, cidade_origem, uf_destino, cidade_destino, percentual_ad_valorem, percentual_gris, percentual_icms, cliente_tomador_id"
      )
      .eq("empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false });
    tabelas = data ?? [];

    const idsParceiros = Array.from(new Set(tabelas.map((t) => t.cliente_tomador_id).filter((id): id is string => !!id)));
    if (idsParceiros.length > 0) {
      const { data: parceiros } = await supabase.from("cadastros_parceiros").select("id, razao_social").in("id", idsParceiros);
      nomesParceiros = new Map((parceiros ?? []).map((p) => [p.id, p.razao_social]));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">📋 Tabelas de Frete</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre por cliente-tomador ou geral — alimenta o simulador de{" "}
            <Link href="/cotacoes" className="text-frota-600 hover:underline">
              Cotações
            </Link>
            .{nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && (
          <div className="flex items-center gap-3">
            <ReplicarParaGrupoButton
              chaveTabela="tabelas_frete"
              empresaId={empresaSelecionada}
              rotuloRegistro="as tabelas de frete gerais (não específicas de um cliente-tomador)"
            />
            <Link href={`/tabelas-frete/novo?empresa=${empresaSelecionada}`} className="btn-primary">
              + Nova tabela
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

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e cadastrar tabelas de frete.</p>
      ) : tabelas.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhuma tabela de frete cadastrada ainda. Clique em &quot;+ Nova tabela&quot; pra começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tabelas.map((t) => (
            <div key={t.id} className="card flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{t.nome}</h3>
                <span className={t.ativo ? "badge-ativo" : "badge-inativo"}>{t.ativo ? "Ativa" : "Inativa"}</span>
              </div>
              <p className="text-xs text-slate-500">
                {t.cliente_tomador_id ? (nomesParceiros.get(t.cliente_tomador_id) ?? "Cliente específico") : "Geral (qualquer cliente)"}
              </p>
              {(t.uf_origem || t.uf_destino) && (
                <p className="text-xs text-slate-500">
                  {t.cidade_origem ?? t.uf_origem ?? "—"} → {t.cidade_destino ?? t.uf_destino ?? "—"}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Ad valorem {t.percentual_ad_valorem}% · GRIS {t.percentual_gris}% · ICMS {t.percentual_icms}%
              </p>
              <div className="mt-auto flex items-center gap-3 border-t border-dashed border-slate-300 pt-2 text-xs">
                <Link href={`/tabelas-frete/${t.id}?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
                  Editar
                </Link>
                <AlternarAtivoTabela id={t.id} empresaId={empresaSelecionada} ativo={t.ativo} />
                <BotaoExcluirTabela id={t.id} empresaId={empresaSelecionada} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
