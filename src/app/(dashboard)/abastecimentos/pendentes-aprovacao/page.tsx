import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataHoraBr } from "@/lib/utils";
import { BotaoVoltar } from "../../_components/BotaoVoltar";
import { AcaoAprovacaoManual } from "./_components/AcaoAprovacaoManual";

// Fase OCR-Abastecimento-Externo (27/08/2026, pedido do Daniel: "o motorista
// tira foto, o sistema preenche litros/valor/posto sozinho — ataca o maior
// ponto de atrito hoje: digitação manual no aplicativo"). Decisão confirmada
// pelo Daniel: lançamento manual do motorista (via PWA, cupom fiscal
// fotografado + OCR Tesseract) fica PENDENTE até o gestor aprovar aqui —
// só depois de aprovado é que entra em abastecimentos_unificado
// (indicadores/financeiro). Cada card mostra a foto do cupom (Storage
// assinado, 1h) ao lado dos campos extraídos/revisados pelo motorista, pra
// o gestor conferir rápido antes de decidir.
function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AbastecimentosPendentesAprovacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  type Pendente = {
    id: number;
    placa: string;
    motorista_nome: string | null;
    data_abastecimento: string;
    hodometro: number | null;
    posto_nome: string | null;
    combustivel: string | null;
    quantidade: number;
    valor_unitario: number | null;
    valor_total: number;
    foto_path: string | null;
    criado_em: string;
  };

  let pendentes: (Pendente & { fotoUrl: string | null })[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase
      .from("abastecimentos_externos")
      .select(
        "id, placa, motorista_nome, data_abastecimento, hodometro, posto_nome, combustivel, quantidade, valor_unitario, valor_total, foto_path, criado_em"
      )
      .eq("empresa_id", empresaSelecionada)
      .eq("provedor", "manual")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false });

    pendentes = await Promise.all(
      (data ?? []).map(async (p) => {
        let fotoUrl: string | null = null;
        if (p.foto_path) {
          const { data: assinada } = await supabase.storage.from("abastecimentos-evidencias").createSignedUrl(p.foto_path, 3600);
          fotoUrl = assinada?.signedUrl ?? null;
        }
        return { ...p, fotoUrl };
      })
    );
  }

  return (
    <div>
      <BotaoVoltar href="/abastecimentos" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimentos manuais pendentes de aprovação</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lançamentos feitos pelo motorista no aplicativo a partir da foto do cupom fiscal — só entram nos
          indicadores e no financeiro depois de aprovados aqui
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

      {semClienteEscolhido ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Selecione um cliente acima pra ver os lançamentos manuais pendentes dele.
        </p>
      ) : pendentes.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Nenhum lançamento manual pendente de aprovação no momento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pendentes.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="flex gap-4 p-4">
                {p.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.fotoUrl}
                    alt="Foto do cupom fiscal"
                    className="h-32 w-24 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[10px] text-slate-400">
                    Sem foto
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-medium text-slate-900">
                    {p.placa} · {p.motorista_nome ?? "Motorista não identificado"}
                  </p>
                  <p className="text-slate-500">{formatarDataHoraBr(p.data_abastecimento)}</p>
                  <p className="text-slate-600">
                    {p.combustivel ?? "—"} · {p.quantidade.toLocaleString("pt-BR")} L
                    {p.valor_unitario != null ? ` · ${formatarMoeda(p.valor_unitario)}/L` : ""}
                  </p>
                  <p className="font-medium text-slate-900">{formatarMoeda(p.valor_total)}</p>
                  <p className="text-slate-500">{p.posto_nome ?? "Posto não identificado"}</p>
                  {p.hodometro != null && <p className="text-xs text-slate-400">Hodômetro: {p.hodometro.toLocaleString("pt-BR")} km</p>}
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                <AcaoAprovacaoManual id={p.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
