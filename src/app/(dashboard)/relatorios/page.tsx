import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { Anomalias } from "./_components/Anomalias";
import PerformancePorPostoLazy from "./_components/PerformancePorPostoLazy";
import ScorePerformanceLazy from "./_components/ScorePerformanceLazy";
import RelatorioExecutivoLazy from "./_components/RelatorioExecutivoLazy";
import RelatoriosPersonalizadosLazy from "./_components/RelatoriosPersonalizadosLazy";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";

type SearchParams = { empresa?: string };

// Igual ao padrão de /postos e /inteligencia-rede: resolve perfil + empresas
// do usuário, decide o cliente selecionado (seletor pra quem vê mais de um,
// direto pra quem só tem um) e busca tudo via RPC já filtrado por
// p_empresa_id — mesmo quando é o admin pré-visualizando um cliente
// específico (RLS sozinha não bastaria, ver Fase 14 no README).
export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  // Fase 27.2 — achado real: um usuário vinculado a mais de uma empresa (ex.:
  // grupo econômico) caía na MESMA condição do admin e recebia a base de
  // clientes inteira sem filtro nenhum. RLS de "empresas" já bloqueava o
  // vazamento de dado (só retorna linhas de empresas_do_usuario), mas o
  // código não devia depender só disso — corrigido pra filtrar
  // explicitamente por minhasEmpresasIds, que já cobre o próprio cliente e
  // as empresas "irmãs" do mesmo grupo econômico.
  let empresas: { id: string; nome: string }[] = [];
  if (perfil === "admin") {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
    const { data } = await supabase.from("empresas").select("id, nome").in("id", minhasEmpresasIds).order("nome");
    empresas = data ?? [];
  }

  const empresaSelecionada =
    (empresaParam && empresas.some((e) => e.id === empresaParam) ? empresaParam : null) ??
    (empresas.length === 1 ? empresas[0].id : null);

  const nomeEmpresaSelecionada =
    empresas.find((e) => e.id === empresaSelecionada)?.nome ??
    (perfil === "admin" ? "Rede FNI (todos os clientes)" : "todas as empresas do meu grupo");

  // Fase 27.32 — nome e cargo de quem está logado, pra exibir no cabeçalho do
  // PDF de Relatórios Personalizados (mesma fonte/padrão usado no layout do
  // dashboard, ver Fase 27.15): usuarios_app não tem FK pro auth.users, o
  // vínculo é por e-mail.
  const { data: perfilUsuarioApp } = await supabase
    .from("usuarios_app")
    .select("nome, perfil")
    .eq("email", user?.email ?? "")
    .maybeSingle();
  const nomeUsuarioAtual = perfilUsuarioApp?.nome || user?.email || "—";
  const cargoUsuarioAtual = perfilUsuarioApp?.perfil
    ? PERFIL_LABEL[perfilUsuarioApp.perfil as Perfil] ?? perfilUsuarioApp.perfil
    : null;

  // Janela padrão dos dados "brutos" de Relatórios Personalizados — últimos
  // 365 dias, mesma janela usada em outros pontos do app pra esse tipo de
  // consulta de abastecimento/manutenção (sempre retroativos, o abastecimento
  // e a manutenção já aconteceram quando são lançados).
  const hoje = new Date();
  const dataInicioPadrao = new Date(hoje);
  dataInicioPadrao.setDate(dataInicioPadrao.getDate() - 365);
  const pDataInicio = dataInicioPadrao.toISOString().slice(0, 10);
  const pDataFim = hoje.toISOString().slice(0, 10);

  // Custo fixo é diferente: seguro, IPVA, licenciamento etc. costumam ser
  // lançados com competência futura (vencimento/renovação), não só passada.
  // Por isso a janela dessa fonte também olha 365 dias pra frente.
  const dataFimCustosFixos = new Date(hoje);
  dataFimCustosFixos.setDate(dataFimCustosFixos.getDate() + 365);
  const pDataFimCustosFixos = dataFimCustosFixos.toISOString().slice(0, 10);

  const rpcArgs = empresaSelecionada ? { p_empresa_id: empresaSelecionada } : {};

  const [
    { data: historicoRaw },
    { data: desvioAnpRaw },
    { data: servicosRaw },
    { data: abastecimentosRaw },
    { data: manutencoesRaw },
    { data: custosFixosRaw },
    { data: notasFiscaisRaw },
    { data: fretesRaw },
    { data: financeiroRaw },
    { data: acoesSugeridasRaw },
    { data: chamadosRaw },
    { data: avaliacoesRaw },
    { data: multasRaw },
    { data: sinistrosRaw },
    { data: apolicesSeguroRaw },
    { data: pneusRaw },
    { data: estoquePecasRaw },
    { data: faturasFretesRaw },
    { data: solicitacoesAprovacaoRaw },
    { data: patrimonioRaw },
  ] = await Promise.all([
    supabase.rpc("historico_precos_detalhado", rpcArgs),
    supabase.rpc("postos_gf_desvio_anp", rpcArgs),
    supabase.rpc("postos_gf_servicos", rpcArgs),
    supabase.rpc("relatorio_abastecimentos_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_manutencoes_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_custos_fixos_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFimCustosFixos }),
    // Fase relatorios-mais-dimensoes (29/07/2026) — 6 novas fontes pro
    // construtor de Relatórios Personalizados, mesma janela padrão de 365
    // dias retroativos das demais (ver comentário acima sobre pDataInicio).
    supabase.rpc("relatorio_notas_fiscais_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_fretes_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_financeiro_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_acoes_sugeridas_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_chamados_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_avaliacoes_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    // Fase relatorios-mais-dimensoes-2 (07/09/2026) — 8 novas fontes pro
    // construtor de Relatórios Personalizados, cobrindo features lançadas
    // desde a leva anterior (multas, sinistros, seguro, pneus, estoque de
    // peças, faturas de frete, aprovações, patrimônio). Mesma janela padrão.
    supabase.rpc("relatorio_multas_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_sinistros_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_apolices_seguro_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_pneus_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_estoque_pecas_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_faturas_fretes_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_solicitacoes_aprovacao_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
    supabase.rpc("relatorio_patrimonio_bruto", { ...rpcArgs, p_data_inicio: pDataInicio, p_data_fim: pDataFim }),
  ]);

  const historico = (historicoRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    dataRef: r.data_ref,
    preco: r.preco,
  }));

  const desvios = (desvioAnpRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    diffPct: r.diff_pct,
  }));

  const servicos = (servicosRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    arla: r.arla,
    funciona24h: r.funciona_24h,
    possuiBanheiro: r.possui_banheiro,
    possuiEstacionamento: r.possui_estacionamento,
    possuiInternet: r.possui_internet,
    possuiOleoGranel: r.possui_oleo_granel,
    possuiRestaurante: r.possui_restaurante,
    possuiTrocaOleo: r.possui_troca_oleo,
    pistaCaminhao: r.pista_caminhao,
    conveniencia: r.conveniencia,
    convenienciaAmPm: r.conveniencia_am_pm,
  }));

  const abastecimentos = (abastecimentosRaw ?? []).map((r) => ({
    placa: r.placa,
    motorista: r.motorista,
    produto: r.produto,
    litros: r.litros,
    valor: r.valor,
    precoLitro: r.preco_litro,
    cnpjPosto: r.cnpj_posto,
    nomePosto: r.nome_posto,
    ufPosto: r.uf_posto,
    municipioPosto: r.municipio_posto,
    hodometro: r.hodometro,
    data: r.data,
    meioPagamento: r.meio_pagamento,
    tipoVeiculo: r.tipo_veiculo,
    marcaVeiculo: r.marca_veiculo,
    modeloVeiculo: r.modelo_veiculo,
    classificacaoVeiculo: r.classificacao_veiculo,
    centroCusto: r.centro_custo,
  }));

  const manutencoes = (manutencoesRaw ?? []).map((r) => ({
    placa: r.placa,
    oficina: r.oficina,
    custoTotal: r.custo_total,
    data: r.data,
    origem: r.origem,
    tecnico: r.tecnico,
    centroCusto: r.centro_custo,
  }));

  const custosFixos = (custosFixosRaw ?? []).map((r) => ({
    placa: r.placa,
    tipo: r.tipo,
    descricao: r.descricao,
    valor: r.valor,
    data: r.data,
    dataLancamento: r.data_lancamento,
    recorrente: r.recorrente,
    origem: r.origem,
    centroCusto: r.centro_custo,
  }));

  // Fase relatorios-mais-dimensoes — mapeamento das 6 fontes novas, mesmo
  // padrão snake_case (banco) -> camelCase (front) das 3 acima.
  const notasFiscais = (notasFiscaisRaw ?? []).map((r) => ({
    produto: r.produto,
    nomePosto: r.nome_posto,
    cnpjPosto: r.cnpj_posto,
    numeroNf: r.numero_nf,
    quantidade: r.quantidade,
    valorTotal: r.valor_total,
    valorUnitario: r.valor_unitario,
    data: r.data,
  }));

  const fretes = (fretesRaw ?? []).map((r) => ({
    titulo: r.titulo,
    status: r.status,
    tipoCarga: r.tipo_carga,
    ufOrigem: r.uf_origem,
    ufDestino: r.uf_destino,
    motorista: r.motorista,
    valorOferecido: r.valor_oferecido,
    kmEstimado: r.km_estimado,
    pesoCargaKg: r.peso_carga_kg,
    data: r.data,
  }));

  const financeiro = (financeiroRaw ?? []).map((r) => ({
    movimento: r.movimento,
    status: r.status,
    contraparte: r.contraparte,
    origem: r.origem,
    valorOriginal: r.valor_original,
    valorPago: r.valor_pago,
    data: r.data,
  }));

  const acoesSugeridas = (acoesSugeridasRaw ?? []).map((r) => ({
    tipo: r.tipo,
    severidade: r.severidade,
    status: r.status,
    alvoLabel: r.alvo_label,
    data: r.data,
  }));

  const chamados = (chamadosRaw ?? []).map((r) => ({
    tipo: r.tipo,
    prioridade: r.prioridade,
    status: r.status,
    data: r.data,
  }));

  const avaliacoes = (avaliacoesRaw ?? []).map((r) => ({
    estrelas: r.estrelas,
    temComentario: r.tem_comentario,
    data: r.data,
  }));

  // Fase relatorios-mais-dimensoes-2 — mapeamento das 8 fontes novas, mesmo
  // padrão snake_case (banco) -> camelCase (front) das demais.
  const multas = (multasRaw ?? []).map((r) => ({
    placa: r.placa,
    motorista: r.motorista,
    orgaoAutuador: r.orgao_autuador,
    gravidade: r.gravidade,
    pontos: r.pontos,
    valorOriginal: r.valor_original,
    valorDesconto: r.valor_desconto,
    status: r.status,
    tipoVeiculo: r.tipo_veiculo,
    centroCusto: r.centro_custo,
    data: r.data,
  }));

  const sinistros = (sinistrosRaw ?? []).map((r) => ({
    placa: r.placa,
    motorista: r.motorista,
    tipo: r.tipo,
    gravidade: r.gravidade,
    houveVitima: r.houve_vitima,
    custoEstimado: r.custo_estimado,
    localOcorrencia: r.local_ocorrencia,
    tipoVeiculo: r.tipo_veiculo,
    centroCusto: r.centro_custo,
    data: r.data,
  }));

  const apolicesSeguro = (apolicesSeguroRaw ?? []).map((r) => ({
    placa: r.placa,
    seguradora: r.seguradora,
    cobertura: r.cobertura,
    valorPremio: r.valor_premio,
    valorFranquia: r.valor_franquia,
    vigenciaInicio: r.vigencia_inicio,
    vigenciaFim: r.vigencia_fim,
    tipoVeiculo: r.tipo_veiculo,
    centroCusto: r.centro_custo,
    data: r.data,
  }));

  const pneus = (pneusRaw ?? []).map((r) => ({
    placa: r.placa,
    posicao: r.posicao,
    marca: r.marca,
    modelo: r.modelo,
    medida: r.medida,
    status: r.status,
    valorAquisicao: r.valor_aquisicao,
    numeroRecapagens: r.numero_recapagens,
    custoRecapagensTotal: r.custo_recapagens_total,
    tipoVeiculo: r.tipo_veiculo,
    centroCusto: r.centro_custo,
    data: r.data,
  }));

  const estoquePecas = (estoquePecasRaw ?? []).map((r) => ({
    pecaNome: r.peca_nome,
    pecaCodigo: r.peca_codigo,
    tipoMovimento: r.tipo_movimento,
    quantidade: r.quantidade,
    custoUnitario: r.custo_unitario,
    valorTotal: r.valor_total,
    placa: r.placa,
    motivo: r.motivo,
    data: r.data,
  }));

  const faturasFretes = (faturasFretesRaw ?? []).map((r) => ({
    tomadorNome: r.tomador_nome,
    numeroFatura: r.numero_fatura,
    valorTotal: r.valor_total,
    quantidadeCtes: r.quantidade_ctes,
    status: r.status,
    periodoInicio: r.periodo_inicio,
    periodoFim: r.periodo_fim,
    vencimento: r.vencimento,
    data: r.data,
  }));

  const solicitacoesAprovacao = (solicitacoesAprovacaoRaw ?? []).map((r) => ({
    categoria: r.categoria,
    titulo: r.titulo,
    valor: r.valor,
    status: r.status,
    nivelAtual: r.nivel_atual,
    niveisNecessarios: r.niveis_necessarios,
    solicitanteEmail: r.solicitante_email,
    data: r.data,
  }));

  const patrimonio = (patrimonioRaw ?? []).map((r) => ({
    placa: r.placa,
    tipo: r.tipo,
    valor: r.valor,
    motivo: r.motivo,
    tipoVeiculo: r.tipo_veiculo,
    centroCusto: r.centro_custo,
    data: r.data,
  }));

  return (
    <div>
      <CabecalhoPagina
        titulo="Relatórios"
        descricao={`Relatório executivo, performance por posto, score × utilização, anomalias e relatórios personalizados — ${nomeEmpresaSelecionada}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">{perfil === "admin" ? "Rede inteira (todos os clientes)" : "Todas as empresas do meu grupo"}</option>
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

      <AbasPainel
        abas={[
          {
            id: "executivo",
            label: "📊 Relatório Executivo",
            conteudo: <RelatorioExecutivoLazy historico={historico} nomeEmpresa={nomeEmpresaSelecionada} />,
            ajudaChave: "relatorios.executivo",
          },
          {
            id: "performance",
            label: "⭐ Performance por Posto",
            conteudo: <PerformancePorPostoLazy historico={historico} />,
            ajudaChave: "relatorios.performance_posto",
          },
          {
            id: "score",
            label: "🎯 Score × Performance",
            conteudo: <ScorePerformanceLazy historico={historico} desvios={desvios} servicos={servicos} />,
            ajudaChave: "relatorios.score_performance",
          },
          {
            id: "anomalias",
            label: "🔍 Anomalias",
            conteudo: <Anomalias historico={historico} />,
            ajudaChave: "relatorios.anomalias",
          },
          {
            id: "personalizados",
            label: "🗂️ Relatórios Personalizados",
            conteudo: (
              <RelatoriosPersonalizadosLazy
                abastecimentos={abastecimentos}
                manutencoes={manutencoes}
                custosFixos={custosFixos}
                notasFiscais={notasFiscais}
                fretes={fretes}
                financeiro={financeiro}
                acoesSugeridas={acoesSugeridas}
                chamados={chamados}
                avaliacoes={avaliacoes}
                multas={multas}
                sinistros={sinistros}
                apolicesSeguro={apolicesSeguro}
                pneus={pneus}
                estoquePecas={estoquePecas}
                faturasFretes={faturasFretes}
                solicitacoesAprovacao={solicitacoesAprovacao}
                patrimonio={patrimonio}
                nomeEmpresa={nomeEmpresaSelecionada}
                nomeUsuario={nomeUsuarioAtual}
                cargoUsuario={cargoUsuarioAtual}
              />
            ),
            ajudaChave: "relatorios.personalizados",
          },
        ]}
      />
    </div>
  );
}
