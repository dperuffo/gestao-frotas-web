import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { BotaoRevogarConsentimento } from "./_components/BotaoRevogarConsentimento";
import { FormSolicitarExclusao } from "./_components/FormSolicitarExclusao";
import { BotaoMarcarExecutada } from "./_components/BotaoMarcarExecutada";

function formatarDataHora(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

const TIPO_CONSENTIMENTO_LABEL: Record<string, string> = {
  cadastro: "Aceite no cadastro",
  revogacao: "Revogação de consentimento",
};

const STATUS_EXCLUSAO_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Pendente", classe: "badge-atencao" },
  executado: { texto: "Executado", classe: "badge-ativo" },
};

// Tela de Privacidade / LGPD (Fase 27.13) — lgpd_consents e lgpd_exclusoes já
// existiam no banco compartilhado, sem nenhuma tela usando elas. Cobre os
// direitos do titular já prometidos na Cláusula 10ª do Termo de Adesão
// (src/lib/termoAdesao.ts): acesso (mostra os dados cadastrais), revogação
// de consentimento e eliminação (solicitação de exclusão, revisada pela
// equipe FNI antes de executar — ver comentário em actions.ts sobre por que
// não é uma exclusão automática).
export default async function LgpdPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehAdmin = perfil === "admin";

  const { data: meuUsuario } = await supabase
    .from("usuarios_app")
    .select("nome, email, cpf, telefone, empresa_nome, perfil, mfa_habilitado, created_at")
    .eq("email", user?.email ?? "")
    .maybeSingle();

  const [{ data: consentimentosRaw }, { data: minhasExclusoesRaw }] = await Promise.all([
    supabase.from("lgpd_consents").select("id, tipo, ip, timestamp").eq("email", user?.email ?? "").order("timestamp", { ascending: false }),
    supabase
      .from("lgpd_exclusoes")
      .select("id, empresa_id, status, solicitado_em, executado_em")
      .eq("email", user?.email ?? "")
      .order("solicitado_em", { ascending: false }),
  ]);
  const consentimentos = consentimentosRaw ?? [];
  const minhasExclusoes = minhasExclusoesRaw ?? [];

  // Admin (time interno FNI) não é um cliente/tenant — não faz sentido pra
  // ele "solicitar exclusão dos meus dados". Em vez disso, vê o painel com
  // as solicitações de todos os clientes, pra revisar e marcar como
  // executadas.
  const { empresas } = ehAdmin ? { empresas: [] } : await resolverEmpresaAtual(supabase);

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: painel admin,
  // cross-tenant (solicitações de exclusão de TODOS os clientes), buscando
  // tudo numa query só, sem `.range()` — sujeita ao corte padrão de 1.000
  // linhas do PostgREST com o tempo (mesmo bug já corrigido em /veiculos,
  // Fase 27.38). Busca em lotes de 1.000 até esgotar.
  const LOTE_EXCLUSOES = 1000;
  const todasExclusoes: { id: string; empresa_id: string; email: string; status: string; solicitado_em: string | null; executado_em: string | null }[] = [];
  let empresasTodas: { id: string; nome: string }[] = [];
  if (ehAdmin) {
    let offsetBusca = 0;
    for (;;) {
      const { data: lote } = await supabase
        .from("lgpd_exclusoes")
        .select("id, empresa_id, email, status, solicitado_em, executado_em")
        .order("solicitado_em", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_EXCLUSOES - 1);
      if (!lote || lote.length === 0) break;
      todasExclusoes.push(...lote);
      if (lote.length < LOTE_EXCLUSOES) break;
      offsetBusca += LOTE_EXCLUSOES;
    }
    const { data: empresasRaw } = await supabase.from("empresas").select("id, nome");
    empresasTodas = empresasRaw ?? [];
  }
  const nomeEmpresa = (id: string) => empresasTodas.find((e) => e.id === id)?.nome ?? "—";

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
          🔒 Privacidade e Proteção de Dados (LGPD) <AjudaIcon chave="lgpd.pagina" />
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Seus dados, seu histórico de consentimento e os mecanismos de revogação e exclusão previstos na
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
      </div>

      {!ehAdmin && (
        <>
          <div className="card mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Seus dados cadastrais</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Nome</dt>
                <dd className="text-slate-700">{meuUsuario?.nome ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">E-mail</dt>
                <dd className="text-slate-700">{meuUsuario?.email ?? user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">CPF</dt>
                <dd className="text-slate-700">{meuUsuario?.cpf || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Telefone</dt>
                <dd className="text-slate-700">{meuUsuario?.telefone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Cliente vinculado</dt>
                <dd className="text-slate-700">{meuUsuario?.empresa_nome || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Cadastrado em</dt>
                <dd className="text-slate-700">{formatarDataHora(meuUsuario?.created_at ?? null)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Autenticação em 2 fatores (MFA)</dt>
                <dd className="text-slate-700">{meuUsuario?.mfa_habilitado ? "Ativada" : "Não ativada"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              Esses são os dados pessoais que a FNI trata a seu respeito (art. 18, I da LGPD — direito de acesso). Para
              corrigir alguma informação, abra um chamado em Gestão de Chamados.
            </p>
          </div>

          <div className="card mb-6 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Revogar consentimento</h2>
            <p className="mb-3 text-xs text-slate-500">
              Você pode revogar, a qualquer momento, o consentimento dado no cadastro (art. 8º, §5º da LGPD). Isso não
              encerra sua conta nem apaga seus dados — o tratamento necessário à prestação do serviço contratado
              continua (art. 7º, V), mas a revogação fica registrada no seu histórico abaixo.
            </p>
            <BotaoRevogarConsentimento />
          </div>

          <div className="card mb-6 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Solicitar exclusão dos meus dados</h2>
            <p className="mb-3 text-xs text-slate-500">
              Direito ao esquecimento (art. 18, VI). A solicitação é revisada pela equipe FNI antes da execução —
              respeitando prazos legais de retenção (ex.: notas fiscais, faturamento) — e você recebe um retorno por
              e-mail.
            </p>
            {empresas.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum cliente vinculado ao seu usuário no momento.</p>
            ) : (
              <FormSolicitarExclusao empresas={empresas} />
            )}
            {minhasExclusoes.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1.5 pr-3">Solicitado em</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5">Executado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {minhasExclusoes.map((e) => {
                      const status = STATUS_EXCLUSAO_LABEL[e.status] ?? { texto: e.status, classe: "badge-atencao" };
                      return (
                        <tr key={e.id}>
                          <td className="py-1.5 pr-3 text-slate-600">{formatarDataHora(e.solicitado_em)}</td>
                          <td className="py-1.5 pr-3">
                            <span className={status.classe}>{status.texto}</span>
                          </td>
                          <td className="py-1.5 text-slate-600">{formatarDataHora(e.executado_em)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Histórico de consentimento</h2>
            {consentimentos.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum registro de consentimento encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1.5 pr-3">Data</th>
                      <th className="py-1.5 pr-3">Tipo</th>
                      <th className="py-1.5">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consentimentos.map((c) => (
                      <tr key={c.id}>
                        <td className="py-1.5 pr-3 text-slate-600">{formatarDataHora(c.timestamp)}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{TIPO_CONSENTIMENTO_LABEL[c.tipo] ?? c.tipo}</td>
                        <td className="py-1.5 text-slate-600">{c.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {ehAdmin && (
        <div className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Solicitações de exclusão de dados (todos os clientes)</h2>
          <p className="mb-4 text-xs text-slate-500">
            Painel interno FNI — revise cada solicitação (obrigações contratuais e prazos legais de retenção) antes de
            executar a exclusão e marcar como concluída aqui.
          </p>
          {todasExclusoes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma solicitação de exclusão registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Solicitado em</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Executado em</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todasExclusoes.map((e) => {
                    const status = STATUS_EXCLUSAO_LABEL[e.status] ?? { texto: e.status, classe: "badge-atencao" };
                    return (
                      <tr key={e.id} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 text-slate-600">{nomeEmpresa(e.empresa_id)}</td>
                        <td className="px-4 py-3 text-slate-600">{e.email}</td>
                        <td className="px-4 py-3 text-slate-600">{formatarDataHora(e.solicitado_em)}</td>
                        <td className="px-4 py-3">
                          <span className={status.classe}>{status.texto}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatarDataHora(e.executado_em)}</td>
                        <td className="px-4 py-3">{e.status === "pendente" && <BotaoMarcarExecutada id={e.id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
