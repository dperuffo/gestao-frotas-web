import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, Navigation, CheckCircle2, AlertTriangle } from "lucide-react";

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

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: essa RPC devolve 1
  // linha por veículo da frota, sem `.range()` — sujeita ao corte padrão de
  // 1.000 linhas do PostgREST em frotas grandes (mesmo bug já corrigido em
  // /veiculos, Fase 27.38). Busca em lotes de 1.000 até esgotar.
  const LOTE_PROGRAMACAO = 1000;
  let veiculos: VeiculoProgramacao[] = [];
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      const { data } = await supabase
        .rpc("programacao_frota_empresa", { p_empresa_id: empresaSelecionada })
        .range(offsetBusca, offsetBusca + LOTE_PROGRAMACAO - 1);
      const lote = (data ?? []) as unknown as VeiculoProgramacao[];
      if (lote.length === 0) break;
      veiculos.push(...lote);
      if (lote.length < LOTE_PROGRAMACAO) break;
      offsetBusca += LOTE_PROGRAMACAO;
    }
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
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="sky" icon={Truck} label="Veículos ativos" valor={String(ativos.length)} />
            <IndicadorColorido cor="violet" icon={Navigation} label="Em viagem" valor={String(emViagem.length)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Livres" valor={String(livres.length)} />
            <IndicadorColorido
              cor={semMotorista.length > 0 ? "amber" : "green"}
              icon={AlertTriangle}
              label="Sem motorista vinculado"
              valor={String(semMotorista.length)}
            />
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
                    <tr key={v.veiculo_id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-frota-50/60">
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
