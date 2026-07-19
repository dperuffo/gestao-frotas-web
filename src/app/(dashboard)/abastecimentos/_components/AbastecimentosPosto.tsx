import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { mensagemMotivoPendencia } from "@/lib/nfe";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { LogoProvedor } from "@/components/LogoProvedor";

const POR_PAGINA = 30;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase 27.102 — pedido do Daniel: "Gostaria que fosse assim na visao do
// posto tambem, identificando no filtro a quantidade de rejeitados e nos
// registros de abastecimentos, o status de rejeitado com a descricao" —
// referindo-se ao filtro/badge de NF-e já existente em /notas-fiscais (Fase
// 27.99/27.100), que faltava aqui em "Abastecimentos Fornecidos" — a tela
// que o posto realmente usa no dia a dia (a outra é uma tela separada, só de
// NF-e). "Acho qu fica mais intuitivo para o usuario de posto para corrigir
// a NF": em vez de o posto precisar ir em /notas-fiscais pra descobrir o que
// foi rejeitado, ele já vê aqui, na mesma lista de abastecimentos que já usa.
const STATUS_NF_VALIDOS = new Set(["emitida", "rejeitada", "pendente"]);

// Fase 27.147 — mesmas cores/nomes já usados na visão do cliente
// (src/app/(dashboard)/abastecimentos/page.tsx), reaproveitados aqui pra
// mostrar o meio de pagamento também do lado do posto.
const CORES_PROVEDOR: Record<string, string> = {
  profrotas: "bg-blue-100 text-blue-700",
  Valecard: "bg-purple-100 text-purple-700",
  RedeFrota: "bg-orange-100 text-orange-700",
  TicketLog: "bg-teal-100 text-teal-700",
  Veloe: "bg-pink-100 text-pink-700",
};

function nomeProvedor(provedor: string) {
  return provedor === "profrotas" ? "PróFrotas" : provedor;
}

function BadgeProvedor({ provedor }: { provedor: string }) {
  const classe = CORES_PROVEDOR[provedor] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}>
      {nomeProvedor(provedor)}
    </span>
  );
}

type SearchParamsPosto = {
  combustivel?: string;
  cliente?: string;
  q?: string;
  de?: string;
  ate?: string;
  page?: string;
  ajuste?: string;
  nf?: string;
  provedor?: string;
};

type DetalhePendencia = {
  motivo: string;
  detalheTexto: string | null;
  nomeArquivo: string | null;
  cnpjEmitente: string | null;
  produtoNomeXml: string | null;
  quantidade: number | null;
  valorTotal: number | null;
};

