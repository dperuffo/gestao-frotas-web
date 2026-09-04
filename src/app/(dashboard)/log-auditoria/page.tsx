import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import {
  GraficoAuditoria,
  type ItemEventosDia,
  type ItemRankingUsuario,
  type ItemPorAcao,
} from "./_components/GraficoAuditoria";

const PORPAGINA = 30;

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Log de auditoria centralizado") — tela
// exclusiva do time interno (perfil admin), mesmo padrão de
// /administracao/central-avisos. Lista o que foi gravado pelo helper
// registrarAuditoria (ver src/lib/auditoria.ts), hoje restrito às 3 ações
// mais críticas citadas pelo Daniel: mudança de permissão, edição de preço
// e exclusão (inativação) de cadastro — dá pra estender pra mais Server
// Actions depois sem mudar schema nenhum (acao/entidade são texto livre).
export default async function LogAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  let query = supabase
    .from("log_auditoria")
    .select("id, criado_em, usuario_email, acao, entidade, entidade_id, empresa_id, detalhes", { count: "exact" })
    .order("criado_em", { ascending: false });

  if (sp.acao) query = query.ilike("acao", `%${sp.acao}%`);
  if (sp.entidade) query = query.ilike("entidade", `%${sp.entidade}%`);
  if (sp.usuario) query = query.ilike("usuario_email", `%${sp.usuario}%`);
  if (sp.desde) query = query.gte("criado_em", sp.desde);
  if (sp.ate) query = query.lte("criado_em", `${sp.ate}T23:59:59`);

  const offset = offsetDaPagina(PORPAGINA, sp.page);
  const { data: itens, count } = await query.range(offset, offset + PORPAGINA - 1);
  const totalRegistros = count ?? 0;
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, PORPAGINA, sp.page);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — a tabela é paginada (30/pág),
  // então o gráfico usa uma amostra separada dos 500 eventos mais recentes
  // (respeitando os mesmos filtros ativos) em vez da página atual só.
  let queryAmostra = supabase
    .from("log_auditoria")
    .select("criado_em, usuario_email, acao")
    .order("criado_em", { ascending: false })
    .limit(500);
  if (sp.acao) queryAmostra = queryAmostra.ilike("acao", `%${sp.acao}%`);
  if (sp.entidade) queryAmostra = queryAmostra.ilike("entidade", `%${sp.entidade}%`);
  if (sp.usuario) queryAmostra = queryAmostra.ilike("usuario_email", `%${sp.usuario}%`);
  if (sp.desde) queryAmostra = queryAmostra.gte("criado_em", sp.desde);
  if (sp.ate) queryAmostra = queryAmostra.lte("criado_em", `${sp.ate}T23:59:59`);
  const { data: amostra } = await queryAmostra;
  const eventosAmostra = amostra ?? [];

  const porDiaMap = new Map<string, number>();
  for (const e of eventosAmostra) {
    const dia = e.criado_em.slice(0, 10);
    porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1);
  }
  const eventosPorDia: ItemEventosDia[] = [...porDiaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([dia, total]) => {
      const [, mes, d] = dia.split("-");
      return { dia: `${d}/${mes}`, total };
    });

  const porUsuarioMap = new Map<string, number>();
  for (const e of eventosAmostra) porUsuarioMap.set(e.usuario_email, (porUsuarioMap.get(e.usuario_email) ?? 0) + 1);
  const rankingUsuario: ItemRankingUsuario[] = [...porUsuarioMap.entries()]
    .map(([usuario, total]) => ({ usuario, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .reverse();

  const porAcaoMap = new Map<string, number>();
  for (const e of eventosAmostra) porAcaoMap.set(e.acao, (porAcaoMap.get(e.acao) ?? 0) + 1);
  const porAcao: ItemPorAcao[] = [...porAcaoMap.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Log de Auditoria</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quem mudou o quê, quando — restrito por enquanto a mudança de permissão, edição de preço de posto e
          inativação de veículo.
        </p>
      </div>

      <form className="card mb-4 flex flex-wrap items-end gap-2 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ação</label>
          <input type="text" name="acao" defaultValue={sp.acao ?? ""} placeholder="ex.: permissao" className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Entidade</label>
          <input
            type="text"
            name="entidade"
            defaultValue={sp.entidade ?? ""}
            placeholder="ex.: precos_postos"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Usuário</label>
          <input type="text" name="usuario" defaultValue={sp.usuario ?? ""} placeholder="e-mail" className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="desde" defaultValue={sp.desde ?? ""} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="ate" defaultValue={sp.ate ?? ""} className="input text-sm" />
        </div>
        <button type="submit" className="btn-primary text-sm">
          Filtrar
        </button>
      </form>

      <GraficoAuditoria eventosPorDia={eventosPorDia} rankingUsuario={rankingUsuario} porAcao={porAcao} />

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(itens ?? []).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatarDataHoraBr(log.criado_em)}</td>
                <td className="px-4 py-3 text-slate-600">{log.usuario_email}</td>
                <td className="px-4 py-3 text-slate-700">{log.acao}</td>
                <td className="px-4 py-3 text-slate-600">
                  {log.entidade}
                  {log.entidade_id && <span className="text-slate-400"> · {log.entidade_id}</span>}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-400" title={JSON.stringify(log.detalhes)}>
                  {log.detalhes ? JSON.stringify(log.detalhes) : "—"}
                </td>
              </tr>
            ))}
            {(itens ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 pb-2">
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            porPagina={PORPAGINA}
            basePath="/log-auditoria"
            paramsAtuais={{ acao: sp.acao, entidade: sp.entidade, usuario: sp.usuario, desde: sp.desde, ate: sp.ate }}
          />
        </div>
      </div>
    </div>
  );
}
