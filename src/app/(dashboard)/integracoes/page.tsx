import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovaChaveForm } from "./_components/NovaChaveForm";
import { ListaChaves } from "./_components/ListaChaves";
import { FormularioNovaChaveCustosFixos } from "./_components/FormularioNovaChaveCustosFixos";
import { ListaChavesCustosFixos } from "./_components/ListaChavesCustosFixos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function IntegracoesPage() {
  const supabase = await createClient();
  const { data: chaves, error } = await supabase
    .from("profrotas_api_keys")
    .select("id, cnpj_frota, nome_empresa, ativo, ultimo_sync, registros_sync, data_inicio_sync")
    .order("nome_empresa");

  const total = chaves?.length ?? 0;
  const totalAtivas = chaves?.filter((c) => c.ativo).length ?? 0;
  const totalRegistros = (chaves ?? []).reduce((soma, c) => soma + (c.registros_sync ?? 0), 0);

  // Chaves do Hub de Integrações (Fase 22, generalizado na Fase 25) — lista
  // todo mundo que o usuário enxerga via RLS (própria empresa, ou todas se
  // for admin) e a lista de empresas disponíveis pra gerar uma chave nova.
  // Cada chave agora carrega um array de escopos granulares (ex:
  // "abastecimentos:write", "veiculos:read") em vez de servir só pra
  // custos fixos.
  const { empresas } = await resolverEmpresaAtual(supabase);
  const { data: chavesCustosFixos, error: erroChavesCustosFixos } = await supabase
    .from("api_keys")
    .select("id, nome, ativa, criada_em, ultimo_uso, escopos, empresas(nome)")
    .order("criada_em", { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Integrações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Conecte a frota de um cliente à API da PróFrotas para que os abastecimentos cheguem
          automaticamente, sem lançamento manual.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Clientes conectados" valor={total} />
        <Indicador label="Ativos" valor={totalAtivas} />
        <Indicador label="Registros sincronizados" valor={totalRegistros} />
      </div>

      <div className="mb-6">
        <NovaChaveForm />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar chaves: {error.message}</p>}
      <ListaChaves chaves={chaves ?? []} />

      <div className="mb-6 mt-10 border-t border-slate-200 pt-6">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
          Hub de Integrações <AjudaIcon chave="integracoes.chave_api" />
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gere uma chave de API pra um sistema externo do cliente (cartão combustível/pedágio, ERP
          financeiro, oficina, corretora de seguro, rastreador) enviar dados pra dentro da FNI, ou pra
          consultar os cadastros do cliente (veículos, motoristas, centros de custo, postos, usuários).
          Cada chave carrega só as permissões marcadas abaixo.
        </p>
      </div>

      <div className="mb-4">
        <FormularioNovaChaveCustosFixos empresas={empresas} />
      </div>

      {erroChavesCustosFixos && (
        <p className="mb-4 text-sm text-red-600">Erro ao carregar chaves: {erroChavesCustosFixos.message}</p>
      )}
      <ListaChavesCustosFixos
        chaves={(chavesCustosFixos ?? []).map((c) => ({
          id: c.id,
          nome: c.nome,
          ativa: c.ativa,
          criada_em: c.criada_em,
          ultimo_uso: c.ultimo_uso,
          escopos: Array.isArray(c.escopos) ? (c.escopos as string[]) : [],
          empresa_nome: c.empresas?.nome ?? null,
        }))}
      />

      <div className="card mt-6 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Como usar as APIs do Hub</h2>
        <p className="mb-3 text-sm text-slate-500">
          Toda chamada leva <code>Authorization: Bearer &lt;chave&gt;</code>. A chave só funciona pros
          escopos marcados na hora que ela foi gerada.
        </p>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lançar custo fixo (escopo custos_fixos:write)
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/custos-fixos \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "tipo": "seguro",
    "valor": 1250.90,
    "competencia": "2026-07-01",
    "placa": "ABC1D23",
    "descricao": "Apólice frota - julho"
  }'`}
        </pre>
        <p className="mb-4 text-xs text-slate-400">
          <code>tipo</code> aceita: seguro, ipva, licenciamento, rastreamento, multa, pedagio, outro.
        </p>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lançar abastecimento (escopo abastecimentos:write)
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/abastecimentos \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provedor": "ticket-log",
    "placa": "ABC1D23",
    "data_abastecimento": "2026-07-03T14:30:00Z",
    "quantidade": 45.5,
    "valor_total": 318.85,
    "combustivel": "diesel",
    "posto_nome": "Posto Alvorada",
    "transacao_externa_id": "TL-998877"
  }'`}
        </pre>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lançar manutenção (escopo manutencoes:write)
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/manutencoes \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "placa": "ABC1D23",
    "tipo_manutencao": "troca de óleo",
    "data_manutencao": "2026-07-03",
    "km_veiculo": 82000,
    "valor": 340.00,
    "oficina": "Oficina Central"
  }'`}
        </pre>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Consultar cadastros (escopos *:read)
        </p>
        <pre className="overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl https://SEU-DOMINIO-FNI.com.br/api/cadastros/veiculos?limit=100&offset=0 \\
  -H "Authorization: Bearer fni_..."

# mesmo padrão pra:
# /api/cadastros/motoristas
# /api/cadastros/centros-custo
# /api/cadastros/postos
# /api/cadastros/usuarios`}
        </pre>
        <p className="mt-3 text-xs text-slate-400">
          Todas as respostas GET vêm paginadas (<code>limit</code> padrão 100, máximo 500) e sempre
          filtradas pela empresa dona da chave — a chave nunca enxerga dados de outro cliente.
        </p>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}