// Fase 27.58 — visão do posto na mesma tela /abastecimentos: o que ele
// FORNECEU (não o que consumiu — isso é o lado cliente, acima em
// AbastecimentosPage). Sem seletor de EMPRESA aqui — o posto já é sempre
// uma única empresa (não tem grupo econômico como Frota) — mas o posto
// atende VÁRIOS clientes e recebe por VÁRIOS meios de pagamento, daí os
// filtros de "cliente" e "provedor" abaixo.
//
// Fase 27.65 — Daniel pediu filtro de cliente, data inicial, data final e
// campo livre pra pesquisa, mesmo padrão já usado em /abastecimentos (lado
// Frota, Fase 27.8/27.31).
//
// Fase 27.147 — achado real (Daniel, com print de "Abastecimentos
// Fornecidos" mostrando só linhas PróFrotas): esta tela lia só
// profrotas_abastecimentos (filtrando por pv_cnpj) — abastecimentos
// fornecidos por este posto através de outros meios de pagamento
// (Valecard/RedeFrota/TicketLog/Veloe, tabela abastecimentos_externos)
// simplesmente não apareciam aqui, mesmo já aparecendo do lado do cliente
// (view abastecimentos_unificado, Fase 27.133/27.135). Trocada a fonte pra
// abastecimentos_unificado filtrando por posto_cnpj=meuCnpj (RLS já libera:
// abastecimentos_externos_select_posto compara o CNPJ normalizado) — agora
// cobre os dois lados, com coluna/badge de meio de pagamento e filtro por
// provedor, igual ao lado cliente.
export async function AbastecimentosPosto({
  empresaPostoId,
  nomeEmpresaSelecionada,
  searchParams,
}: {
  empresaPostoId: string;
  nomeEmpresaSelecionada?: string;
  searchParams: SearchParamsPosto;
}) {
  const supabase = await createClient();
  const { combustivel, cliente, q, de, ate, page, ajuste, nf: nfParam, provedor } = searchParams;
  const nf = nfParam && STATUS_NF_VALIDOS.has(nfParam) ? nfParam : null;

  const { data: empresa } = await supabase.from("empresas").select("cnpj").eq("id", empresaPostoId).maybeSingle();
  const meuCnpj = empresa?.cnpj;

  // Fase 27.147 — achado real ao investigar o gap de abastecimentos_externos
  // (ver comentário grande acima): `empresas.cnpj` é sempre gravado sem
  // pontuação, mas `abastecimentos_externos.posto_cnpj` (texto livre — cada
  // provedor manda como quiser) tem linhas com o MESMO CNPJ em formatos
  // diferentes ("22333444000155" e "22.333.444/0001-55"). Um `.eq()` simples
  // deixaria de fora a variante formatada. Sem poder aplicar
  // regexp_replace num filtro do PostgREST, comparamos contra as duas
  // variantes mais prováveis (crua e com máscara padrão de CNPJ).
  function mascararCnpj(cnpjLimpo: string): string | null {
    const digitos = cnpjLimpo.replace(/\D/g, "");
    if (digitos.length !== 14) return null;
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
  }
  const meuCnpjMascarado = meuCnpj ? mascararCnpj(meuCnpj) : null;
  const variantesCnpj = meuCnpj ? (meuCnpjMascarado ? [meuCnpj, meuCnpjMascarado] : [meuCnpj]) : [];

  // Fase 27.147 — `id` é texto (view abastecimentos_unificado — bigint de
  // sequências independentes por tabela-fonte, unificar como texto evita
  // colidir "id 31 do PróFrotas" com "id 31 da Valecard").
  // Fase 27.152 — `codigo_abastecimento` agora existe dos dois lados: "1..."
  // pra PróFrotas, "2..." pra abastecimentos integrados via API/planilha.
  type Registro = {
    id: string;
    provedor: string;
    codigo_abastecimento: string | null;
    data_abastecimento: string | null;
    empresa_id: string | null;
    placa: string | null;
    motorista_nome: string | null;
    produto: string | null;
    litros: number | null;
    valor_total: number | null;
  };

  let registros: Registro[] = [];
  let erro: string | undefined;
  let clientesOpcoes: { id: string; nome: string }[] = [];
  let provedoresOpcoes: string[] = [];
  let totalRegistros = 0;
  let volumeTotal = 0;
  let receitaTotal = 0;
  let idsComAjusteAbertoProfrotas = new Set<number>();
  let idsComAjusteAbertoExterno = new Set<number>();
  let notaPorAbastecimentoProfrotas = new Map<number, number | null>();
  let notaPorAbastecimentoExterno = new Map<number, number | null>();
  let pendenciaPorAbastecimentoProfrotas = new Map<number, DetalhePendencia>();
  let pendenciaPorAbastecimentoExterno = new Map<number, DetalhePendencia>();
  let contagemNf = { todos: 0, emitida: 0, rejeitada: 0, pendente: 0 };

  const offset = offsetDaPagina(POR_PAGINA, page);

  if (meuCnpj) {
    // Clientes que já abasteceram neste posto (qualquer meio de pagamento) —
    // pro seletor de filtro. A view não expõe nome do cliente, só empresa_id
    // — busca à parte em `empresas` pra resolver o nome de exibição.
    const [{ data: clientesData }, { data: provedoresData }] = await Promise.all([
      supabase.from("abastecimentos_unificado").select("empresa_id").in("posto_cnpj", variantesCnpj).limit(20000),
      supabase.from("abastecimentos_unificado").select("provedor").in("posto_cnpj", variantesCnpj).limit(20000),
    ]);
    const idsClientes = Array.from(
      new Set((clientesData ?? []).map((c) => c.empresa_id).filter((id): id is string => !!id))
    );
    // Achado real (Fase FLT-2) — igual ao já documentado em
    // exigirDocumentacaoAprovada (empresasDocumentos.ts): um SELECT direto
    // em `empresas` só é liberado pela RLS `empresas_select_membro` pra
    // quem é membro da empresa (ou admin/superusuário) — o posto NUNCA é
    // membro das empresas-clientes, então esta busca vinha vazia pra contas
    // reais, e a linha do abastecimento mostrava "—" no lugar do nome do
    // cliente (só não aparecia com a conta superusuária, que ignora RLS).
    // Corrigido chamando a RPC SECURITY DEFINER `nomes_empresas_publico`
    // (mesmo padrão de `nome_empresa_publico`, agora em lote).
    if (idsClientes.length > 0) {
      const { data: empresasData } = await supabase.rpc("nomes_empresas_publico", { p_empresa_ids: idsClientes });
      clientesOpcoes = (empresasData ?? [])
        .map((e) => ({ id: e.id, nome: e.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    provedoresOpcoes = Array.from(
      new Set((provedoresData ?? []).map((p) => p.provedor).filter((p): p is string => !!p))
    ).sort((a, b) => nomeProvedor(a).localeCompare(nomeProvedor(b)));

    // Fase 27.147 — a view não tem nome do cliente pra casar com o campo de
    // busca livre; resolve quais dos clientesOpcoes (já resolvidos acima,
    // sem depender de RLS cruzada) batem pelo nome e inclui o(s)
    // empresa_id(s) encontrados no filtro OR abaixo. Antes buscava direto em
    // `empresas` por `ilike` — mesmo bug de RLS cruzada do bloco acima.
    let idsClientesQ: string[] = [];
    if (q) {
      const termo = q.toLowerCase();
      idsClientesQ = clientesOpcoes.filter((c) => c.nome.toLowerCase().includes(termo)).map((c) => c.id);
    }

    // Fase 27.68 — Daniel pediu um filtro pra ver só os abastecimentos com
    // ajuste pendente ("melhor visualização"). Aproveitada a mesma consulta
    // pra também pintar a bolinha vermelha na linha (Fase 27.67).
    // Fase 27.147 — agora 2 conjuntos (PróFrotas/externo), mesmo motivo já
    // documentado no lado cliente (Fase 27.142): o `id` da view só é único
    // DENTRO de cada provedor.
    const { data: ajustesAbertosTodos } = await supabase
      .from("ajustes_abastecimentos")
      .select("abastecimento_id, abastecimento_externo_id")
      .eq("empresa_posto_id", empresaPostoId)
      .in("status", ["pendente_cliente", "pendente_posto"]);
    for (const a of ajustesAbertosTodos ?? []) {
      if (a.abastecimento_id != null) idsComAjusteAbertoProfrotas.add(a.abastecimento_id);
      if (a.abastecimento_externo_id != null) idsComAjusteAbertoExterno.add(a.abastecimento_externo_id);
    }

    // Fase 27.102 — mesma ideia da bolinha de ajuste acima: consultas com
    // TODOS os registros de NF-e/pendência deste posto (tabelas já têm RLS
    // própria escopando por empresa_posto_id — Fases 27.94/27.99), viradas em
    // mapas abastecimento_id/abastecimento_externo_id -> status, reaproveitadas
    // tanto pra pintar o badge de cada linha quanto pra montar os filtros por
    // status abaixo. Pendência só "vale" se ainda não tem NF-e emitida pro
    // mesmo abastecimento.
    // Fase 27.147 — antes filtrava só abastecimento_id (lado PróFrotas); agora
    // traz os dois lados (sem o .not(...) que descartava as linhas externas).
    const [{ data: notasData }, { data: pendenciasData }] = await Promise.all([
      supabase
        .from("notas_fiscais_abastecimento")
        .select("abastecimento_id, abastecimento_externo_id, numero_nf")
        .eq("empresa_posto_id", empresaPostoId)
        .limit(20000),
      supabase
        .from("notas_fiscais_pendencias")
        .select(
          "abastecimento_id, abastecimento_externo_id, motivo, detalhe_texto, criado_em, nome_arquivo, cnpj_emitente, produto_nome_xml, quantidade, valor_total"
        )
        .eq("empresa_posto_id", empresaPostoId)
        .order("criado_em", { ascending: false })
        .limit(20000),
    ]);

    for (const n of notasData ?? []) {
      if (n.abastecimento_id != null && !notaPorAbastecimentoProfrotas.has(n.abastecimento_id)) {
        notaPorAbastecimentoProfrotas.set(n.abastecimento_id, n.numero_nf);
      }
      if (n.abastecimento_externo_id != null && !notaPorAbastecimentoExterno.has(n.abastecimento_externo_id)) {
        notaPorAbastecimentoExterno.set(n.abastecimento_externo_id, n.numero_nf);
      }
    }
    for (const p of pendenciasData ?? []) {
      // Fase 27.103 — pedido do Daniel: mesmos dados extraídos do XML
      // (arquivo, CNPJ, produto, quantidade, valor) direto na linha do
      // abastecimento rejeitado, não só o motivo.
      const detalhe: DetalhePendencia = {
        motivo: p.motivo,
        detalheTexto: p.detalhe_texto,
        nomeArquivo: p.nome_arquivo,
        cnpjEmitente: p.cnpj_emitente,
        produtoNomeXml: p.produto_nome_xml,
        quantidade: p.quantidade,
        valorTotal: p.valor_total,
      };
      if (p.abastecimento_id != null && !pendenciaPorAbastecimentoProfrotas.has(p.abastecimento_id)) {
        pendenciaPorAbastecimentoProfrotas.set(p.abastecimento_id, detalhe);
      }
      if (p.abastecimento_externo_id != null && !pendenciaPorAbastecimentoExterno.has(p.abastecimento_externo_id)) {
        pendenciaPorAbastecimentoExterno.set(p.abastecimento_externo_id, detalhe);
      }
    }

    const idsEmitidaProfrotas = Array.from(notaPorAbastecimentoProfrotas.keys());
    const idsEmitidaExterno = Array.from(notaPorAbastecimentoExterno.keys());
    const idsRejeitadaProfrotas = Array.from(pendenciaPorAbastecimentoProfrotas.keys()).filter(
      (id) => !notaPorAbastecimentoProfrotas.has(id)
    );
    const idsRejeitadaExterno = Array.from(pendenciaPorAbastecimentoExterno.keys()).filter(
      (id) => !notaPorAbastecimentoExterno.has(id)
    );
    const idsSemTentativaProfrotas = [...idsEmitidaProfrotas, ...idsRejeitadaProfrotas];
    const idsSemTentativaExterno = [...idsEmitidaExterno, ...idsRejeitadaExterno];

    // Fase 27.147 — filtro por "id dentro do provedor certo" (evita colisão
    // entre um id PróFrotas e um id externo que coincidam por acaso), mesmo
    // padrão já usado no filtro de ajuste pendente da visão cliente (Fase
    // 27.142).
    function orIdsPorProvedor(idsProfrotas: number[], idsExterno: number[]) {
      const p = idsProfrotas.length > 0 ? idsProfrotas.join(",") : "-1";
      const e = idsExterno.length > 0 ? idsExterno.join(",") : "-1";
      return `and(provedor.eq.profrotas,id.in.(${p})),and(provedor.neq.profrotas,id.in.(${e}))`;
    }

    // "Pendente" é o complemento (nenhuma tentativa de NF-e ainda) — só dá
    // pra expressar como exclusão, por isso o id.not.in por provedor.
    function orPendentePorProvedor() {
      const p =
        idsSemTentativaProfrotas.length > 0
          ? `and(provedor.eq.profrotas,id.not.in.(${idsSemTentativaProfrotas.join(",")}))`
          : `provedor.eq.profrotas`;
      const e =
        idsSemTentativaExterno.length > 0
          ? `and(provedor.neq.profrotas,id.not.in.(${idsSemTentativaExterno.join(",")}))`
          : `provedor.neq.profrotas`;
      return `${p},${e}`;
    }

    function aplicarFiltrosBase<
      T extends {
        eq: (...args: [string, string]) => T;
        or: (arg: string) => T;
        gte: (...args: [string, string]) => T;
        lte: (...args: [string, string]) => T;
        in: (coluna: string, valores: string[]) => T;
      },
    >(builder: T): T {
      let query = builder.in("posto_cnpj", variantesCnpj);
      if (combustivel && (PRODUTOS_POSTO as readonly string[]).includes(combustivel)) {
        query = query.eq("produto", combustivel);
      }
      if (cliente) query = query.eq("empresa_id", cliente);
      // Fase 27.147 — filtro por meio de pagamento.
      if (provedor) query = query.eq("provedor", provedor);
      // Fase 27.104 — pedido do Daniel: "tela de abastecimentos, no filtro
      // livre, poder consultar pelo ID abastecimento, em todas as visões" —
      // o mesmo campo de busca livre também casa com o código de 10
      // dígitos (coluna gerada codigo_abastecimento) e, agora, com o nome
      // do cliente (resolvido em idsClientesQ acima).
      if (q) {
        const clausulas = [`placa.ilike.%${q}%`, `motorista_nome.ilike.%${q}%`, `codigo_abastecimento.ilike.%${q}%`];
        if (idsClientesQ.length > 0) clausulas.push(`empresa_id.in.(${idsClientesQ.join(",")})`);
        query = query.or(clausulas.join(","));
      }
      if (de) query = query.gte("data_abastecimento", de);
      if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
      if (ajuste === "pendente") {
        query = query.or(orIdsPorProvedor(Array.from(idsComAjusteAbertoProfrotas), Array.from(idsComAjusteAbertoExterno)));
      }
      return query;
    }

    // Fase 27.102 — aplica o filtro de status de NF-e por cima dos filtros
    // já existentes (combustível/cliente/provedor/busca/data/ajuste),
    // reaproveitando os mesmos "ids extras" já usados pro filtro de ajuste
    // pendente.
    function aplicarFiltrosComNf<
      T extends {
        eq: (...args: [string, string]) => T;
        or: (arg: string) => T;
        gte: (...args: [string, string]) => T;
        lte: (...args: [string, string]) => T;
        in: (coluna: string, valores: string[]) => T;
      },
    >(builder: T): T {
      let query = aplicarFiltrosBase(builder);
      if (nf === "emitida") query = query.or(orIdsPorProvedor(idsEmitidaProfrotas, idsEmitidaExterno));
      else if (nf === "rejeitada") query = query.or(orIdsPorProvedor(idsRejeitadaProfrotas, idsRejeitadaExterno));
      else if (nf === "pendente") query = query.or(orPendentePorProvedor());
      return query;
    }

    const [
      { count },
      { data: agregadosRaw },
      resultadoPagina,
      { count: countTodos },
      { count: countEmitida },
      { count: countRejeitada },
      { count: countPendente },
    ] = await Promise.all([
      aplicarFiltrosComNf(supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })),
      aplicarFiltrosComNf(supabase.from("abastecimentos_unificado").select("litros, valor_total")).limit(50000),
      aplicarFiltrosComNf(
        supabase
          .from("abastecimentos_unificado")
          .select(
            "id, provedor, codigo_abastecimento, data_abastecimento, empresa_id, placa, motorista_nome, produto, litros, valor_total"
          )
      )
        .order("data_abastecimento", { ascending: false })
        .range(offset, offset + POR_PAGINA - 1),
      // Fase 27.102 — contagens dos filtros de status SEMPRE com os filtros
      // base (sem o próprio filtro de nf), pra os números não sumirem/mudarem
      // quando o posto clica de um filtro de status pro outro.
      aplicarFiltrosBase(supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })),
      aplicarFiltrosBase(supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })).or(
        orIdsPorProvedor(idsEmitidaProfrotas, idsEmitidaExterno)
      ),
      aplicarFiltrosBase(supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })).or(
        orIdsPorProvedor(idsRejeitadaProfrotas, idsRejeitadaExterno)
      ),
      aplicarFiltrosBase(supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })).or(
        orPendentePorProvedor()
      ),
    ]);

    if (resultadoPagina.error) erro = resultadoPagina.error.message;
    registros = (resultadoPagina.data ?? []) as Registro[];
    totalRegistros = count ?? 0;
    contagemNf = {
      todos: countTodos ?? 0,
      emitida: countEmitida ?? 0,
      rejeitada: countRejeitada ?? 0,
      pendente: countPendente ?? 0,
    };

    const agregados = (agregadosRaw ?? []) as { litros: number | null; valor_total: number | null }[];
    volumeTotal = agregados.reduce((soma, r) => soma + (r.litros ?? 0), 0);
    receitaTotal = agregados.reduce((soma, r) => soma + (r.valor_total ?? 0), 0);
  }

  const nomesClientes = clientesOpcoes.length > 0 ? new Map(clientesOpcoes.map((c) => [c.id, c.nome])) : new Map<string, string>();

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, page);
  const precoMedio = volumeTotal > 0 ? receitaTotal / volumeTotal : 0;

  // Fase 27.131 — achado real (Daniel: "ao clicar em qualquer um, volta para
  // a seleção de cliente"): esta função montava a URL sem o parâmetro
  // "empresa" — quando quem está vendo é admin (ou qualquer usuário com mais
  // de uma empresa), clicar em QUALQUER filtro derrubava a empresa
  // selecionada e o /abastecimentos/page.tsx pai voltava pra tela de
  // "selecione uma empresa" (semClienteEscolhido). Mesma causa raiz já
  // corrigida em outras telas (Fase 27.31/27.111/27.123) — sempre carregar
  // o "empresa" atual em qualquer link/form que fica na mesma página.
  function linkFiltro(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const base = { empresa: empresaPostoId, cliente, q, de, ate, ajuste, nf: nf ?? undefined, provedor, ...extra };
    for (const [chave, valor] of Object.entries(base)) {
      if (valor) sp.set(chave, valor);
    }
    const qs = sp.toString();
    return qs ? `/abastecimentos?${qs}` : "/abastecimentos";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimentos Fornecidos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Combustível que você forneceu aos seus clientes{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Abastecimentos" valor={totalRegistros.toLocaleString("pt-BR")} />
        <Indicador label="Volume total" valor={`${volumeTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Indicador label="Receita total" valor={formatarMoeda(receitaTotal)} />
        <Indicador label="Preço médio/L" valor={formatarMoeda(precoMedio)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={linkFiltro({ combustivel: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!combustivel ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todos
        </Link>
        {PRODUTOS_POSTO.map((p) => (
          <Link
            key={p}
            href={linkFiltro({ combustivel: p })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${combustivel === p ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {p}
          </Link>
        ))}
        {/* Fase 27.68 — filtro pra ver só quem tem ajuste pendente, pra não
            precisar abrir registro por registro procurando a bolinha vermelha. */}
        <Link
          href={linkFiltro({ ajuste: ajuste === "pendente" ? undefined : "pendente" })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${ajuste === "pendente" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          🔴 Pendente de ajuste
        </Link>
      </div>

      {/* Fase 27.147 — pedido do Daniel: filtro por meio de pagamento,
          mesmo padrão visual dos demais filtros de pill desta tela.
          Fase Provedores-Logos — cada opção agora é só a logo do provedor
          (mesmo tratamento do lado cliente, ver abastecimentos/page.tsx). */}
      {provedoresOpcoes.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-500">Meio de pagamento:</span>
          <Link
            href={linkFiltro({ provedor: undefined })}
            className={`rounded-full px-3 py-1 font-medium ${!provedor ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Todos
          </Link>
          {provedoresOpcoes.map((p) => (
            <Link
              key={p}
              href={linkFiltro({ provedor: p })}
              title={nomeProvedor(p)}
              className={`flex items-center rounded-lg border-2 px-2 py-1 ${
                provedor === p ? "border-frota-600 bg-white" : "border-transparent bg-slate-100 opacity-60 hover:opacity-100"
              }`}
            >
              <LogoProvedor provedor={p} className="h-4 w-auto" />
            </Link>
          ))}
        </div>
      )}

      {/* Fase 27.102 — pedido do Daniel: mesmo filtro por status de NF-e já
          existente em /notas-fiscais, agora também aqui, onde o posto
          realmente acompanha o dia a dia. Cor por categoria igual ao badge
          da própria linha da tabela (verde/vermelho/âmbar), pra reconhecer
          de relance. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-500">NF-e:</span>
        <Link
          href={linkFiltro({ nf: undefined })}
          className={`rounded-full px-3 py-1 font-medium ${!nf ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todas ({contagemNf.todos})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "emitida" ? undefined : "emitida" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "emitida" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Emitida ({contagemNf.emitida})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "rejeitada" ? undefined : "rejeitada" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "rejeitada" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Rejeitada ({contagemNf.rejeitada})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "pendente" ? undefined : "pendente" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "pendente" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Pendente ({contagemNf.pendente})
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="empresa" value={empresaPostoId} />
        <input type="hidden" name="combustivel" value={combustivel ?? ""} />
        <input type="hidden" name="ajuste" value={ajuste ?? ""} />
        <input type="hidden" name="nf" value={nf ?? ""} />
        <input type="hidden" name="provedor" value={provedor ?? ""} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
          <select name="cliente" defaultValue={cliente ?? ""} className="input text-sm">
            <option value="">Todos os clientes</option>
            {clientesOpcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por ID, placa, motorista ou cliente..."
          className="input max-w-sm"
        />
        <input type="date" name="de" defaultValue={de ?? ""} className="input" title="Data inicial" />
        <input type="date" name="ate" defaultValue={ate ?? ""} className="input" title="Data final" />
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar abastecimentos: {erro}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Meio de pagamento</th>
              <th className="px-4 py-3">NF-e</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map((r) => {
              const ehProfrotas = r.provedor === "profrotas";
              const idNum = Number(r.id);
              const numeroNf = ehProfrotas ? notaPorAbastecimentoProfrotas.get(idNum) : notaPorAbastecimentoExterno.get(idNum);
              const pendencia = ehProfrotas
                ? pendenciaPorAbastecimentoProfrotas.get(idNum)
                : pendenciaPorAbastecimentoExterno.get(idNum);
              const temAjustePendente = ehProfrotas
                ? idsComAjusteAbertoProfrotas.has(idNum)
                : idsComAjusteAbertoExterno.has(idNum);
              return (
                <tr key={`${r.provedor}-${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                    {r.codigo_abastecimento ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {/* Fase 27.147 — linhas de outros provedores também têm
                        página de detalhe/ajuste (ver /abastecimentos/externo/[id],
                        Fase 27.142). `r.id` já é o id real da tabela-fonte (a
                        view abastecimentos_unificado não gera id sintético). */}
                    <Link
                      href={ehProfrotas ? `/abastecimentos/${r.id}` : `/abastecimentos/externo/${r.id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-frota-600 hover:underline"
                    >
                      {temAjustePendente && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          title="Ajuste pendente neste abastecimento"
                        />
                      )}
                      {r.data_abastecimento ? formatDate(r.data_abastecimento) : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(r.empresa_id ? nomesClientes.get(r.empresa_id) : null) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.produto ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.litros ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.valor_total != null ? formatarMoeda(r.valor_total) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeProvedor provedor={r.provedor} />
                  </td>
                  <td className="px-4 py-3">
                    {numeroNf !== undefined ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Emitida{numeroNf ? ` · Nº ${numeroNf}` : ""}
                      </span>
                    ) : pendencia ? (
                      <div>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejeitada</span>
                        <p className="mt-1 max-w-xs text-xs text-red-600">
                          {pendencia.motivo === "erro_leitura_xml" && pendencia.detalheTexto
                            ? pendencia.detalheTexto
                            : mensagemMotivoPendencia(pendencia.motivo)}
                        </p>
                        {/* Fase 27.103 — pedido do Daniel: mesmos dados
                            extraídos do XML já mostrados em
                            /notas-fiscais, agora também aqui. */}
                        {(pendencia.nomeArquivo || pendencia.cnpjEmitente || pendencia.produtoNomeXml) && (
                          <p className="mt-1 max-w-xs text-xs text-slate-500">
                            {pendencia.nomeArquivo ? `Arquivo: ${pendencia.nomeArquivo}` : ""}
                            {pendencia.cnpjEmitente ? `${pendencia.nomeArquivo ? " · " : ""}CNPJ emitente ${pendencia.cnpjEmitente}` : ""}
                            {pendencia.produtoNomeXml ? `, ${pendencia.produtoNomeXml}` : ""}
                            {pendencia.quantidade !== null ? `, ${pendencia.quantidade} L` : ""}
                            {pendencia.valorTotal !== null ? `, ${formatarMoeda(pendencia.valorTotal)}` : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pendente</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {registros.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento fornecido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4">
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            porPagina={POR_PAGINA}
            basePath="/abastecimentos"
            paramsAtuais={{ empresa: empresaPostoId, combustivel, cliente, q, de, ate, ajuste, nf: nf ?? undefined, provedor }}
          />
        </div>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
