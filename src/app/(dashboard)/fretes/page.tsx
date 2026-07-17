import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { CancelarFreteButton } from "./_components/CancelarFreteButton";
import { ReabrirFreteButton } from "./_components/ReabrirFreteButton";

// Fretes (Fase Fretes) — contratação de frete entre cliente e motorista.
// Modo direto (motorista já definido, próprio ou parceiro) fica
// "aguardando_confirmacao" até o motorista aceitar/recusar; modo mercado
// aberto fica "disponivel" pra rede toda propor valor (ver /fretes/[id]
// pra acompanhar as propostas recebidas).

type FreteRow = {
  id: string;
  titulo: string;
  status: string;
  origem_label: string;
  destino_label: string;
  valor_oferecido: number;
  km_estimado: number | null;
  motorista_id: string | null;
  nome_motorista: string | null;
  telefone_motorista: string | null;
  criado_em: string;
};

const LABEL_STATUS: Record<string, string> = {
  disponivel: "Disponível (mercado aberto)",
  aguardando_confirmacao: "Aguardando confirmação do motorista",
  aceito: "Aceito",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  recusado: "Recusado pelo motorista",
};

const COR_STATUS: Record<string, string> = {
  disponivel: "badge-ativo",
  aguardando_confirmacao: "text-xs font-medium text-status-atencao",
  aceito: "badge-ativo",
  em_andamento: "badge-ativo",
  concluido: "text-xs font-medium text-slate-500",
  cancelado: "badge-inativo",
  recusado: "badge-inativo",
};

export default async function FretesPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let fretes: FreteRow[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase.rpc("meus_fretes_empresa", { p_empresa_id: empresaSelecionada });
    fretes = (data ?? []) as unknown as FreteRow[];
  }

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🚚 Fretes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Publique fretes pra rede de motoristas negociar (estilo Uber) ou atribua direto a um motorista próprio ou
            parceiro.
            {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/fretes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Publicar frete
          </Link>
        )}
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione...</option>
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
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e publicar fretes.</p>
      ) : fretes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhum frete publicado ainda. Clique em &quot;+ Publicar frete&quot; pra começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fretes.map((f) => (
            <div key={f.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{f.titulo}</h3>
                <span className={COR_STATUS[f.status] ?? "badge-inativo"}>{LABEL_STATUS[f.status] ?? f.status}</span>
              </div>
              <p className="text-sm text-slate-600">
                {f.origem_label} → {f.destino_label}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{formatoMoeda.format(f.valor_oferecido)}</span>
                {f.km_estimado && <span className="text-slate-500">{f.km_estimado.toLocaleString("pt-BR")} km</span>}
              </div>
              {f.nome_motorista && (
                <p className="text-xs text-slate-500">
                  Motorista: <span className="font-medium text-slate-700">{f.nome_motorista}</span>
                </p>
              )}

              <div className="mt-auto flex items-center gap-3 border-t border-dashed border-slate-300 pt-2 text-xs">
                {(f.status === "disponivel" || f.status === "aguardando_confirmacao") && (
                  <Link href={`/fretes/${f.id}?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
                    {f.status === "disponivel" ? "Ver propostas" : "Ver detalhes"}
                  </Link>
                )}
                {(f.status === "disponivel" || f.status === "aguardando_confirmacao" || f.status === "aceito") && (
                  <CancelarFreteButton id={f.id} empresaId={empresaSelecionada} />
                )}
                {f.status === "recusado" && <ReabrirFreteButton id={f.id} empresaId={empresaSelecionada} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
