import { createClient } from "@/lib/supabase/server";
import { BotoesDuplicata } from "./_components/BotoesDuplicata";

// Fase 27.137 — fila de revisão (admin) dos possíveis duplicados
// sinalizados pela RPC verificar_e_registrar_posto_anp (aba "Meu Posto" do
// posto): endereço/coordenadas muito próximos de outro posto já cadastrado
// (ANP ou postos_gf de outro dono), mas CNPJ diferente. Decisão do Daniel:
// não bloqueia o posto no momento do cadastro, só sinaliza pra revisão
// aqui. Mesmo padrão de guarda de acesso de /avaliacoes/
// /inteligencia-rede (perfil_usuario_atual() === "admin").
export default async function PostosDuplicadosPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador).
        </p>
      </div>
    );
  }

  const { data: pendentes, error } = await supabase
    .from("postos_gf_possiveis_duplicados")
    .select("id, empresa_id, cnpj_informado, anp_postos_id, postos_gf_cnpj_candidato, distancia_metros, criado_em, empresas(nome, cnpj)")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  const lista = pendentes ?? [];

  const idsAnp = lista.map((l) => l.anp_postos_id).filter((id): id is number => id != null);
  const cnpjsGf = lista.map((l) => l.postos_gf_cnpj_candidato).filter((cnpj): cnpj is string => cnpj != null);

  const [{ data: candidatosAnp }, { data: candidatosGf }] = await Promise.all([
    idsAnp.length > 0
      ? supabase.from("anp_postos").select("id, razao_social, cnpj, endereco, municipio, uf").in("id", idsAnp)
      : Promise.resolve({ data: [] as { id: number; razao_social: string | null; cnpj: string | null; endereco: string | null; municipio: string | null; uf: string | null }[] }),
    cnpjsGf.length > 0
      ? supabase.from("postos_gf").select("cnpj, razao_social, municipio, uf, empresa_id").in("cnpj", cnpjsGf)
      : Promise.resolve({ data: [] as { cnpj: string; razao_social: string | null; municipio: string | null; uf: string | null; empresa_id: string | null }[] }),
  ]);

  const mapaAnp = new Map((candidatosAnp ?? []).map((a) => [a.id, a]));
  const mapaGf = new Map((candidatosGf ?? []).map((g) => [g.cnpj, g]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Possíveis duplicados de postos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Postos que se auto-cadastraram em &quot;Meu Posto&quot; com endereço/coordenadas muito próximos de
          outro posto já existente, mas com CNPJ diferente. O cadastro já foi salvo normalmente — decida aqui
          se é mesmo o mesmo estabelecimento (duplicata) ou dois postos legitimamente vizinhos.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar: {error.message}</p>}

      <div className="space-y-3">
        {lista.map((l) => {
          const candidatoAnp = l.anp_postos_id != null ? mapaAnp.get(l.anp_postos_id) : null;
          const candidatoGf = l.postos_gf_cnpj_candidato != null ? mapaGf.get(l.postos_gf_cnpj_candidato) : null;
          const candidato = candidatoAnp
            ? { fonte: "Base ANP", razaoSocial: candidatoAnp.razao_social, cnpj: candidatoAnp.cnpj, municipio: candidatoAnp.municipio, uf: candidatoAnp.uf }
            : candidatoGf
              ? { fonte: "Postos Revendedores", razaoSocial: candidatoGf.razao_social, cnpj: candidatoGf.cnpj, municipio: candidatoGf.municipio, uf: candidatoGf.uf }
              : null;

          return (
            // Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) —
            // layout de card-list (não é grid de KPI), mesmo toque de
            // Oficinas/Fretes: hover:border-frota-300 em vez de trocar por
            // IndicadorColorido.
            <div key={l.id} className="card p-4 transition-colors hover:border-frota-300">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Posto recém-cadastrado</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{l.empresas?.nome ?? "—"}</p>
                  <p className="text-xs text-slate-500">CNPJ: {l.cnpj_informado}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Possível duplicata ({candidato?.fonte ?? "—"})
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{candidato?.razaoSocial ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    CNPJ: {candidato?.cnpj ?? "—"}
                    {candidato?.municipio ? ` — ${candidato.municipio}/${candidato.uf ?? ""}` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Distância estimada: {l.distancia_metros != null ? `${l.distancia_metros} m` : "—"} · Sinalizado em{" "}
                {l.criado_em ? new Date(l.criado_em).toLocaleString("pt-BR") : "—"}
              </p>
              <BotoesDuplicata id={l.id} />
            </div>
          );
        })}
        {lista.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-400">Nenhum possível duplicado pendente de revisão.</p>
        )}
      </div>
    </div>
  );
}
