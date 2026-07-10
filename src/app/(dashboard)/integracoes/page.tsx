import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { verificarLimiteFrota, mensagemLimiteExcedido } from "@/lib/limitePlano";
import { NovaChaveForm } from "./_components/NovaChaveForm";
import { ListaChaves } from "./_components/ListaChaves";
import { FormularioNovaChaveCustosFixos } from "./_components/FormularioNovaChaveCustosFixos";
import { ListaChavesCustosFixos } from "./_components/ListaChavesCustosFixos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function IntegracoesPage() {
  const supabase = await createClient();

  // Fase 27.50 — um posto revendedor (perfil "posto") também acessa esta
  // tela, mas só pra gerar/gerenciar a própria chave de Negociação — o sync
  // ProFrotas e os demais escopos do Hub (custos fixos, abastecimentos,
  // manutenções, cadastros) são específicos do lado Frota e ficam
  // escondidos pra esse perfil.
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
          {ehPosto
            ? "Gere uma chave de API pra enviar propostas de negociação aos seus clientes e acompanhar/responder o andamento, direto do sistema do seu posto."
            : "Conecte a frota de um cliente à API da PróFrotas para que os abastecimentos cheguem automaticamente, sem lançamento manual."}
        </p>
      </div>

      {!ehPosto && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Clientes conectados" valor={total} />
            <Indicador label="Ativos" valor={totalAtivas} />
            <Indicador label="Registros sincronizados" valor={totalRegistros} />
          </div>

          <div className="mb-6">
            <NovaChaveForm />
          </div>

          {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar chaves: {error.message}</p>}
          <ListaChaves chaves={chavesComAvisoLimite} />
        </>
      )}

      <div className="mb-6 mt-10 border-t border-slate-200 pt-6">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
          Hub de Integrações <AjudaIcon chave="integracoes.chave_api" />
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {ehPosto
            ? 'Gere uma chave marcando as permissões de "Negociação com Postos" abaixo — é ela que o sistema do seu posto vai usar pra chamar a API.'
            : "Gere uma chave de API pra um sistema externo do cliente (cartão combustível/pedágio, ERP financeiro, oficina, corretora de seguro, rastreador) enviar dados pra dentro da FNI, ou pra consultar os cadastros do cliente (veículos, motoristas, centros de custo, postos, usuários). Cada chave carrega só as permissões marcadas abaixo."}
        </p>
      </div>

      <div className="mb-4">
        <FormularioNovaChaveCustosFixos
          empresas={empresas}
          apenasCategorias={ehPosto ? ["Negociação com Cliente", "Notas Fiscais"] : undefined}
        />
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
          </>
        )}
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
