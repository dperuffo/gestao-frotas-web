import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { MapaVeiculos, type PosicaoVeiculo } from "./_components/MapaVeiculos";

// Fase Torre-de-Controle-Leve (02/08/2026, pedido do Daniel após o benchmark
// FNI vs KMM — "Grupo 1" das sugestões: dá pra ter boa parte do valor de uma
// torre de controle sem GPS/telemetria contínua, só agregando os checkpoints
// que o motorista já registra no app (fretes_eventos) num painel único, com
// alerta de prazo. É "leve" porque não sabe ONDE o motorista está agora, só
// o ÚLTIMO checkpoint que ele confirmou — diferente de rastreamento real.
//
// Fase Grupo 2 (Rodopar/Datapar, item 4, 03/08/2026) — quando o cliente
// conecta QUALQUER sistema de rastreamento ao endpoint genérico de ingestão
// (/api/integracoes/gps, ver /integracoes), a mesma tela ganha um mapa ao
// vivo com a última posição de cada placa — sem precisar de nenhuma
// integração específica de provedor.
type FreteAndamento = {
  id: string;
  titulo: string;
  status: string;
  origem_label: string;
  destino_label: string;
  motorista_id: string | null;
  nome_motorista: string | null;
  telefone_motorista: string | null;
  criado_em: string;
  entrega_data: string | null;
  entrega_hora: string | null;
  prazo_limite: string | null;
  ultimo_evento_tipo: string | null;
  ultimo_evento_em: string | null;
  ultimo_evento_observacao: string | null;
  teve_panico: boolean;
};

const LABEL_STATUS: Record<string, string> = {
  aceito: "Aceito",
  em_andamento: "Em andamento",
};

const LABEL_EVENTO: Record<string, string> = {
  chegou_origem: "Chegou na origem",
  saiu_origem: "Saiu da origem",
  chegou_posto: "Chegou no posto",
  abasteceu: "Abasteceu",
  parada: "Parada",
  chegou_destino: "Chegou no destino",
  ocorrencia: "Ocorrência",
  concluido: "Concluiu o frete",
  panico: "🚨 Alerta de emergência",
};

// Formatação simples de "há Xh" / "há X dias" — sem lib externa, esse
// projeto não tem date-fns como dependência.
function tempoRelativo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffDias = Math.round(diffH / 24);
  return `há ${diffDias} dia${diffDias === 1 ? "" : "s"}`;
}

