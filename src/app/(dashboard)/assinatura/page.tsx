import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import {
  FAIXA_VEICULOS_PLANO,
  FEATURES_PLANO,
  LIMITES_PLANO,
  PLANO_LABEL,
  STATUS_EMPRESA_LABEL,
  PLANOS_POSTO,
  PLANO_POSTO_LABEL,
  FEATURES_PLANO_POSTO,
  FAIXA_POSTOS_PLANO,
  PLANOS_GRUPO_FROTA,
  PLANO_GRUPO_FROTA_LABEL,
  FEATURES_GRUPO_FROTA,
  FAIXA_EMPRESAS_GRUPO_FROTA,
  type Plano,
  type PlanoPosto,
  type PlanoGrupoFrota,
  type StatusEmpresa,
} from "@/lib/constants";
import { buscarPrecosPlanos, formatarPrecoPlano } from "@/lib/planosPrecos";
import { BotaoAssinarPlano } from "./_components/BotaoAssinarPlano";
import { BotaoPortalPagamento } from "./_components/BotaoPortalPagamento";
import { CriarRedeForm } from "./_components/CriarRedeForm";
import { CriarGrupoFrotaForm } from "./_components/CriarGrupoFrotaForm";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Tag, Activity, Network, Building2, Users, Truck } from "lucide-react";

type SearchParams = { empresa?: string; checkout?: string; bloqueado?: string };

