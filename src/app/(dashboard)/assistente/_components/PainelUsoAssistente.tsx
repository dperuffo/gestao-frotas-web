import { createClient } from "@/lib/supabase/server";
import { decidirAcesso, formatarTokens, type UsoMes } from "@/lib/assistenteConsumo";
import { ChaveAssistenteModal } from "./ChaveAssistenteModal";

// Faixa de uso do Assistente acima do chat: franquia do mês da empresa (ou chave própria) e,
// para o admin FNI, o consumo de cada cliente no mês.
export async function PainelUsoAssistente({ empresaId, perfil }: { empresaId: string | null; perfil: string | null }) {
  const supabase = await createClient();
  const podeGerenciarChave = perfil === "admin" || perfil === "gestor_frota" || perfil === "posto";

  let uso: UsoMes | null = null;
  if (empresaId) {
    const { data } = await supabase.rpc("assistente_uso_mes", { p_empresa_id: empresaId });
    uso = (data as unknown as UsoMes) ?? null;
  }

  const porCliente =
    perfil === "admin" ? ((await supabase.rpc("assistente_consumo_por_empresa_mes")).data ?? []) : [];

  if (!uso && porCliente.length === 0) return null;

  const ilimitado = uso ? uso.franquia < 0 : false;
  const pct = uso && !ilimitado && uso.franquia > 0 ? Math.min(100, Math.round((uso.usado / uso.franquia) * 100)) : 0;
  const usandoChave = !!uso && decidirAcesso(uso) === "chave_cliente";
  const cor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-accento";

  return (
    <div className="mb-4 space-y-3">
      {uso && empresaId && (
        <div className="card flex flex-wrap items-center gap-4 p-3">
          <div className="min-w-[14rem] flex-1">
            <p className="mb-1 text-sm text-slate-700 dark:text-slate-200">
              Franquia do plano neste mês: <strong>{formatarTokens(uso.usado)}</strong>
              {ilimitado ? " tokens (ilimitada)" : ` de ${formatarTokens(uso.franquia)} tokens (${pct}%)`}
              {uso.plano ? <span className="text-slate-500 dark:text-slate-400"> · plano {uso.plano}</span> : null}
            </p>
            {!ilimitado && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uso da franquia do mês">
                <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            {uso.chave_propria ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Usando agora: <strong>{usandoChave ? "sua chave de IA" : "a franquia do plano"}</strong>
                {usandoChave && uso.preferencia !== "chave" ? " (a franquia do mês acabou)" : ""}. Consumo com a sua chave neste mês:{" "}
                {formatarTokens(uso.usado_chave_propria ?? 0)} tokens (cobrados na sua conta da Anthropic). A franquia renova todo mês.
              </p>
            ) : (
              <>
                {pct >= 80 && pct < 100 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">A franquia do mês está acabando. A chave própria remove o limite.</p>}
                {pct >= 100 && <p className="mt-1 text-xs text-red-600">Franquia do mês esgotada. Cadastre a chave de IA da empresa para continuar.</p>}
              </>
            )}
          </div>
          {podeGerenciarChave && <ChaveAssistenteModal empresaId={empresaId} chavePropria={uso.chave_propria} ultimos4={uso.chave_ultimos4} preferencia={uso.preferencia} />}
        </div>
      )}

      {perfil === "admin" && porCliente.length > 0 && (
        <details className="card p-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-800 dark:text-slate-100">
            Consumo de IA por cliente neste mês, só chave da FNI (admin)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Cliente</th>
                  <th className="py-1 pr-3">Plano</th>
                  <th className="py-1 pr-3 text-right">Tokens</th>
                  <th className="py-1 pr-3 text-right">Franquia</th>
                  <th className="py-1 pr-3 text-right">Chamadas</th>
                  <th className="py-1">Chave</th>
                </tr>
              </thead>
              <tbody>
                {porCliente.map((c) => (
                  <tr key={c.empresa_id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-1 pr-3">{c.empresa_nome}</td>
                    <td className="py-1 pr-3">{c.plano}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{formatarTokens(Number(c.tokens))}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{Number(c.franquia) < 0 ? "ilimitada" : formatarTokens(Number(c.franquia))}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{Number(c.chamadas)}</td>
                    <td className="py-1">{c.chave_propria ? "própria" : "FNI"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
