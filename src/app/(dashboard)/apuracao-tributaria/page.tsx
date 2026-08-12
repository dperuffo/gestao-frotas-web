import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { FormularioRegimeTributario } from "./_components/FormularioRegimeTributario";
import { BotaoReprocessarNotas } from "./_components/BotaoReprocessarNotas";

// Fase Apuracao-ICMS-Combustivel (12/08/2026) — pedido do Daniel: "Criar aba
// de Apuração de crédito tributário sobre combustível. Extensão natural do
// módulo de Notas Fiscais que já captura o XML de cada abastecimento [...]
// Preciso que implemente uma tela onde as informações das notas fiscais
// reais que forem anexadas pelos postos, ja populem os campos obrigatorios.
// Os campos que necessitam de informaçao do cliente tambem devem ser
// preenchidos para que a apuracao seja mais assertiva. O regime tributario
// deve ser preenchido pelo cliente para o calculo da apuracao."
//
// Base legal: LC 192/2022 (ICMS monofásico sobre combustíveis) + Convênio
// ICMS 26/2023 (credita o ICMS retido quando o diesel/GLP é insumo de um
// serviço de transporte tributado por ICMS). A própria NF-e do posto já traz
// o valor do crédito PRÉ-CALCULADO no grupo <ICMS61> (vICMSMonoRet) — o
// parser (src/lib/nfe.ts) só extrai, não deriva fórmula nenhuma.
//
// Simplificações desta 1ª entrega, deixadas explícitas na tela (não
// escondidas): (1) a apuração some vICMSMonoRet de TODAS as notas com o
// grupo — não distingue diesel/GLP de outro combustível monofásico, porque
// a NF-e já traz o valor certo pra cada um; (2) a atribuição por UF usa
// uf_emitente (UF do posto) como aproximação de "onde a operação começa" —
// o correto seria a UF de início da prestação de transporte (dado de
// frete/CT-e, fora do escopo desta 1ª entrega — ver aviso na tela);
// (3) elegibilidade (regime + declaração de atividade) é autodeclarada pelo
// cliente, não validada contra nenhum cadastro externo — é uma estimativa
// que precisa de validação contábil antes de virar apuração formal no
// Livro de Apuração do ICMS.
export default async function ApuracaoTributariaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; periodo?: string }>;
}) {
  const { empresa: empresaParam, periodo: periodoParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Apuração de Crédito Tributário</h1>
        </div>
        {empresas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa disponível.</p>
        ) : (
          <form className="mb-4 flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
              <select name="empresa" defaultValue="" className="input text-sm">
                <option value="" disabled>
                  Selecione...
                </option>
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
      </div>
    );
  }

  const { data: empresaInfo } = await supabase
    .from("empresas")
    .select("segmento, uf, regime_tributario, elegivel_credito_icms_combustivel")
    .eq("id", empresaSelecionada)
    .maybeSingle();

  if (empresaInfo?.segmento === "Revenda") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Apuração de Crédito Tributário</h1>
        </div>
        <p className="text-sm text-slate-500">
          Esta apuração é do lado do cliente (transportadora) — quem toma o crédito de ICMS pelo combustível consumido, não
          o posto que vende.
        </p>
      </div>
    );
  }

  // Período: mês selecionado (?periodo=YYYY-MM), padrão mês atual.
  const hoje = new Date();
  const periodo = periodoParam && /^\d{4}-\d{2}$/.test(periodoParam) ? periodoParam : hoje.toISOString().slice(0, 7);
  const [ano, mes] = periodo.split("-").map(Number);
  const inicioPeriodo = new Date(Date.UTC(ano, mes - 1, 1));
  const fimPeriodo = new Date(Date.UTC(ano, mes, 1));

  const { data: notas } = await supabase
    .from("notas_fiscais_abastecimento")
    .select(
      "id, numero_nf, data_emissao, nome_emitente, produto_nome_xml, produto_descricao_anp, quantidade, valor_total, cst_icms, cfop, uf_emitente, v_icms_mono_ret"
    )
    .eq("empresa_cliente_id", empresaSelecionada)
    .gte("data_emissao", inicioPeriodo.toISOString())
    .lt("data_emissao", fimPeriodo.toISOString())
    .order("data_emissao", { ascending: false });

  const todasNotas = notas ?? [];
  const notasComCredito = todasNotas.filter((n) => n.v_icms_mono_ret !== null);
  const notasSemDado = todasNotas.length - notasComCredito.length;
  const totalCredito = notasComCredito.reduce((soma, n) => soma + Number(n.v_icms_mono_ret ?? 0), 0);

  const porUf = new Map<string, number>();
  for (const n of notasComCredito) {
    const uf = n.uf_emitente ?? "—";
    porUf.set(uf, (porUf.get(uf) ?? 0) + Number(n.v_icms_mono_ret ?? 0));
  }

  const regime = empresaInfo?.regime_tributario ?? null;
  const elegivel = empresaInfo?.elegivel_credito_icms_combustivel ?? null;
  const podeCreditar = regime === "normal" && elegivel === true;
  const cadastroIncompleto = regime === null || elegivel === null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Apuração de Crédito Tributário sobre Combustível</h1>
        {nomeEmpresaSelecionada && <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>}
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <input type="hidden" name="periodo" value={periodo} />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada} className="input text-sm">
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

      <div className="mb-6">
        <FormularioRegimeTributario empresaId={empresaSelecionada} regimeAtual={regime} elegivelAtual={elegivel} />
      </div>

      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mês de referência</label>
          <input type="month" name="periodo" defaultValue={periodo} form="form-periodo" className="input text-sm" />
        </div>
        <form id="form-periodo" action="/apuracao-tributaria">
          <input type="hidden" name="empresa" value={empresaSelecionada} />
          <button type="submit" className="btn-secondary text-sm">
            Ver
          </button>
        </form>
      </div>

      {cadastroIncompleto && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preencha o regime tributário e confirme a elegibilidade acima pra ver o valor apurável como crédito seu — até lá, a
          tela mostra só o que as notas trazem, em modo informativo.
        </div>
      )}
      {!cadastroIncompleto && !podeCreditar && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {regime === "simples_nacional"
            ? "Empresas no Simples Nacional não têm direito a crédito de ICMS sobre combustível — os valores abaixo são só informativos."
            : "Segundo o que você confirmou, sua empresa não é elegível ao crédito (não presta serviço de transporte tributado por ICMS, ou é optante por crédito outorgado) — os valores abaixo são só informativos."}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {podeCreditar ? "Crédito apurável no mês" : "Valor identificado no mês (informativo)"}
          </p>
          <p className={`mt-1 text-2xl font-semibold ${podeCreditar ? "text-status-ativo" : "text-slate-400"}`}>
            {formatarMoeda(totalCredito)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notas com dado de crédito</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {notasComCredito.length} de {todasNotas.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notas sem grupo ICMS61</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{notasSemDado}</p>
          {notasSemDado > 0 && <BotaoReprocessarNotas empresaId={empresaSelecionada} />}
        </div>
      </div>

      {porUf.size > 1 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Por UF do posto emitente</h2>
          <p className="mb-3 text-xs text-slate-500">
            Atenção: agrupado pela UF do posto que vendeu o combustível, não pela UF onde a prestação de transporte começou
            (o critério fiscalmente correto — Convênio ICMS 26/2023). Trate como aproximação; a atribuição exata precisa
            cruzar com o CT-e/frete de cada viagem, fora do escopo desta 1ª entrega.
          </p>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {[...porUf.entries()].sort((a, b) => b[1] - a[1]).map(([uf, valor]) => (
                <tr key={uf}>
                  <td className="py-1.5 text-slate-600">{uf}</td>
                  <td className="py-1.5 text-right text-slate-900">{formatarMoeda(valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Notas fiscais do período</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Nº NF</th>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Valor da nota</th>
              <th className="px-4 py-3">CST</th>
              <th className="px-4 py-3">Crédito (vICMSMonoRet)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {todasNotas.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatarDataBr(n.data_emissao)}</td>
                <td className="px-4 py-3 text-slate-600">{n.numero_nf}</td>
                <td className="px-4 py-3 text-slate-600">{n.nome_emitente}</td>
                <td className="px-4 py-3 text-slate-600">{n.produto_descricao_anp ?? n.produto_nome_xml}</td>
                <td className="px-4 py-3 text-slate-600">{Number(n.quantidade).toLocaleString("pt-BR")} L</td>
                <td className="px-4 py-3 text-slate-600">{formatarMoeda(Number(n.valor_total))}</td>
                <td className="px-4 py-3 text-slate-600">{n.cst_icms ?? "—"}</td>
                <td className="px-4 py-3 font-medium">
                  {n.v_icms_mono_ret !== null ? (
                    <span className="text-status-ativo">{formatarMoeda(Number(n.v_icms_mono_ret))}</span>
                  ) : (
                    <span className="text-slate-400">sem dado</span>
                  )}
                </td>
              </tr>
            ))}
            {todasNotas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma NF-e de combustível vinculada neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Base legal: LC 192/2022 (tributação monofásica do ICMS sobre combustíveis) e Convênio ICMS 26/2023 (crédito do
        imposto retido quando o combustível é insumo de transporte tributado por ICMS). Os valores desta tela vêm direto do
        campo vICMSMonoRet de cada NF-e — não são recalculados por fórmula própria — mas dependem de regras que variam por
        estado e por regime; valide com seu contador antes de lançar no Livro de Apuração do ICMS.
      </p>
    </div>
  );
}
