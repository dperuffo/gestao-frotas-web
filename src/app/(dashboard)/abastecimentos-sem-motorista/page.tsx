import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { TabelaPendencias, type MotoristaOpcao, type PendenciaAbastecimento } from "./_components/TabelaPendencias";

// Fase Fila-Motorista-Abastecimento-Externo (16/09/2026, pedido do Daniel:
// nome completo + CPF do motorista é obrigatório em todo abastecimento —
// regra de negócio confirmada com o Daniel). A maioria dos pontos de entrada
// já bloqueia isso na origem (lançamento manual, importação XLSX, PróFrotas —
// ver Fase CPF-obrigatorio-fonte). Mas dois canais são integrações EXTERNAS
// que a FNI não controla — não dá pra simplesmente rejeitar a transação
// porque o provedor não manda motorista:
//   - Hub genérico de integrações (cartão de combustível — Ticket Log, Alelo,
//     Repom etc.) — /api/integracoes/abastecimentos
//   - ERP de automação de posto (o próprio posto lança em nome do cliente
//     que atendeu) — /api/integracoes/abastecimentos-fornecidos
// Decisão do Daniel: ACEITAR o registro mesmo sem motorista (rejeitar
// derrubaria o integrador, que não tem como corrigir isso na hora), mas
// deixá-lo nesta fila pra alguém completar manualmente depois. Ambos os
// canais caem na mesma tabela, `abastecimentos_externos` (ver comentário no
// topo de cada rota) — é a ÚNICA fonte desta fila:
//   - PróFrotas (profrotas_abastecimentos) já foi resolvida numa fase
//     anterior — a fonte agora garante motorista, então não entra aqui.
//   - O histórico antigo de profrotas_abastecimentos com sync_key "robo-..."
//     (robô de teste de negociação com postos, ver AbastecimentoForm.tsx) é
//     dado de teste, não abastecimento real de cliente — deixado de fora de
//     propósito pra esta fila mostrar só o que precisa de revisão humana de
//     verdade (confirmado por SQL: profrotas_abastecimentos não tem nenhuma
//     linha real de integração sem motorista fora desses dois casos).
//
// Mesma estrutura de autorização de /cadastros-pendentes: Server Component,
// sem client admin, RLS de abastecimentos_externos (tenant_all) já restringe
// cada usuário à própria empresa — o filtro por empresaSelecionada abaixo é
// só pra resolver QUAL empresa mostrar quando o usuário/admin enxerga mais
// de uma, não uma checagem de segurança adicional.
//
// Fase Paginacao-Filtros-SemMotorista (16/09/2026, pedido do Daniel: "a tela
// de abastecimentos sem motorista precisa de paginação de verdade e filtros
// de busca") — achado real: a tela buscava sempre os 200 mais recentes com
// .limit(), sem range/offset nem filtro nenhum — cliente com mais de 200
// pendências só via um pedaço fixo da fila, sem jeito de navegar pro resto
// nem de procurar um registro específico. Agora: paginação real via
// .range() (mesmo padrão Paginacao/calcularPaginacao/offsetDaPagina já
// usado em /veiculos e /abastecimentos) + filtros de placa, posto, provedor
// e intervalo de datas, tudo combinável via querystring.
const POR_PAGINA = 30;

// Valores reais encontrados na coluna `provedor` de abastecimentos_externos
// pra registros sem motorista (SQL: select distinct provedor from
// abastecimentos_externos where motorista_nome is null or motorista_cpf is
// null) — os dois canais de integração externa (hub de cartão de
// combustível e ERP de posto) só produziram estes 4 provedores até agora.
const PROVEDORES_OPCOES = ["Valecard", "TicketLog", "RedeFrota", "Veloe"];

