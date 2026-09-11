import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import RelatoriosPersonalizadosPostoLazy from "./_components/RelatoriosPersonalizadosPostoLazy";

type SearchParams = { empresa?: string };

// Fase Relatorios-Personalizados-Posto (09/09/2026, pedido do Daniel: "a
// visao de posto na aplicacao nao possui uma aba de Relatorios
// Personalizados... precisamos trazer relatorios para esta visão, com
// fontes de dados, dimensoes e variaveis diversas, assim como temos na
// visao do cliente") — mesmo espírito de /relatorios (lado cliente), mas
// com as 3 fontes que existem de fato pro tenant posto (vendedor):
// Vendas (relatorio_vendas_posto_bruto), Financeiro (faturas_postos +
// despesas_postos, unidas aqui em JS) e Notas Fiscais emitidas
// (notas_fiscais_abastecimento, lado emitente). As demais ~14 fontes do
// lado cliente (abastecimentos-como-comprador, manutenção, pneus, sinistros
// etc.) são todas sobre veículos/motoristas — não existem no tenant posto,
// por isso não têm equivalente aqui.
export default async function RelatoriosPostoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return <div className="card p-6 text-sm text-slate-600 dark:text-slate-300">Esta tela é exclusiva para postos revendedores.</div>;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfilUsuarioApp } = await supabase
    .from("usuarios_app")
    .select("nome, perfil")
    .eq("email", user?.email ?? "")
    .maybeSingle();
  const nomeUsuarioAtual = perfilUsuarioApp?.nome || user?.email || "—";
  const cargoUsuarioAtual = perfilUsuarioApp?.perfil
    ? PERFIL_LABEL[perfilUsuarioApp.perfil as Perfil] ?? perfilUsuarioApp.perfil
    : null;

  // Mesma janela padrão de 365 dias retroativos usada em /relatorios (lado
  // cliente) — abastecimento, fatura e despesa já aconteceram/foram lançados
  // quando entram aqui.
  const hoje = new Date();
  const dataInicioPadrao = new Date(hoje);
  dataInicioPadrao.setDate(dataInicioPadrao.getDate() - 365);
  const pDataInicio = dataInicioPadrao.toISOString().slice(0, 10);
  const pDataFim = hoje.toISOString().slice(0, 10);

  const [{ data: vendasRaw }, { data: faturasRaw }, { data: despesasRaw }, { data: notasFiscaisRaw }] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("relatorio_vendas_posto_bruto", {
          p_empresa_posto_id: empresaSelecionada,
          p_data_inicio: pDataInicio,
          p_data_fim: pDataFim,
        }),
        supabase
          .from("faturas_postos")
          .select("cliente_nome, status, valor_total, vencimento")
          .eq("empresa_posto_id", empresaSelecionada)
          .gte("vencimento", pDataInicio),
        supabase
          .from("despesas_postos")
          .select("tipo, descricao, status, valor, vencimento")
          .eq("empresa_posto_id", empresaSelecionada)
          .gte("vencimento", pDataInicio),
        supabase
          .from("notas_fiscais_abastecimento")
          .select("produto_descricao_anp, produto_nome_xml, nome_destinatario, cnpj_destinatario, numero_nf, quantidade, valor_total, valor_unitario, data_emissao")
          .eq("empresa_posto_id", empresaSelecionada)
          .gte("data_emissao", pDataInicio),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }];

  const vendas = (vendasRaw ?? []).map((r) => ({
    clienteNome: r.cliente_nome,
    clienteMunicipio: r.cliente_municipio,
    clienteUf: r.cliente_uf,
    produto: r.produto,
    litros: r.litros,
    valor: r.valor,
    precoLitro: r.preco_litro,
    provedor: r.provedor,
    placa: r.placa,
    motorista: r.motorista,
    data: r.data,
  }));

  // União de faturas (Receber) + despesas (Pagar) — mesma estrutura de
  // relatorio_financeiro_bruto (lado cliente: contas_receber + contas_pagar),
  // só que feita aqui em JS porque não existe RPC "bruto" unificada pro lado
  // posto ainda (as 2 tabelas já vêm com RLS própria escopando por
  // empresa_posto_id, buscadas direto acima).
  const financeiro = [
    ...(faturasRaw ?? []).map((f) => ({
      movimento: "Receber" as const,
      status: f.status,
      contraparte: f.cliente_nome,
      origem: "Fatura de Cliente",
      valorOriginal: f.valor_total,
      valorPago: f.status === "paga" ? f.valor_total : null,
      data: f.vencimento,
    })),
    ...(despesasRaw ?? []).map((d) => ({
      movimento: "Pagar" as const,
      status: d.status,
      contraparte: d.descricao || d.tipo,
      origem: d.tipo,
      valorOriginal: d.valor,
      valorPago: d.status === "pago" ? d.valor : null,
      data: d.vencimento,
    })),
  ];

  const notasFiscais = (notasFiscaisRaw ?? []).map((n) => ({
    produto: n.produto_descricao_anp || n.produto_nome_xml,
    clienteNome: n.nome_destinatario,
    cnpjCliente: n.cnpj_destinatario,
    numeroNf: n.numero_nf,
    quantidade: n.quantidade,
    valorTotal: n.valor_total,
    valorUnitario: n.valor_unitario,
    data: n.data_emissao,
  }));

  return (
    <div>
      <CabecalhoPagina
        titulo="Relatórios Personalizados"
        descricao={`Combine fonte, dimensão e métricas pra montar o relatório que você precisa${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <RelatoriosPersonalizadosPostoLazy
          vendas={vendas}
          financeiro={financeiro}
          notasFiscais={notasFiscais}
          nomeEmpresa={nomeEmpresaSelecionada ?? "—"}
          nomeUsuario={nomeUsuarioAtual}
          cargoUsuario={cargoUsuarioAtual}
        />
      )}
    </div>
  );
}
