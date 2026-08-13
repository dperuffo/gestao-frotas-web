import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ConvidarParceiroForm } from "./_components/ConvidarParceiroForm";
import { CartaoReputacaoMotorista, type ReputacaoMotorista } from "../fretes/_components/CartaoReputacaoMotorista";

// Rede de motoristas parceiros (Fase Fretes) — motoristas de fora da
// empresa (agregados/terceiros) com quem o cliente já tem relação, pra
// poder atribuir frete direto a eles (ver /fretes). Motoristas PRÓPRIOS
// (empresa_id igual) não precisam aparecer aqui — já ficam disponíveis
// direto no seletor de /fretes/novo via a tabela motoristas.

type ParceiroRow = {
  id: string;
  motorista_id: string;
  nome_completo: string;
  telefone: string | null;
  status: string;
  convidado_em: string;
  respondido_em: string | null;
} & ReputacaoMotorista;

const LABEL_STATUS: Record<string, string> = {
  convidado: "Convidado (aguardando resposta)",
  ativo: "Ativo",
  recusado: "Recusou o convite",
  removido: "Removido",
};

export default async function MotoristasParceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; q?: string }>;
}) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let parceirosRaw: ParceiroRow[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase.rpc("meus_parceiros_empresa", { p_empresa_id: empresaSelecionada });
    parceirosRaw = (data ?? []) as unknown as ParceiroRow[];
  }

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que crescem com o tempo — a rede de parceiros aumenta junto com
  // a rede de motoristas agregados) — mesmo padrão ?q= já usado em
  // /motoristas.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const parceiros = termoBusca
    ? parceirosRaw.filter((p) => p.nome_completo?.toLowerCase().includes(termoBusca))
    : parceirosRaw;

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🤝 Motoristas Parceiros</h1>
        <p className="mt-1 text-sm text-slate-500">
          Motoristas agregados/terceiros com quem você já tem relação — convide pra poder atribuir frete direto a eles,
          sem abrir pro mercado aberto.
          {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
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
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima.</p>
      ) : (
        <div className="space-y-6">
          <ConvidarParceiroForm empresaId={empresaSelecionada} />

          {parceirosRaw.length > 0 && (
            <form>
              <input type="hidden" name="empresa" value={empresaSelecionada} />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por motorista..."
                className="input max-w-sm"
              />
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Convidado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parceiros.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.nome_completo}</p>
                      <CartaoReputacaoMotorista reputacao={p} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.telefone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.status === "ativo"
                            ? "badge-ativo"
                            : p.status === "convidado"
                              ? "text-xs font-medium text-status-atencao"
                              : "badge-inativo"
                        }
                      >
                        {LABEL_STATUS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(p.convidado_em).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {parceiros.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      {termoBusca ? `Nenhum parceiro encontrado para "${q}".` : "Nenhum parceiro convidado ainda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
