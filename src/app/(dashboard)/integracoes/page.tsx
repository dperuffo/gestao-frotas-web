import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { verificarLimiteFrota, mensagemLimiteExcedido } from "@/lib/limitePlano";
import { NovaChaveForm } from "./_components/NovaChaveForm";
import { ListaChaves } from "./_components/ListaChaves";
import { FormularioNovaChaveCustosFixos } from "./_components/FormularioNovaChaveCustosFixos";
import { ListaChavesCustosFixos } from "./_components/ListaChavesCustosFixos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { AbasPainel, type Aba } from "../inteligencia-rede/_components/AbasPainel";
import { LogoProvedor } from "@/components/LogoProvedor";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Building2, CheckCircle2, RefreshCw } from "lucide-react";

type ChaveCustosFixosRow = {
  id: string;
  nome: string;
  ativa: boolean | null;
  criada_em: string | null;
  ultimo_uso: string | null;
  escopos: string[];
  empresa_nome: string | null;
};

export default async function IntegracoesPage() {
  const supabase = await createClient();

  // Fase 27.50 — um posto revendedor (perfil "posto") também acessa esta
  // tela, mas só pra gerar/gerenciar a própria chave de Negociação — o sync
  // ProFrotas e os demais meios de pagamento (TicketLog, Rede Frota, Veloe
  // etc.) são específicos do lado Frota e ficam escondidos pra esse perfil.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfilUsuario } = await supabase
    .from("usuarios_app")
    .select("perfil")
    .eq("email", user?.email ?? "")
    .maybeSingle();
  const ehPosto = perfilUsuario?.perfil === "posto";

  const { data: chaves, error } = ehPosto
    ? { data: [] as never[], error: null }
    : await supabase
        .from("profrotas_api_keys")
        .select("id, cnpj_frota, nome_empresa, ativo, ultimo_sync, registros_sync, data_inicio_sync")
        .order("nome_empresa");

  // Fase 27.41 — mostra na hora, sem precisar clicar em "Sincronizar agora",
  // se a frota real do cliente já estourou o limite do plano (o sync em si
  // já é bloqueado nas actions — isto aqui é só pra dar visibilidade
  // imediata na tela, com link direto pra Assinatura).
  const chavesComAvisoLimite = await Promise.all(
    (chaves ?? []).map(async (c) => {
      const { data: empresaId } = await supabase.rpc("empresa_id_do_cnpj", { p_cnpj: c.cnpj_frota });
      if (!empresaId) return { ...c, avisoLimite: undefined as string | undefined };
      const limite = await verificarLimiteFrota(supabase, empresaId);
      return { ...c, avisoLimite: limite.ok ? undefined : mensagemLimiteExcedido(limite) };
    })
  );

  const total = chaves?.length ?? 0;
  const totalAtivas = chaves?.filter((c) => c.ativo).length ?? 0;
  const totalRegistros = (chaves ?? []).reduce((soma, c) => soma + (c.registros_sync ?? 0), 0);

  // Chaves do Hub de Integrações (Fase 22, generalizado na Fase 25) — lista
  // todo mundo que o usuário enxerga via RLS (própria empresa, ou todas se
  // for admin) e a lista de empresas disponíveis pra gerar uma chave nova.
  // Cada chave carrega um array de escopos granulares (ex:
  // "abastecimentos:write", "veiculos:read") em vez de ser presa a um único
  // provedor — a mesma chave serve pra qualquer meio de pagamento, o
  // provedor é identificado pelo campo "provedor" no corpo de cada chamada.
  const { empresas } = await resolverEmpresaAtual(supabase);
  const { data: chavesCustosFixos, error: erroChavesCustosFixos } = await supabase
    .from("api_keys")
    .select("id, nome, ativa, criada_em, ultimo_uso, escopos, empresas(nome)")
    .order("criada_em", { ascending: false });

  const chavesHub: ChaveCustosFixosRow[] = (chavesCustosFixos ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    ativa: c.ativa,
    criada_em: c.criada_em,
    ultimo_uso: c.ultimo_uso,
    escopos: Array.isArray(c.escopos) ? (c.escopos as string[]) : [],
    empresa_nome: c.empresas?.nome ?? null,
  }));

  // Posto: nenhum meio de pagamento de combustível se aplica (quem compra
  // combustível é o cliente/frota, não o posto) — mantém a tela como
  // sempre foi, só com o Hub genérico (escopo de Negociação/Notas
  // Fiscais/Abastecimentos Fornecidos).
  if (ehPosto) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Integrações</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gere uma chave de API pra enviar propostas de negociação aos seus clientes e acompanhar/responder
            o andamento, direto do sistema do seu posto.
          </p>
        </div>
        <SecaoHub
          ehPosto
          empresas={empresas}
          chaves={chavesHub}
          erro={erroChavesCustosFixos ? erroChavesCustosFixos.message : null}
        />
      </div>
    );
  }

  // Fase Integracoes-Abas — pedido do Daniel: "Solicito que coloque 1 aba
  // para cada meio de pagamento: Pró-Frotas, TicketLog, Rede Frota, Veloe e
  // outras que virão. Organizar esta tela" + depois "tem o meio de pagamento
  // Valecard também para o próximo desenvolvimento" — Valecard entrou como
  // 5ª aba, mesmo padrão genérico dos outros 3. Hoje só a Pró-Frotas tem
  // integração NATIVA (sync automático via token JWT, tabela
  // profrotas_api_keys) — os demais meios de pagamento entram pelo Hub
  // genérico (chave de API com escopo "Abastecimentos", campo "provedor"
  // livre no corpo da chamada — ver /api/integracoes/abastecimentos).
  // Cada aba de provedor já deixa isso explícito e mostra o exemplo de
  // chamada pronto com o nome do provedor preenchido; quando um provedor
  // ganhar uma integração nativa própria (como a Pró-Frotas), a aba dele
  // troca de conteúdo sem afetar as demais. "Outras que virão" não precisa
  // de aba nova pra funcionar — o campo "provedor" é texto livre, então
  // qualquer parceiro novo já consegue integrar hoje pela aba "Outros
  // Sistemas / Hub"; uma aba dedicada só compensa quando (e se) ganhar
  // sincronização automática própria.
  const abas: Aba[] = [
    {
      id: "profrotas",
      label: <LogoProvedor provedor="profrotas" className="h-5 w-auto" />,
      conteudo: (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Conecte a frota de um cliente à API da PróFrotas para que os abastecimentos cheguem
            automaticamente, sem lançamento manual.
          </p>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Building2} label="Clientes conectados" valor={String(total)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivas)} />
            <IndicadorColorido cor="violet" icon={RefreshCw} label="Registros sincronizados" valor={totalRegistros.toLocaleString("pt-BR")} />
          </div>
          <div className="mb-6">
            <NovaChaveForm />
          </div>
          {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar chaves: {error.message}</p>}
          <ListaChaves chaves={chavesComAvisoLimite} />
        </div>
      ),
    },
    {
      id: "ticketlog",
      label: <LogoProvedor provedor="ticket_log" className="h-5 w-auto" />,
      conteudo: <SecaoProvedorGenerico nome="TicketLog" slug="ticket_log" />,
    },
    {
      id: "redefrota",
      label: <LogoProvedor provedor="rede_frota" className="h-5 w-auto" />,
      conteudo: <SecaoProvedorGenerico nome="Rede Frota" slug="rede_frota" />,
    },
    {
      id: "veloe",
      label: <LogoProvedor provedor="veloe" className="h-5 w-auto" />,
      conteudo: <SecaoProvedorGenerico nome="Veloe" slug="veloe" />,
    },
    {
      id: "valecard",
      label: <LogoProvedor provedor="valecard" className="h-5 w-auto" />,
      conteudo: <SecaoProvedorGenerico nome="Valecard" slug="valecard" />,
    },
    {
      id: "hub",
      label: "🧩 Outros Sistemas / Hub",
      ajudaChave: "integracoes.chave_api",
      conteudo: (
        <SecaoHub
          ehPosto={false}
          empresas={empresas}
          chaves={chavesHub}
          erro={erroChavesCustosFixos ? erroChavesCustosFixos.message : null}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Integrações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada meio de pagamento tem a própria aba abaixo — Pró-Frotas já sincroniza automático; os demais
          (e qualquer parceiro novo) entram pelo Hub genérico até ganharem integração nativa própria.
        </p>
      </div>
      <AbasPainel abas={abas} />
    </div>
  );
}