function formatarPrazo(isoDate: string): string {
  return new Date(isoDate).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TorreDeControlePage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let fretes: FreteAndamento[] = [];
  let posicoes: PosicaoVeiculo[] = [];
  if (empresaSelecionada) {
    const [{ data }, { data: posicoesRaw }] = await Promise.all([
      supabase.rpc("fretes_em_andamento_empresa", { p_empresa_id: empresaSelecionada }),
      supabase
        .from("veiculos_posicoes")
        .select("placa, lat, lon, velocidade_kmh, timestamp_gps, provedor")
        .eq("empresa_id", empresaSelecionada)
        .order("timestamp_gps", { ascending: false })
        .limit(500),
    ]);
    fretes = (data ?? []) as unknown as FreteAndamento[];

    // Última posição por placa — dedupe em JS (sem DISTINCT ON via
    // PostgREST), mesmo padrão já usado em outras telas deste app pra
    // reduzir uma lista bruta ao "1 por chave" mais recente.
    const ultimaPorPlaca = new Map<string, PosicaoVeiculo>();
    for (const p of posicoesRaw ?? []) {
      if (ultimaPorPlaca.has(p.placa)) continue;
      ultimaPorPlaca.set(p.placa, {
        placa: p.placa,
        lat: Number(p.lat),
        lon: Number(p.lon),
        velocidadeKmh: p.velocidade_kmh != null ? Number(p.velocidade_kmh) : null,
        timestampGps: p.timestamp_gps,
        provedor: p.provedor,
      });
    }
    posicoes = Array.from(ultimaPorPlaca.values());
  }

  const agora = Date.now();
  const comRisco = fretes.map((f) => {
    const prazoMs = f.prazo_limite ? new Date(f.prazo_limite).getTime() : null;
    const atrasado = prazoMs !== null && prazoMs < agora;
    const vencendoEmBreve = !atrasado && prazoMs !== null && prazoMs - agora <= 6 * 60 * 60 * 1000;
    return { ...f, atrasado, vencendoEmBreve };
  });
  const totalAtrasados = comRisco.filter((f) => f.atrasado).length;
  const totalVencendoEmBreve = comRisco.filter((f) => f.vencendoEmBreve).length;
  const totalPanico = comRisco.filter((f) => f.teve_panico).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Torre de Controle</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão única dos fretes em andamento agora, com o último checkpoint registrado pelo motorista e alerta de
          prazo. Por padrão não é rastreamento por GPS — é baseado nos eventos que o motorista confirma no app (saiu
          da origem, chegou no posto, chegou no destino etc.), então a posição pode estar desatualizada entre um
          checkpoint e outro. Se você conectar um sistema de rastreamento em{" "}
          <Link href="/integracoes" className="text-frota-600 hover:underline">
            Integrações
          </Link>{" "}
          (escopo <code>gps:write</code>, qualquer provedor), um mapa ao vivo aparece aqui também.
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
          Selecione um cliente pra ver os fretes em andamento dele.
        </p>
      )}

      {empresaSelecionada && (
        <>
          {posicoes.length > 0 && (
            <div className="card mb-6 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Mapa ao vivo ({posicoes.length} veículo{posicoes.length === 1 ? "" : "s"})</h2>
              <MapaVeiculos posicoes={posicoes} />
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Fretes em andamento</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{fretes.length}</p>
            </div>
            <div className={`card p-4 ${totalVencendoEmBreve > 0 ? "border-amber-200 bg-amber-50/50" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Vencendo em até 6h</p>
              <p className={`mt-1 text-2xl font-semibold ${totalVencendoEmBreve > 0 ? "text-amber-700" : "text-slate-900"}`}>
                {totalVencendoEmBreve}
              </p>
            </div>
            <div className={`card p-4 ${totalAtrasados > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Prazo estourado</p>
              <p className={`mt-1 text-2xl font-semibold ${totalAtrasados > 0 ? "text-red-700" : "text-slate-900"}`}>
                {totalAtrasados}
              </p>
            </div>
            <div className={`card p-4 ${totalPanico > 0 ? "border-red-300 bg-red-100/70" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">🚨 Alerta de emergência</p>
              <p className={`mt-1 text-2xl font-semibold ${totalPanico > 0 ? "text-red-800" : "text-slate-900"}`}>
                {totalPanico}
              </p>
            </div>
          </div>

          {comRisco.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nenhum frete em andamento agora. Fretes aparecem aqui assim que forem aceitos por um motorista, em{" "}
              <Link href={`/fretes?empresa=${empresaSelecionada}`} className="underline">
                Fretes
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {comRisco.map((f) => (
                <Link
                  key={f.id}
                  href={`/fretes/${f.id}`}
                  className={`card block p-4 transition hover:border-slate-300 ${
                    f.teve_panico
                      ? "border-red-400 bg-red-100/60 ring-1 ring-red-300"
                      : f.atrasado
                        ? "border-red-200 bg-red-50/40"
                        : f.vencendoEmBreve
                          ? "border-amber-200 bg-amber-50/40"
                          : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{f.titulo}</p>
                      <p className="text-sm text-slate-500">
                        {f.origem_label} → {f.destino_label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.teve_panico && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          🚨 Emergência
                        </span>
                      )}
                      <span className="badge-ativo">{LABEL_STATUS[f.status] ?? f.status}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <span className="text-slate-600">
                      Motorista: <span className="font-medium text-slate-800">{f.nome_motorista ?? "—"}</span>
                      {f.telefone_motorista ? ` (${f.telefone_motorista})` : ""}
                    </span>

                    <span className="text-slate-600">
                      Último checkpoint:{" "}
                      <span className="font-medium text-slate-800">
                        {f.ultimo_evento_tipo ? LABEL_EVENTO[f.ultimo_evento_tipo] ?? f.ultimo_evento_tipo : "Nenhum ainda"}
                      </span>
                      {f.ultimo_evento_em ? ` (${tempoRelativo(f.ultimo_evento_em)})` : ""}
                    </span>

                    {f.prazo_limite && (
                      <span className={f.atrasado ? "font-medium text-red-700" : f.vencendoEmBreve ? "font-medium text-amber-700" : "text-slate-600"}>
                        {f.atrasado ? "Prazo estourado: " : "Prazo: "}
                        {formatarPrazo(f.prazo_limite)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