export default async function AbastecimentosSemMotoristaPage({
  searchParams,
}: {
  searchParams: Promise<{
    empresa?: string;
    page?: string;
    placa?: string;
    posto?: string;
    provedor?: string;
    data_inicio?: string;
    data_fim?: string;
  }>;
}) {
  const {
    empresa: empresaParam,
    page: pageParam,
    placa,
    posto,
    provedor,
    data_inicio: dataInicio,
    data_fim: dataFim,
  } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let pendencias: PendenciaAbastecimento[] = [];
  let motoristas: MotoristaOpcao[] = [];
  let totalFiltrado = 0;
  let erro: string | null = null;

  const placaBusca = (placa ?? "").trim();
  const postoBusca = (posto ?? "").trim();

  // Builder genérico do supabase-js, reaproveitado pra contagem e pra
  // página — mesmo padrão de `comFiltros` em /abastecimentos/page.tsx.
  function comFiltros(builder: any) {
    let query = builder.eq("empresa_id", empresaSelecionada).or("motorista_nome.is.null,motorista_cpf.is.null");
    if (placaBusca) query = query.ilike("placa", `%${placaBusca}%`);
    if (postoBusca) query = query.ilike("posto_nome", `%${postoBusca}%`);
    if (provedor) query = query.eq("provedor", provedor);
    if (dataInicio) query = query.gte("data_abastecimento", dataInicio);
    if (dataFim) query = query.lte("data_abastecimento", `${dataFim}T23:59:59`);
    return query;
  }

  if (empresaSelecionada) {
    const offset = offsetDaPagina(POR_PAGINA, pageParam);

    const [{ count }, { data, error: erroPendencias }, { data: motoristasEmpresa, error: erroMotoristas }] =
      await Promise.all([
        comFiltros(supabase.from("abastecimentos_externos").select("id", { count: "exact", head: true })),
        comFiltros(
          supabase
            .from("abastecimentos_externos")
            .select("id, codigo_abastecimento, data_abastecimento, placa, posto_nome, provedor, quantidade, valor_total")
        )
          .order("data_abastecimento", { ascending: false })
          .range(offset, offset + POR_PAGINA - 1),
        supabase.from("motoristas").select("id, nome_completo, cpf").eq("empresa_id", empresaSelecionada).order("nome_completo"),
      ]);

    totalFiltrado = count ?? 0;
    if (erroPendencias) erro = erroPendencias.message;
    pendencias = data ?? [];
    if (erroMotoristas) erro = erro ?? erroMotoristas.message;
    motoristas = motoristasEmpresa ?? [];
  }

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalFiltrado, POR_PAGINA, pageParam);

  return (
    <div>
      <CabecalhoPagina
        titulo="Abastecimentos Sem Motorista"
        descricao={`Abastecimentos aceitos via integração (cartão de combustível ou ERP de posto) sem nome/CPF do motorista — complete pra sair da lista${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
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

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
          {empresas.length > 1 ? "Selecione um cliente acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar: {erro}</p>}

          {/* Fase Paginacao-Filtros-SemMotorista — mesmo cuidado de
              /veiculos e /abastecimentos: form SEPARADO do form do seletor
              de Cliente acima (cada <form> só envia os próprios campos ao
              submeter), por isso o ?empresa= vai como hidden pra não se
              perder ao filtrar. Mudar qualquer filtro reseta pra página 1
              (não manda ?page= no submit). */}
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="empresa" value={empresaParam ?? ""} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Placa</label>
              <input type="search" name="placa" defaultValue={placa ?? ""} placeholder="Placa..." className="input text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Posto</label>
              <input type="search" name="posto" defaultValue={posto ?? ""} placeholder="Nome do posto..." className="input text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Canal</label>
              <select name="provedor" defaultValue={provedor ?? ""} className="input text-sm">
                <option value="">Todos</option>
                {PROVEDORES_OPCOES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">De</label>
              <input type="date" name="data_inicio" defaultValue={dataInicio ?? ""} className="input text-sm" title="Data inicial" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Até</label>
              <input type="date" name="data_fim" defaultValue={dataFim ?? ""} className="input text-sm" title="Data final" />
            </div>
            <button type="submit" className="btn-secondary text-sm">
              Filtrar
            </button>
          </form>

          <TabelaPendencias pendenciasIniciais={pendencias} motoristas={motoristas} />

          <div className="px-4">
            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              totalRegistros={totalFiltrado}
              porPagina={POR_PAGINA}
              basePath="/abastecimentos-sem-motorista"
              paramsAtuais={{ empresa: empresaParam, placa, posto, provedor, data_inicio: dataInicio, data_fim: dataFim }}
            />
          </div>
        </>
      )}
    </div>
  );
}