// Aba de um meio de pagamento que ainda não tem sync nativo próprio (todos,
// exceto Pró-Frotas, por enquanto) — explica o caminho de hoje (Hub +
// escopo Abastecimentos) e já entrega o exemplo de chamada com o provedor
// preenchido, pra não obrigar o time do parceiro a adivinhar o valor certo
// do campo "provedor".
function SecaoProvedorGenerico({ nome, slug }: { nome: string; slug: string }) {
  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Integração com {nome}</h2>
      <p className="mt-2 text-sm text-slate-500">
        Ainda não existe uma sincronização automática nativa com a {nome} (como a que já existe com a
        Pró-Frotas) — está no roadmap. Por enquanto, a integração acontece pelo Hub de Integrações
        genérico: gere uma chave na aba <strong>Outros Sistemas / Hub</strong> marcando o escopo{" "}
        <strong>Abastecimentos (escrita)</strong> e envie cada abastecimento informando{" "}
        <code>&quot;provedor&quot;: &quot;{slug}&quot;</code> no corpo da chamada.
      </p>

      <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Lançar abastecimento da {nome} (escopo abastecimentos:write)
      </p>
      <pre className="overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/abastecimentos \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provedor": "${slug}",
    "placa": "ABC1D23",
    "motorista_nome": "João da Silva",
    "motorista_cpf": "123.456.789-00",
    "data_abastecimento": "2026-07-03T14:30:00Z",
    "quantidade": 45.5,
    "valor_total": 318.85,
    "combustivel": "diesel",
    "posto_nome": "Posto Alvorada",
    "transacao_externa_id": "${slug.toUpperCase()}-998877"
  }'`}
      </pre>
      <p className="mt-3 text-xs text-slate-400">
        <code>transacao_externa_id</code> é o identificador da transação no sistema da {nome} — reenviar o
        mesmo id (com o mesmo provedor) nunca duplica o abastecimento, então é seguro reprocessar em caso
        de retry. <code>motorista_cpf</code> é opcional mas recomendado: é o que identifica o motorista
        com certeza no programa de fidelidade/gamificação (nome sozinho falha com homônimos).
      </p>
    </div>
  );
}

