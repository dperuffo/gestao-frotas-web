import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasPainel, type Aba } from "../inteligencia-rede/_components/AbasPainel";
import { TabelaPisoAntt } from "../_components/TabelaPisoAntt";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const LABEL_STATUS: Record<string, string> = {
  simulada: "Simulada",
  convertida: "Convertida",
  descartada: "Descartada",
};

const COR_STATUS: Record<string, string> = {
  simulada: "badge-ativo",
  convertida: "text-xs font-medium text-frota-600",
  descartada: "badge-inativo",
};

// Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — cotações: simula (via
// Tabelas de Frete + piso mínimo ANTT), salva, e converte em frete com um
// clique.
export default async function CotacoesPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let cotacoes: {
    id: string;
    origem_label: string;
    destino_label: string;
    peso_kg: number;
    valor_total: number;
    piso_antt_alerta: boolean;
    status: string;
    criado_em: string;
  }[] = [];

  if (empresaSelecionada) {
    const { data } = await supabase
      .from("cotacoes")
      .select("id, origem_label, destino_label, peso_kg, valor_total, piso_antt_alerta, status, criado_em")
      .eq("empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false })
      .limit(100);
    cotacoes = data ?? [];
  }

  // Fase Financeiro-ERP (26/07/2026, pedido do Daniel) — "Aba de Piso
  // mínimo ANTT tem que estar na visão do cliente, web e PWA". Tabela
  // NACIONAL (não é por tenant), sempre a mesma pra qualquer cliente —
  // busca independe de empresaSelecionada. Só leitura aqui (quem
  // importa/exclui a planilha oficial continua sendo só o time interno em
  // /administracao/pisos-antt).
  const { data: pisosAntt } = await supabase
    .from("pisos_antt")
    .select("id, tipo_carga, numero_eixos, coeficiente_deslocamento, coeficiente_carga_descarga, vigencia_inicio")
    .order("tipo_carga", { ascending: true })
    .order("numero_eixos", { ascending: true });

  const conteudoCotacoes = (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Simule o frete com base nas suas{" "}
            <Link href="/tabelas-frete" className="text-frota-600 hover:underline">
              Tabelas de Frete
            </Link>{" "}
            e converta em frete com um clique.{nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/cotacoes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Nova cotação
          </Link>
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
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e simular cotações.</p>
      ) : cotacoes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhuma cotação simulada ainda. Clique em &quot;+ Nova cotação&quot; pra começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cotacoes.map((c) => (
            <Link
              key={c.id}
              href={`/cotacoes/${c.id}?empresa=${empresaSelecionada}`}
              className="card flex flex-col gap-2 p-5 hover:border-frota-300"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">
                  {c.origem_label} → {c.destino_label}
                </h3>
                <span className={COR_STATUS[c.status] ?? "badge-inativo"}>{LABEL_STATUS[c.status] ?? c.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{formatoMoeda.format(c.valor_total)}</span>
                <span className="text-slate-500">{c.peso_kg.toLocaleString("pt-BR")} kg</span>
              </div>
              {c.piso_antt_alerta && (
                <p className="text-xs font-medium text-amber-700">⚠️ Abaixo do piso mínimo ANTT</p>
              )}
              <p className="text-xs text-slate-400">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const conteudoPisoAntt = (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Res. ANTT 5.867/2020 — piso = distância (km) × coeficiente de deslocamento + coeficiente de
        carga/descarga, por tipo de carga e nº de eixos. É o valor mínimo legal usado pra alertar quando uma
        cotação simulada fica abaixo do piso.
      </p>
      <TabelaPisoAntt pisos={pisosAntt ?? []} />
    </div>
  );

  const abas: Aba[] = [
    { id: "cotacoes", label: "🧮 Cotações", conteudo: conteudoCotacoes },
    { id: "piso-antt", label: "Piso Mínimo ANTT", conteudo: conteudoPisoAntt },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🧮 Cotações</h1>
      </div>
      <AbasPainel abas={abas} />
    </div>
  );
}
