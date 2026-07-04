import { createClient } from "@/lib/supabase/server";
import { AbasRoteirizacao } from "../_components/AbasRoteirizacao";
import { ExcluirRotaButton } from "../_components/ExcluirRotaButton";

// Fase 27.34 — "rota" continua no mapa (rótulo de exibição) mesmo com a aba
// retirada da navegação, porque consultas desse tipo salvas antes da
// mudança continuam aparecendo aqui, em "Rotas Salvas".
const TIPO_LABEL: Record<string, string> = {
  estado: "📍 Por UF/Município",
  rota: "🗺️ Por Rota",
  busca: "🔍 Consulta por Posto",
  roteirizacao: "🧭 Roteirizador Inteligente",
};

function montarLink(tipo: string, id: string, empresaId: string | null, dados: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (empresaId) params.set("empresa", empresaId);

  if (tipo === "estado") {
    if (dados.uf) params.set("uf", String(dados.uf));
    if (dados.municipio) params.set("municipio", String(dados.municipio));
    return `/roteirizacao?${params.toString()}`;
  }
  if (tipo === "rota") {
    params.set("rotaId", id);
    return `/roteirizacao/rota?${params.toString()}`;
  }
  if (tipo === "roteirizacao") {
    params.set("rotaId", id);
    return `/roteirizacao/planejar?${params.toString()}`;
  }
  if (tipo === "busca") {
    if (dados.termo) params.set("termo", String(dados.termo));
    return `/roteirizacao/posto?${params.toString()}`;
  }
  return "/roteirizacao";
}

export default async function RoteirizacaoSalvasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rotas } = await supabase
    .from("rotas_salvas")
    .select("id, nome, tipo, criado_em, empresa_id, dados")
    .eq("usuario_email", user?.email ?? "")
    .order("criado_em", { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Roteirização</h1>
        <p className="mt-1 text-sm text-slate-500">Consultas e rotas que você salvou.</p>
      </div>

      <AbasRoteirizacao ativo="salvas" />

      {!rotas || rotas.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Nenhuma consulta salva ainda. Use o botão &quot;Salvar consulta&quot; nas outras abas para guardar uma
          rota ou busca para acessar depois.
        </p>
      ) : (
        <div className="card divide-y divide-slate-100">
          {rotas.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium text-slate-900">{r.nome}</p>
                <p className="text-xs text-slate-500">
                  {TIPO_LABEL[r.tipo] ?? r.tipo}
                  {r.criado_em ? ` · ${new Date(r.criado_em).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={montarLink(r.tipo, r.id, r.empresa_id, (r.dados as Record<string, unknown>) ?? {})}
                  className="btn-secondary"
                >
                  Abrir
                </a>
                <ExcluirRotaButton id={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
