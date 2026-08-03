import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

// Fase Programacao-Frota (03/08/2026, benchmark FNI vs Rodopar/Datapar,
// Grupo 1 item 1) — quadro de alocação de veículos: mostra, pra cada
// veículo ativo, se está livre agora ou em viagem (e até quando), sem
// depender de GPS/rastreador — só cruza o vínculo motorista-veículo com
// os fretes aceitos/em andamento desse motorista. Complementa a Torre de
// Controle (que é por frete) com uma visão por veículo.
type VeiculoProgramacao = {
  veiculo_id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  tipo_veiculo: string | null;
  ativo: boolean;
  motorista_id: string | null;
  nome_motorista: string | null;
  frete_id: string | null;
  frete_titulo: string | null;
  frete_status: string | null;
  frete_destino_label: string | null;
  disponivel_a_partir: string | null;
};

const LABEL_STATUS: Record<string, string> = {
  aceito: "Aceito",
  em_andamento: "Em andamento",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProgramacaoFrotaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let veiculos: VeiculoProgramacao[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase.rpc("programacao_frota_empresa", { p_empresa_id: empresaSelecionada });
    veiculos = (data ?? []) as unknown as VeiculoProgramacao[];
  }

  const ativos = veiculos.filter((v) => v.ativo);
  const emViagem = ativos.filter((v) => v.frete_id !== null);
  const semMotorista = ativos.filter((v) => v.motorista_id === null);
  const livres = ativos.filter((v) => v.motorista_id !== null && v.frete_id === null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Programação de Frota</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quadro de alocação: qual veículo está em viagem (e até quando fica ocupado), qual está livre e qual ainda
          não tem motorista vinculado. Baseado no vínculo motorista-veículo e nos fretes aceitos/em andamento — não é
          rastreamento por GPS.
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

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente pra ver a programação da frota dele.
        </p>
      )}

      {empresaSelecionada && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Veículos ativos</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{ativos.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Em viagem</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{emViagem.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Livres</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{livres.length}</p>
            </div>
            <div className={`card p-4 ${semMotorista.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sem motorista vinculado</p>
              <p className={`mt-1 text-2xl font-semibold ${semMotorista.length > 0 ? "text-amber-700" : "text-slate-900"}`}>
                {semMotorista.length}
              </p>
            </div>
          </div>

          {ativos.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nenhum veículo ativo cadastrado ainda. Cadastre em{" "}
              <Link href={`/veiculos?empresa=${empresaSelecionada}`} className="underline">
                Veículos
              </Link>
              .
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Veículo</th>
                    <th className="px-4 py-3">Motorista</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Livre a partir de</th>
                  </tr>
                </thead>
                <tbody>
                  {ativos.map((v) => (
                    <tr key={v.veiculo_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{v.placa}</p>
                        <p className="text-xs text-slate-500">
                          {[v.marca, v.modelo].filter(Boolean).join(" ") || v.tipo_veiculo || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{v.nome_motorista ?? "—"}</td>
                      <td className="px-4 py-3">
                        {v.motorista_id === null ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Sem motorista
                          </span>
                        ) : v.frete_id ? (
                          <Link href={`/fretes/${v.frete_id}`} className="group">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {LABEL_STATUS[v.frete_status ?? ""] ?? v.frete_status} — {v.frete_titulo}
                            </span>
                            <p className="mt-0.5 text-xs text-slate-500 group-hover:underline">
                              → {v.frete_destino_label}
                            </p>
                          </Link>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Livre agora
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {v.disponivel_a_partir ? formatarData(v.disponivel_a_partir) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