// Fase 25 — Hub de Integrações genérico, com chaves de escopo granular.
// Reaproveitado tanto na visão do posto (sem abas, categoria só de
// Negociação) quanto na aba "Outros Sistemas / Hub" da visão do cliente —
// pra não duplicar o formulário/lista/documentação em dois lugares.
function SecaoHub({
  ehPosto,
  empresas,
  chaves,
  erro,
}: {
  ehPosto: boolean;
  empresas: { id: string; nome: string }[];
  chaves: ChaveCustosFixosRow[];
  erro: string | null;
}) {
  return (
    <div>
      {!ehPosto && (
        <div className="mb-6">
          <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">Hub de Integrações</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gere uma chave de API pra um sistema externo do cliente (cartão combustível/pedágio, ERP
            financeiro, oficina, corretora de seguro, rastreador) enviar dados pra dentro da FNI, ou pra
            consultar os cadastros do cliente (veículos, motoristas, centros de custo, postos, usuários).
            Cada chave carrega só as permissões marcadas abaixo — a mesma chave pode ser usada por
            qualquer meio de pagamento (Pró-Frotas à parte, que tem fluxo próprio na aba dela).
          </p>
        </div>
      )}

      <div className="mb-4">
        <FormularioNovaChaveCustosFixos
          empresas={empresas}
          apenasCategorias={ehPosto ? ["Negociação com Cliente", "Notas Fiscais", "Abastecimentos Fornecidos"] : undefined}
        />
      </div>

      {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar chaves: {erro}</p>}
      <ListaChavesCustosFixos chaves={chaves} />

      <div className="card mt-6 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Como usar as APIs do Hub</h2>
        <p className="mb-3 text-sm text-slate-500">
          Toda chamada leva <code>Authorization: Bearer &lt;chave&gt;</code>. A chave só funciona pros
          escopos marcados na hora que ela foi gerada.
        </p>

        {!ehPosto && (
          <>
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
              Lançar abastecimento — qualquer meio de pagamento (escopo abastecimentos:write)
            </p>
            <pre className="mb-4 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/abastecimentos \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provedor": "ticket_log",
    "placa": "ABC1D23",
    "motorista_nome": "João da Silva",
    "motorista_cpf": "123.456.789-00",
    "data_abastecimento": "2026-07-03T14:30:00Z",
    "quantidade": 45.5,
    "valor_total": 318.85,
    "combustivel": "diesel",
    "posto_nome": "Posto Alvorada",
    "transacao_externa_id": "TL-998877"
  }'`}
            </pre>
            <p className="mb-4 text-xs text-slate-400">
              <code>provedor</code> é texto livre — identifica de qual meio de pagamento veio o
              abastecimento (ex: <code>ticket_log</code>, <code>rede_frota</code>, <code>veloe</code>,
              <code> valecard</code>, <code>profrotas</code>). Cada meio de pagamento tem uma aba própria acima com este mesmo
              exemplo já preenchido. <code>motorista_cpf</code> é opcional mas recomendado — identifica o
              motorista com certeza no programa de fidelidade/gamificação (aceito com ou sem pontuação).
            </p>

            {/* Fase Financeiro-ERP (26/07/2026) — substitui, pra quem já é
                um meio de pagamento de verdade, o modelo antigo de ciclos/
                faturas_postos calculados pela FNI: o provedor já fecha a
                própria fatura e só empurra ela (+ os abastecimentos
                atrelados) pra virar contas a pagar no ERP financeiro do
                cliente, sem a FNI recalcular nada. */}
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Enviar fatura fechada, com os abastecimentos (escopo faturas_meio_pagamento:write)
            </p>
            <pre className="mb-1 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/faturas-meio-pagamento \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provedor": "ticket_log",
    "numero_fatura_externa": "TL-FAT-000123",
    "periodo_inicio": "2026-07-01",
    "periodo_fim": "2026-07-31",
    "vencimento": "2026-08-10",
    "valor_total": 12480.55,
    "abastecimentos": [
      {
        "transacao_externa_id": "TL-998877",
        "placa": "ABC1D23",
        "motorista_cpf": "123.456.789-00",
        "data_abastecimento": "2026-07-03T14:30:00Z",
        "combustivel": "diesel",
        "quantidade": 45.5,
        "valor_unitario": 7.00,
        "valor_total": 318.85,
        "posto_nome": "Posto Alvorada",
        "posto_cnpj": "98.765.432/0001-00"
      }
    ]
  }'`}
            </pre>
            <p className="mb-4 text-xs text-slate-400">
              Use isto (em vez de lançar cada abastecimento avulso pelo endpoint acima) quando o seu sistema
              já fecha a fatura do período e vai cobrar o cliente diretamente — a FNI não recalcula nada,
              só registra a fatura como contas a pagar do cliente (com aging e baixa manual em{" "}
              <strong>Financeiro</strong>) e os abastecimentos atrelados a ela. <code>numero_fatura_externa</code>{" "}
              garante idempotência (reenviar a mesma fatura nunca duplica); cada item de{" "}
              <code>abastecimentos</code> também precisa de <code>transacao_externa_id</code> único —
              itens sem ele são ignorados (a resposta lista os índices ignorados em{" "}
              <code>itens_sem_transacao_externa_id</code>). Se <code>valor_total</code> não for informado,
              é calculado pela soma dos itens.
            </p>

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

            {/* Fase Grupo 2 (Rodopar/Datapar, item 4, 03/08/2026) — mecanismo
                GENÉRICO de rastreamento: em vez de integrar com um provedor
                específico, qualquer sistema (Sascar, Positron, Onixsat,
                Autotrac ou outro que o cliente já tenha) configura o próprio
                envio pra cá, com a chave dele — vira mapa ao vivo na Torre
                de Controle. Aceita 1 posição OU um array (lote). */}
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Enviar posição de GPS — qualquer provedor de rastreamento (escopo gps:write)
            </p>
            <pre className="mb-1 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/gps \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "placa": "ABC1D23",
      "lat": -23.55052,
      "lon": -46.633308,
      "velocidade_kmh": 62.5,
      "timestamp_gps": "2026-08-03T14:30:00Z",
      "provedor": "sascar"
    }
  ]'`}
            </pre>
            <p className="mb-4 text-xs text-slate-400">
              Não é uma integração com um provedor específico — é um endpoint aberto pra{" "}
              <strong>qualquer</strong> sistema de rastreamento que você já tenha (Sascar, Positron, Onixsat,
              Autotrac ou outro). Aceita um objeto único ou um array (lote). <code>lat</code>/<code>lon</code>{" "}
              e <code>placa</code> são obrigatórios; <code>timestamp_gps</code> (se ausente, usa o horário de
              recebimento), <code>velocidade_kmh</code> e <code>provedor</code> são opcionais. As posições
              alimentam o mapa ao vivo em <strong>Torre de Controle</strong> (última posição por placa).
            </p>
          </>
        )}

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Enviar proposta de negociação (escopo negociacoes:write)
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/negociacoes \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_cnpj": "12.345.678/0001-90",
    "combustivel": "Diesel S-10 Comum",
    "vigencia_inicio": "2026-08-01",
    "vigencia_fim": "2027-01-31",
    "volume_minimo_mensal": 5000,
    "preco_unitario": 5.89
  }'`}
        </pre>
        <p className="mb-4 text-xs text-slate-400">
          Depois de enviada, use <code>POST .../negociacoes/&lt;id&gt;/rodadas</code> (mesmo corpo) pra
          contrapropor, ou <code>POST .../negociacoes/&lt;id&gt;/decisao</code> com{" "}
          <code>{`{"decisao": "aceita"}`}</code> ou <code>{`{"decisao": "recusada"}`}</code> pra responder
          uma proposta do cliente. <code>GET /api/integracoes/negociacoes</code> lista o andamento de
          todas as suas negociações.
        </p>

        {ehPosto && (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Enviar NF-e de venda de combustível (escopo notas_fiscais:write)
            </p>
            <pre className="mb-1 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/notas-fiscais \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/xml" \\
  --data-binary @nfe-73051.xml`}
            </pre>
            <p className="mb-4 text-xs text-slate-400">
              Envie o XML completo da NF-e (com o protocolo de autorização da SEFAZ anexado) como corpo
              bruto da requisição. O sistema tenta encontrar sozinho o abastecimento correspondente (por
              CNPJ emitente/destinatário, data, quantidade e valor); se achar mais de um candidato, a
              resposta traz a lista pra você reenviar informando qual é o certo (campo{" "}
              <code>abastecimento_id</code> no corpo, como query string{" "}
              <code>?abastecimento_id=123</code>). Nunca aceita duas notas com a mesma chave de acesso.
            </p>

            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Lançar abastecimento fornecido (escopo abastecimentos_fornecidos:write)
            </p>
            <pre className="mb-1 overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/abastecimentos-fornecidos \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_cnpj": "12.345.678/0001-90",
    "sistema": "tanknomia",
    "placa": "ABC1D23",
    "motorista_nome": "João da Silva",
    "motorista_cpf": "123.456.789-00",
    "data_abastecimento": "2026-07-12T14:30:00Z",
    "hodometro": 82500,
    "combustivel": "Diesel S-10 Comum",
    "quantidade": 45.5,
    "valor_unitario": 6.29,
    "valor_total": 286.20,
    "transacao_externa_id": "BOMBA-4-00019823"
  }'`}
            </pre>
            <p className="mb-4 text-xs text-slate-400">
              Use isto pra integrar o sistema de automação da bomba/PDV do seu posto direto com a FNI,
              sem depender de nenhum provedor de cartão no meio. <code>cliente_cnpj</code> precisa ser de
              um cliente já cadastrado na FNI; CNPJ e nome do posto são sempre os da empresa dona desta
              chave (não vêm do corpo). Cai na mesma lista de abastecimentos fornecidos, entra nos
              indicadores financeiros, pode receber pedido de ajuste e vincular NF-e — igual a qualquer
              outro meio de pagamento.
            </p>
          </>
        )}

        {!ehPosto && (
          <>
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

            {/* Fase 27.120/27.121 — Parâmetros de Uso: 10 tipos de regra
                que balizam abastecimentos em soluções de automação de
                posto/meios de pagamento (ver /parametros-uso). */}
            <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Consultar Parâmetros de Uso (escopos parametros_*:read)
            </p>
            <pre className="overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl "https://SEU-DOMINIO-FNI.com.br/api/integracoes/parametros/vinculo?placa=ABC1D23&cpf=12345678900" \\
  -H "Authorization: Bearer fni_..."

# mesmo padrão (filtros opcionais por querystring, GET, paginado) pra:
# /api/integracoes/parametros/vinculo           ?placa= &cpf=            (Vínculo Motorista ↔ Veículo)
# /api/integracoes/parametros/intervalo         ?placa= &motorista_cpf=  (Intervalo entre Abastecimentos)
# /api/integracoes/parametros/valor-diario      ?motorista_cpf=          (Valor Diário — Motorista)
# /api/integracoes/parametros/volume-diario     ?placa=                  (Volume Diário — Veículo)
# /api/integracoes/parametros/produto           ?placa=                  (Produto Abastecido)
# /api/integracoes/parametros/hodometro         ?placa= &classificacao=Leve|Pesado
# /api/integracoes/parametros/dias-horarios     ?placa= &motorista_cpf=
# /api/integracoes/parametros/postos            ?placa= &posto_cnpj=
# /api/integracoes/parametros/servicos          ?placa=
# /api/integracoes/parametros/cotas             ?placa=                  (traz consumido/disponível do período atual)`}
            </pre>
            <p className="mt-3 text-xs text-slate-400">
              Cada tipo é um escopo separado — marque só os que a sua integração precisa consultar. Só
              regras com <code>status: &quot;Ativo&quot;</code> aparecem na resposta; use os filtros pra
              checar rapidamente um par placa/motorista específico antes de liberar um abastecimento, em
              vez de trazer a lista inteira.
            </p>

            {/* Fase 27.140 — Parâmetros de NF: preferências de emissão de
                nota fiscal configuradas pelo cliente por CNPJ da frota (ver
                /parametros-nf). Escopo próprio, fora de "Parâmetros de Uso"
                porque não é sobre autorizar o abastecimento, e sim sobre
                como a NF daquela venda deve ser emitida. */}
            <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Consultar Parâmetros de NF (escopo parametros_nf:read)
            </p>
            <pre className="overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl "https://SEU-DOMINIO-FNI.com.br/api/integracoes/parametros-nf?cnpj_frota=12345678000199&uf=SP" \\
  -H "Authorization: Bearer fni_..."

# resposta (paginada, filtros opcionais por querystring):
# {
#   "total": 1, "limit": 100, "offset": 0,
#   "dados": [{
#     "cnpj_frota": "12345678000199",
#     "exige_nota_fiscal": "Sim",
#     "separar_nf_combustivel": "Sim",
#     "forma_emissao": "Nota no ato do abastecimento",
#     "local_destino": "Personalizado CNPJ por Estado",
#     "cnpj_destino_personalizado": "11.111.111/0001-11",
#     "destino_por_uf": [
#       { "uf": "SP", "cnpj_destino": "22.222.222/0001-22" },
#       { "uf": "RJ", "cnpj_destino": "22.222.222/0001-22" }
#     ],
#     "cnpj_destino_resolvido": "22.222.222/0001-22",
#     "dados_adicionais": "Incluir centro de custo no campo de observação da NF",
#     "status": "Ativo"
#   }]
# }`}
            </pre>
            <p className="mt-3 text-xs text-slate-400">
              Sem <code>cnpj_frota</code> na querystring, retorna todas as regras ativas do cliente
              (inclusive a regra padrão, com <code>cnpj_frota: null</code>, que vale quando não existe
              regra específica para o CNPJ da nota). Quando <code>local_destino</code> é
              &quot;Personalizado CNPJ por Estado&quot;, use o parâmetro <code>uf</code> (sigla do estado do
              abastecimento) para receber também <code>cnpj_destino_resolvido</code> já calculado — é a
              exceção daquela UF em <code>destino_por_uf</code>, ou o <code>cnpj_destino_personalizado</code>
              (padrão da regra) quando o estado não tem exceção cadastrada.
            </p>

            {/* Fase 27.15x — Regras Antifraude: diferente de Parâmetros de
                Uso acima (o sistema externo consulta os dados crus e decide
                sozinho), aqui a FNI já avalia as regras e devolve o
                veredito pronto (autorizado/reprovado + motivo) numa única
                chamada — ver /antifraude. */}
            <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Verificar antifraude antes de autorizar (escopo antifraude:verificar)
            </p>
            <pre className="overflow-x-auto rounded-lg bg-frota-950 px-4 py-3 text-xs text-slate-100">
{`curl -X POST https://SEU-DOMINIO-FNI.com.br/api/integracoes/antifraude/verificar \\
  -H "Authorization: Bearer fni_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "placa": "ABC1D23",
    "motorista_cpf": "12345678900",
    "posto_cnpj": "98765432000100",
    "data_hora": "2026-07-16T14:30:00-03:00",
    "litros": 45,
    "valor_total": 315.90
  }'

# resposta (aprovado):     { "autorizado": true }
# resposta (reprovado):    { "autorizado": false, "motivo": "...", "regra_id": "..." }
# resposta (falha nossa):  { "autorizado": true, "aviso": "..." }  — nunca bloqueia por erro nosso`}
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              Se o cliente tiver o parâmetro de uso &quot;Pré-Pedido&quot; habilitado (ver /parametros-uso), esta
              mesma verificação passa a exigir <code>placa</code> e <code>posto_cnpj</code> no corpo: o abastecimento
              só é autorizado se houver um Pré-Pedido ativo daquela placa com parada pré-agendada para o
              CNPJ informado. A parada é marcada como atendida automaticamente após a autorização.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Chame isto <strong>antes</strong> de liberar o abastecimento — a resposta já diz se pode
              seguir. Se a verificação falhar por algum problema nosso, a resposta ainda assim autoriza
              (<code>autorizado: true</code>), pra nunca travar sua operação; o cliente é avisado por
              e-mail pra revisar depois. Todos os campos do corpo são opcionais — quanto mais informar,
              mais regras conseguem ser checadas (ex.: sem <code>motorista_cpf</code>, regras por
              motorista não são avaliadas).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
