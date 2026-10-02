import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { FORMAS_PAGAMENTO_PDV, type FormaPagamentoPdv } from "@/lib/formasPagamentoPdv";
import { ListaFormasPagamentoPdv } from "./_components/ListaFormasPagamentoPdv";

type SearchParams = { empresa?: string };

// Fase 4 PDV (02/10/2026, pré-requisito pro piloto — ver
// Arquitetura_Solucao_PDV.docx) — tela do CLIENTE (segmento "Frota") pra
// escolher quais meios de pagamento o canal PDV aceita cobrar do motorista
// na hora do abastecimento (tabela pdv_formas_pagamento_permitidas, Fase 1
// — já vem com pix/cartao_credito/cartao_debito/dinheiro ativos por
// padrão pra todo cliente). O app pdv-fni consulta essa tabela via
// listar_formas_pagamento_permitidas_pdv ao concluir um abastecimento —
// sem nenhuma forma ativa aqui, o frentista fica sem opção de pagamento.
export default async function PdvFormasPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas: todasEmpresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );

  // Só empresas segmento "Frota" usam essa tabela (é o cliente quem define
  // o que aceita cobrar do motorista; uma Revenda/posto não tem o que
  // configurar aqui — mesmo raciocínio de "souPosto" em negociacoes/page.tsx,
  // só que aqui a tela inteira não se aplica ao lado posto).
  let empresas = todasEmpresas;
  if (todasEmpresas.length > 0) {
    const { data: comSegmento } = await supabase
      .from("empresas")
      .select("id, segmento")
      .in(
        "id",
        todasEmpresas.map((e) => e.id)
      );
    const idsFrota = new Set((comSegmento ?? []).filter((e) => e.segmento === "Frota").map((e) => e.id));
    empresas = todasEmpresas.filter((e) => idsFrota.has(e.id));
  }

  const empresaValida = empresas.some((e) => e.id === empresaSelecionada) ? empresaSelecionada : null;
  const semClienteEscolhido = empresas.length > 1 && !empresaValida;

  let ativasIniciais: Partial<Record<FormaPagamentoPdv, boolean>> = {};
  if (empresaValida) {
    const { data } = await supabase
      .from("pdv_formas_pagamento_permitidas")
      .select("forma_pagamento, ativo")
      .eq("empresa_id", empresaValida);
    ativasIniciais = Object.fromEntries(
      FORMAS_PAGAMENTO_PDV.map((f) => [f, (data ?? []).find((d) => d.forma_pagamento === f)?.ativo === true])
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Formas de Pagamento no PDV"
        descricao={`Meios de pagamento que o frentista pode oferecer ao motorista ao concluir um abastecimento via PDV${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
            <select name="empresa" defaultValue={empresaValida ?? ""} className="input text-sm">
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

      {empresas.length === 0 ? (
        <p className="card p-6 text-sm text-slate-500 dark:text-slate-400">
          Essa configuração só se aplica a clientes (segmento Frota) — nenhuma das suas empresas vinculadas se
          encaixa aqui.
        </p>
      ) : semClienteEscolhido || !empresaValida ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Selecione um cliente acima para configurar.</p>
      ) : (
        <ListaFormasPagamentoPdv empresaId={empresaValida} ativasIniciais={ativasIniciais} />
      )}
    </div>
  );
}