// "Minha Assinatura" — plano atual, uso vs. limites, histórico de faturas e
// os botões que levam ao Stripe Checkout (upgrade) e ao Billing Portal
// (gerenciar pagamento). Segue o mesmo padrão de seletor de cliente já usado
// em /centros-custo, /postos etc. (resolverEmpresaAtual) — assim o admin
// também consegue abrir a assinatura de qualquer cliente pra apoiar.
export default async function AssinaturaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, checkout, bloqueado } = await searchParams;
  const supabase = await createClient();
  const { user, empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let empresa: {
    id: string;
    nome: string;
    cnpj: string | null;
    plano: string;
    status: string;
    trial_ends_at: string | null;
    stripe_customer_id: string | null;
    max_usuarios: number | null;
    max_veiculos: number | null;
    segmento: string | null;
  } | null = null;
  let qtdUsuarios = 0;
  let qtdVeiculos = 0;
  // Fase Posto/Rede (26/07/2026) — substitui o cálculo antigo de "plano
  // recomendado" (Fase 27.125, que reaproveitava basico/profissional/
  // enterprise de frotista). Agora há planos de posto de verdade
  // (posto_essencial/profissional/enterprise) e a decisão do Daniel de
  // "assinatura única por rede (matriz paga por todos)": se este posto
  // pertence a uma Rede de Postos, é a REDE (grupos_economicos) quem tem
  // plano/status próprios, não a empresa — a empresa só espelha o valor.
  type RedeDoPosto = {
    id: string;
    nome: string;
    empresa_administradora_id: string | null;
    plano: string | null;
    status: string | null;
  };
  let redeDoPosto: RedeDoPosto | null = null;
  let qtdPostosNaRede = 0;
  let ehAdministradoraDaRede = false;

  // Fase Grupo-Economico-Frota-Billing (09/08/2026) — equivalente exato de
  // RedeDoPosto acima, pro segmento="Frota" (Grupo Econômico de clientes).
  // Mesmo espírito: se esta empresa pertence a um Grupo Econômico com
  // assinatura própria, é o GRUPO quem tem plano/status "de verdade", não
  // a empresa isolada — mas ao contrário do posto, uma empresa frotista
  // continua tendo seus próprios indicadores de uso (usuários/veículos são
  // por empresa, nunca compartilhados entre membros do grupo).
  type GrupoFrotaDoCliente = {
    id: string;
    nome: string;
    empresa_administradora_id: string | null;
    plano: string | null;
    status: string | null;
  };
  let grupoFrotaDoCliente: GrupoFrotaDoCliente | null = null;
  let qtdEmpresasNoGrupoFrota = 0;
  let ehAdministradoraDoGrupoFrota = false;

  let invoices: { id: string; valor_cents: number | null; status: string; criado_em: string; periodo_inicio: string | null; periodo_fim: string | null }[] = [];

  if (empresaSelecionada) {
    const { data: empresaData } = await supabase
      .from("empresas")
      .select("id, nome, cnpj, plano, status, trial_ends_at, stripe_customer_id, max_usuarios, max_veiculos, segmento")
      .eq("id", empresaSelecionada)
      .single();

    // Fase 27.43 — achado real (reportado pelo Daniel): este indicador
    // contava veículos com `.eq("cnpj_frota", empresa.cnpj)`, comparação
    // direta sem normalização — mesmo bug já corrigido em /veiculos e no
    // Dashboard (Fase 27.5/14): cadastro_veiculos.cnpj_frota nem sempre vem
    // gravado com a mesma pontuação de empresas.cnpj. Resultado real: a
    // "Frotas & Frotas Ltda" tinha 29 veículos, mas o indicador mostrava só
    // "2 / 10" (só os 2 que por acaso batiam com a formatação exata). Troca
    // pela RPC `contar_veiculos_reais_empresa` (mesma usada no bloqueio de
    // limite da Fase 27.41) — além de corrigir a contagem, deixa o número
    // exibido aqui consistente com o que de fato é aplicado no bloqueio.
    const [{ count: usuariosCount }, { data: veiculosCount }, { data: invoicesData }] = await Promise.all([
        supabase
          .from("usuarios_empresas")
          .select("user_email", { count: "exact", head: true })
          .eq("empresa_id", empresaSelecionada)
          .eq("ativo", true),
        supabase.rpc("contar_veiculos_reais_empresa", { p_empresa_id: empresaSelecionada }),
        supabase
          .from("invoices")
          .select("id, valor_cents, status, criado_em, periodo_inicio, periodo_fim")
          .eq("empresa_id", empresaSelecionada)
          .order("criado_em", { ascending: false })
          .limit(24),
      ]);

    empresa = empresaData;
    qtdUsuarios = usuariosCount ?? 0;
    qtdVeiculos = veiculosCount ?? 0;
    invoices = invoicesData ?? [];

    // Fase Posto/Rede (26/07/2026) — pra posto revendedor (segmento
    // "Revenda"), descobre se a empresa pertence a uma Rede de Postos
    // (grupos_economicos.segmento="Revenda") — se sim, é a REDE quem tem
    // plano/status/assinatura (matriz paga por todos), não a empresa
    // isolada. Uma empresa participa de no máximo uma rede de posto na
    // prática (sem constraint de unicidade no banco, mas é assim que a UI
    // de criação/entrada em rede foi desenhada).
    if (empresaData?.segmento === "Revenda") {
      const { data: membroRede } = await supabase
        .from("grupos_economicos_empresas")
        .select("grupo_economico_id, grupos_economicos!inner(id, nome, segmento, empresa_administradora_id, plano, status)")
        .eq("empresa_id", empresaSelecionada)
        .eq("grupos_economicos.segmento", "Revenda")
        .limit(1)
        .maybeSingle();

      const grupo = (membroRede as unknown as { grupos_economicos: RedeDoPosto } | null)?.grupos_economicos ?? null;
      if (grupo) {
        redeDoPosto = grupo;
        ehAdministradoraDaRede = grupo.empresa_administradora_id === empresaSelecionada;
        const { count } = await supabase
          .from("grupos_economicos_empresas")
          .select("empresa_id", { count: "exact", head: true })
          .eq("grupo_economico_id", grupo.id);
        qtdPostosNaRede = count ?? 1;
      } else {
        qtdPostosNaRede = 1; // posto avulso, sem rede
      }
    }

    // Fase Grupo-Economico-Frota-Billing (09/08/2026) — mesma lógica acima,
    // pro segmento "Frota" (Grupo Econômico de clientes). Uma empresa
    // participa de no máximo um Grupo Econômico na prática, mesmo padrão
    // de Rede de Postos.
    if (empresaData?.segmento === "Frota") {
      const { data: membroGrupo } = await supabase
        .from("grupos_economicos_empresas")
        .select("grupo_economico_id, grupos_economicos!inner(id, nome, segmento, empresa_administradora_id, plano, status)")
        .eq("empresa_id", empresaSelecionada)
        .eq("grupos_economicos.segmento", "Frota")
        .limit(1)
        .maybeSingle();

      const grupo = (membroGrupo as unknown as { grupos_economicos: GrupoFrotaDoCliente } | null)?.grupos_economicos ?? null;
      if (grupo) {
        grupoFrotaDoCliente = grupo;
        ehAdministradoraDoGrupoFrota = grupo.empresa_administradora_id === empresaSelecionada;
        const { count } = await supabase
          .from("grupos_economicos_empresas")
          .select("empresa_id", { count: "exact", head: true })
          .eq("grupo_economico_id", grupo.id);
        qtdEmpresasNoGrupoFrota = count ?? 1;
      }
    }
  }

  const diasRestantesTrial =
    empresa?.status === "trial" && empresa.trial_ends_at
      ? Math.ceil((new Date(empresa.trial_ends_at).getTime() - Date.now()) / 86400000)
      : null;

  const ehPosto = empresa?.segmento === "Revenda";

  const limitesDoPlano = empresa && !ehPosto ? LIMITES_PLANO[empresa.plano as Plano] : undefined;

  // Calibração de preços de 20/07/2026 — faixa de veículos inclusa no valor
  // BASE do plano atual + estimativa do excedente (cobrança ainda manual,
  // ver comentário em src/lib/constants.ts). Só exibição, não bloqueia nada.
  // Só se aplica a FROTISTA (empresa.segmento="Frota") — posto usa a faixa
  // de POSTOS (FAIXA_POSTOS_PLANO), calculada mais abaixo.
  const faixaVeiculosAtual = empresa && !ehPosto ? FAIXA_VEICULOS_PLANO[empresa.plano as Plano] : undefined;
  const veiculosExcedentes =
    faixaVeiculosAtual?.veiculos_inclusos != null ? Math.max(0, qtdVeiculos - faixaVeiculosAtual.veiculos_inclusos) : 0;
  const valorExcedenteEstimadoCentavos =
    veiculosExcedentes > 0 && faixaVeiculosAtual?.preco_excedente_centavos != null
      ? veiculosExcedentes * faixaVeiculosAtual.preco_excedente_centavos
      : 0;
  // Preço real de cada plano, buscado direto do Stripe (via Edge Function
  // planos-precos) — nunca hardcoded aqui, pra não desatualizar se o preço
  // mudar no Stripe. O mesmo objeto já traz os planos de frotista, posto e
  // (desde 09/08/2026) grupo frota — planos-precos mescla os três mapas.
  const precos = empresa ? await buscarPrecosPlanos() : null;

  // Fase Posto/Rede (26/07/2026) — decisão do Daniel: "assinatura única por
  // rede (matriz paga por todos)". Quando o posto pertence a uma rede, o
  // plano/status "de verdade" é o da REDE (redeDoPosto), não o espelhado em
  // empresas.plano — mas ambos deveriam bater (o webhook propaga um pro
  // outro), então cai pro plano da empresa como fallback só por segurança.
  const planoAtualPosto = (redeDoPosto?.plano ?? empresa?.plano ?? null) as PlanoPosto | null;
  const statusAtualPosto = redeDoPosto?.status ?? empresa?.status ?? null;
  const faixaPostosAtual = planoAtualPosto ? FAIXA_POSTOS_PLANO[planoAtualPosto] : undefined;
  const postosExcedentes =
    faixaPostosAtual?.postos_inclusos != null ? Math.max(0, qtdPostosNaRede - faixaPostosAtual.postos_inclusos) : 0;
  const valorExcedentePostoCentavos =
    postosExcedentes > 0 && faixaPostosAtual?.preco_excedente_centavos != null
      ? postosExcedentes * faixaPostosAtual.preco_excedente_centavos
      : 0;
  // Rede administrada por outra empresa: só a Profissional/Enterprise fazem
  // sentido pra assinar em nome da rede (Essencial é sempre posto avulso).
  const planosPostoParaExibir = redeDoPosto
    ? (["posto_profissional", "posto_enterprise"] as const)
    : PLANOS_POSTO;

  // Fase Grupo-Economico-Frota-Billing (09/08/2026) — mesma régua de
  // exibição da Rede de Postos acima, pro Grupo Econômico de clientes.
  // Diferença chave: o "plano efetivo" de exibição pro rótulo do cabeçalho
  // (rotuloPlanoFrotista) prefere o nome do GRUPO ("Grupo Profissional")
  // quando o grupo tem assinatura própria ativa — mas os indicadores de
  // uso (usuários/veículos) continuam sempre por empresa, nunca somados
  // entre membros do grupo.
  const empresasExcedentes =
    grupoFrotaDoCliente?.plano != null
      ? Math.max(
          0,
          qtdEmpresasNoGrupoFrota -
            (FAIXA_EMPRESAS_GRUPO_FROTA[grupoFrotaDoCliente.plano as PlanoGrupoFrota]?.empresas_inclusas ?? 0)
        )
      : 0;
  const valorExcedenteGrupoFrotaCentavos =
    empresasExcedentes > 0 && grupoFrotaDoCliente?.plano
      ? empresasExcedentes * FAIXA_EMPRESAS_GRUPO_FROTA[grupoFrotaDoCliente.plano as PlanoGrupoFrota].preco_excedente_centavos
      : 0;
  const rotuloPlanoFrotista =
    grupoFrotaDoCliente?.plano && grupoFrotaDoCliente.status === "ativo"
      ? (PLANO_GRUPO_FROTA_LABEL[grupoFrotaDoCliente.plano as PlanoGrupoFrota] ?? grupoFrotaDoCliente.plano)
      : (PLANO_LABEL[empresa?.plano as Plano] ?? empresa?.plano);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Minha Assinatura</h1>
        <p className="mt-1 text-sm text-slate-500">Plano atual, uso e histórico de cobrança.</p>
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

      {bloqueado === "1" && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Seu acesso está pausado.</strong> O trial acabou ou o último pagamento não foi
          confirmado. Escolha um plano abaixo para reativar — o resto do painel volta a funcionar assim
          que o pagamento for confirmado.
        </div>
      )}

      {checkout === "sucesso" && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Pagamento confirmado! Pode levar alguns segundos até o plano atualizar aqui — o Stripe já avisou
          nosso sistema.
        </div>
      )}
      {checkout === "cancelado" && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O checkout foi cancelado. Nenhuma cobrança foi feita.
        </div>
      )}

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver a assinatura dele.
        </p>
      )}

      {empresa && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {ehPosto ? (
              <>
                <IndicadorColorido
                  cor="sky"
                  icon={Tag}
                  label="Plano atual"
                  valor={planoAtualPosto ? (PLANO_POSTO_LABEL[planoAtualPosto] ?? planoAtualPosto) : "Sem plano"}
                  ajudaChave="assinatura.plano_atual"
                />
                <IndicadorColorido
                  cor="violet"
                  icon={Activity}
                  label="Status"
                  valor={statusAtualPosto ? (STATUS_EMPRESA_LABEL[statusAtualPosto as StatusEmpresa] ?? statusAtualPosto) : "—"}
                />
                <IndicadorColorido cor="green" icon={Network} label="Postos na rede" valor={`${qtdPostosNaRede}`} />
                <IndicadorColorido
                  cor="amber"
                  icon={Building2}
                  label="Administração"
                  valor={redeDoPosto ? (ehAdministradoraDaRede ? "Você (matriz)" : redeDoPosto.nome) : "Posto avulso"}
                />
              </>
            ) : (
              <>
                <IndicadorColorido cor="sky" icon={Tag} label="Plano atual" valor={rotuloPlanoFrotista ?? empresa.plano} ajudaChave="assinatura.plano_atual" />
                <IndicadorColorido cor="violet" icon={Activity} label="Status" valor={STATUS_EMPRESA_LABEL[empresa.status as StatusEmpresa] ?? empresa.status} />
                <IndicadorColorido
                  cor="green"
                  icon={Users}
                  label="Usuários"
                  valor={`${qtdUsuarios} / ${limitesDoPlano && limitesDoPlano.max_usuarios >= 0 ? limitesDoPlano.max_usuarios : "∞"}`}
                  ajudaChave="assinatura.saldo_uso"
                />
                <IndicadorColorido
                  cor="amber"
                  icon={Truck}
                  label="Veículos"
                  valor={`${qtdVeiculos} / ${limitesDoPlano && limitesDoPlano.max_veiculos >= 0 ? limitesDoPlano.max_veiculos : "∞"}`}
                  ajudaChave="assinatura.saldo_uso"
                />
              </>
            )}
          </div>

          {diasRestantesTrial !== null && (
            <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${diasRestantesTrial <= 3 ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
              {diasRestantesTrial > 0
                ? `Seu trial termina em ${diasRestantesTrial} dia${diasRestantesTrial === 1 ? "" : "s"}. Escolha um plano abaixo para continuar sem interrupção.`
                : "Seu trial expirou. Escolha um plano abaixo para reativar o acesso."}
            </div>
          )}

          {!ehPosto && !grupoFrotaDoCliente && veiculosExcedentes > 0 && (
            <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sua frota tem {veiculosExcedentes} veículo{veiculosExcedentes === 1 ? "" : "s"} acima da faixa
              inclusa no plano {PLANO_LABEL[empresa!.plano as Plano]} ({faixaVeiculosAtual?.veiculos_inclusos}{" "}
              inclusos). Excedente estimado:{" "}
              <strong>
                {(valorExcedenteEstimadoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
              </strong>
              . Isso já é cobrado automaticamente e aparece na sua próxima fatura — considere subir de
              plano se a faixa inclusa costuma ficar pequena pra sua frota.
            </div>
          )}

          {ehPosto && ehAdministradoraDaRede && postosExcedentes > 0 && (
            <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sua rede tem {postosExcedentes} posto{postosExcedentes === 1 ? "" : "s"} acima da faixa
              inclusa no plano {planoAtualPosto ? PLANO_POSTO_LABEL[planoAtualPosto] : ""} (
              {faixaPostosAtual?.postos_inclusos} inclusos). Excedente estimado:{" "}
              <strong>
                {(valorExcedentePostoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
              </strong>
              . Isso já é cobrado automaticamente (você, como administradora, é quem recebe a fatura) e
              aparece na próxima fatura da rede.
            </div>
          )}

          {!ehPosto && ehAdministradoraDoGrupoFrota && empresasExcedentes > 0 && (
            <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Seu grupo tem {empresasExcedentes} empresa{empresasExcedentes === 1 ? "" : "s"} acima da
              faixa inclusa no plano{" "}
              {grupoFrotaDoCliente?.plano ? PLANO_GRUPO_FROTA_LABEL[grupoFrotaDoCliente.plano as PlanoGrupoFrota] : ""} (
              {grupoFrotaDoCliente?.plano ? FAIXA_EMPRESAS_GRUPO_FROTA[grupoFrotaDoCliente.plano as PlanoGrupoFrota].empresas_inclusas : 0}{" "}
              inclusas). Excedente estimado:{" "}
              <strong>
                {(valorExcedenteGrupoFrotaCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
              </strong>
              . Isso já é cobrado automaticamente (você, como administradora, é quem recebe a fatura) e
              aparece na próxima fatura do grupo.
            </div>
          )}

          {ehPosto && !redeDoPosto && (
            <div className="card mb-6 p-6">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Rede de Postos</h2>
              <p className="text-xs text-slate-500">
                Junte vários postos numa assinatura só, paga por você (a empresa administradora) em nome
                de todos. Disponível a partir do plano Profissional.
              </p>
              <CriarRedeForm empresaId={empresa.id} />
            </div>
          )}

          {ehPosto && redeDoPosto && !ehAdministradoraDaRede && (
            <div className="card mb-6 p-6">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Rede de Postos</h2>
              <p className="text-sm text-slate-600">
                Este posto faz parte da rede <strong>{redeDoPosto.nome}</strong>. A assinatura é única e
                gerenciada pela empresa administradora da rede — fale com ela para alterar o plano.
              </p>
            </div>
          )}

          {!ehPosto && !grupoFrotaDoCliente && (
            <div className="card mb-6 p-6">
              <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                Grupo Econômico <AjudaIcon chave="grupo_economico.pagina" />
              </h2>
              <p className="text-xs text-slate-500">
                Tem mais de uma empresa — matriz e filiais do mesmo CNPJ raiz, ou empresas distintas do
                mesmo grupo? Junte todas numa assinatura só, paga por você (a empresa administradora) em
                nome de todo o grupo. Disponível a partir do plano Profissional. Também é possível{" "}
                <Link href="/grupo-economico/novo" className="font-medium text-frota-600 hover:underline">
                  criar o grupo pela tela de Grupo Econômico
                </Link>
                .
              </p>
              <CriarGrupoFrotaForm empresaId={empresa.id} />
            </div>
          )}

          {!ehPosto && grupoFrotaDoCliente && !ehAdministradoraDoGrupoFrota && (
            <div className="card mb-6 p-6">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Grupo Econômico</h2>
              <p className="text-sm text-slate-600">
                Esta empresa faz parte do grupo <strong>{grupoFrotaDoCliente.nome}</strong>. Quando o
                grupo tem assinatura própria, ela é única e gerenciada pela empresa administradora — fale
                com ela para alterar o plano.
              </p>
            </div>
          )}

          {(!ehPosto || (ehPosto && (!redeDoPosto || ehAdministradoraDaRede))) &&
            (ehPosto || !grupoFrotaDoCliente || ehAdministradoraDoGrupoFrota) && (
          <div className="card mb-6 p-6">
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Planos disponíveis <AjudaIcon chave="assinatura.termo_adesao" />
            </h2>
            {ehPosto ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {planosPostoParaExibir.map((plano) => {
                  const faixaPostos = FAIXA_POSTOS_PLANO[plano];
                  const ehAtual = planoAtualPosto === plano && statusAtualPosto === "ativo";
                  return (
                    <div
                      key={plano}
                      className={`rounded-lg border p-4 ${ehAtual ? "border-frota-600 bg-frota-50" : "border-slate-200"}`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{PLANO_POSTO_LABEL[plano]}</p>
                      <p className="mt-1 text-lg font-semibold text-frota-700">{formatarPrecoPlano(precos?.[plano])}</p>
                      {faixaPostos.postos_inclusos != null && faixaPostos.preco_excedente_centavos != null ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Inclui {faixaPostos.postos_inclusos} postos na rede ·{" "}
                          {(faixaPostos.preco_excedente_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          /posto excedente
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">1 posto (sem Rede de Postos)</p>
                      )}
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        {FEATURES_PLANO_POSTO[plano].map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="mt-0.5 text-frota-600">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {ehAtual ? (
                        <span className="badge-ativo mt-3 inline-block">Plano atual</span>
                      ) : (
                        <BotaoAssinarPlano
                          empresaId={empresa!.id}
                          grupoEconomicoId={redeDoPosto?.id}
                          plano={plano}
                          nomeEmpresa={empresa!.nome}
                          cnpj={empresa!.cnpj}
                          email={user?.email ?? ""}
                          precoLabel={formatarPrecoPlano(precos?.[plano])}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : grupoFrotaDoCliente && ehAdministradoraDoGrupoFrota ? (
              // Fase Grupo-Economico-Frota-Billing (09/08/2026) — empresa
              // administradora de um Grupo Econômico ativo assina em nome
              // de todo o grupo, mesmo padrão da Rede de Postos acima.
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PLANOS_GRUPO_FROTA.map((plano) => {
                  const faixaEmpresas = FAIXA_EMPRESAS_GRUPO_FROTA[plano];
                  const ehAtual = grupoFrotaDoCliente!.plano === plano && grupoFrotaDoCliente!.status === "ativo";
                  return (
                    <div
                      key={plano}
                      className={`rounded-lg border p-4 ${ehAtual ? "border-frota-600 bg-frota-50" : "border-slate-200"}`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{PLANO_GRUPO_FROTA_LABEL[plano]}</p>
                      <p className="mt-1 text-lg font-semibold text-frota-700">{formatarPrecoPlano(precos?.[plano])}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Inclui {faixaEmpresas.empresas_inclusas} empresas no grupo ·{" "}
                        {(faixaEmpresas.preco_excedente_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        /empresa excedente
                      </p>
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        {FEATURES_GRUPO_FROTA[plano].map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="mt-0.5 text-frota-600">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {ehAtual ? (
                        <span className="badge-ativo mt-3 inline-block">Plano atual</span>
                      ) : (
                        <BotaoAssinarPlano
                          empresaId={empresa!.id}
                          grupoEconomicoId={grupoFrotaDoCliente!.id}
                          plano={plano}
                          nomeEmpresa={empresa!.nome}
                          cnpj={empresa!.cnpj}
                          email={user?.email ?? ""}
                          precoLabel={formatarPrecoPlano(precos?.[plano])}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(["basico", "profissional", "enterprise"] as const).map((plano) => {
                const limites = LIMITES_PLANO[plano];
                const faixaVeiculos = FAIXA_VEICULOS_PLANO[plano];
                const ehAtual = empresa!.plano === plano && empresa!.status === "ativo";
                return (
                  <div
                    key={plano}
                    className={`rounded-lg border p-4 ${ehAtual ? "border-frota-600 bg-frota-50" : "border-slate-200"}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{PLANO_LABEL[plano]}</p>
                    <p className="mt-1 text-lg font-semibold text-frota-700">{formatarPrecoPlano(precos?.[plano])}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Até {limites.max_usuarios < 0 ? "usuários ilimitados" : `${limites.max_usuarios} usuário(s)`} ·{" "}
                      {limites.max_veiculos < 0 ? "veículos ilimitados" : `${limites.max_veiculos} veículos`}
                    </p>
                    {faixaVeiculos.veiculos_inclusos != null && faixaVeiculos.preco_excedente_centavos != null && (
                      <p className="mt-1 text-xs text-slate-400">
                        Inclui {faixaVeiculos.veiculos_inclusos} veículos no valor base ·{" "}
                        {(faixaVeiculos.preco_excedente_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        /veículo excedente
                      </p>
                    )}
                    <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                      {FEATURES_PLANO[plano].map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="mt-0.5 text-frota-600">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {ehAtual ? (
                      <span className="badge-ativo mt-3 inline-block">Plano atual</span>
                    ) : (
                      <BotaoAssinarPlano
                        empresaId={empresa!.id}
                        plano={plano}
                        nomeEmpresa={empresa!.nome}
                        cnpj={empresa!.cnpj}
                        email={user?.email ?? ""}
                        precoLabel={formatarPrecoPlano(precos?.[plano])}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
          )}

          <div className="card mb-6 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Pagamento</h2>
              <BotaoPortalPagamento empresaId={empresa.id} temAssinatura={!!empresa.stripe_customer_id} />
            </div>
            <p className="text-xs text-slate-500">
              Gerencie forma de pagamento, baixe recibos ou cancele a assinatura direto pelo portal do
              Stripe.
            </p>
          </div>

          <div className="card overflow-x-auto p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Histórico de faturas</h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-slate-600">
                      {inv.periodo_inicio && inv.periodo_fim
                        ? `${new Date(inv.periodo_inicio).toLocaleDateString("pt-BR")} – ${new Date(inv.periodo_fim).toLocaleDateString("pt-BR")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {inv.valor_cents != null ? (inv.valor_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={inv.status === "pago" ? "badge-ativo" : "badge-inativo"}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(inv.criado_em).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma fatura registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Dúvidas sobre cobrança?{" "}
            <Link href="/chamados/novo" className="text-frota-600 hover:underline">
              Abra um chamado
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
