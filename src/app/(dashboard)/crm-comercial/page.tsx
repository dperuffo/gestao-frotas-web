import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda, formatarData, formatarCnpjCpf, STATUS_PROPOSTA_LABEL } from "@/lib/crm";
import { AbasPainel, type Aba } from "../inteligencia-rede/_components/AbasPainel";

type SearchParams = { empresa?: string; q?: string };

type ClienteLinha = { id: string; razao_social: string; cnpj_cpf: string; telefone: string | null; email: string | null };
type CotacaoLinha = {
  id: string;
  origem_label: string;
  destino_label: string;
  valor_total: number;
  status: string;
  criado_em: string;
  cliente_tomador_id: string | null;
};

// Fase Grupo 2 (Rodopar/Datapar, item 5) — CRM Comercial: fecha o gap
// "funil de propostas e histórico de relacionamento" sem duplicar o que já
// existe (cadastros_parceiros papel='tomador' = carteira de clientes,
// cotacoes = propostas). Duas abas: Carteira de Clientes e Funil de
// Propostas (kanban por status, agrupando as cotações que já são geradas em
// /cotacoes).
export default async function CrmComercialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let clientes: ClienteLinha[] = [];
  let cotacoes: CotacaoLinha[] = [];

  if (empresaSelecionada) {
    const [{ data: clientesData }, { data: cotacoesData }] = await Promise.all([
      supabase
        .from("cadastros_parceiros")
        .select("id, razao_social, cnpj_cpf, telefone, email")
        .eq("empresa_id", empresaSelecionada)
        .eq("papel", "tomador")
        .order("razao_social"),
      supabase
        .from("cotacoes")
        .select("id, origem_label, destino_label, valor_total, status, criado_em, cliente_tomador_id")
        .eq("empresa_id", empresaSelecionada)
        .order("criado_em", { ascending: false })
        .limit(200),
    ]);
    clientes = clientesData ?? [];
    cotacoes = cotacoesData ?? [];
  }

  const termoBusca = (q ?? "").trim().toLowerCase();
  const clientesFiltrados = termoBusca
    ? clientes.filter(
        (c) => c.razao_social.toLowerCase().includes(termoBusca) || c.cnpj_cpf.includes(termoBusca.replace(/\D/g, ""))
      )
    : clientes;

  const nomeCliente = (id: string | null) => (id ? (clientes.find((c) => c.id === id)?.razao_social ?? "Cliente não identificado") : "— sem cliente vinculado —");
  const contarPropostas = (clienteId: string) => cotacoes.filter((c) => c.cliente_tomador_id === clienteId).length;

  const colunas: { status: string; itens: CotacaoLinha[] }[] = [
    { status: "simulada", itens: cotacoes.filter((c) => c.status === "simulada") },
    { status: "convertida", itens: cotacoes.filter((c) => c.status === "convertida") },
    { status: "descartada", itens: cotacoes.filter((c) => c.status === "descartada") },
  ];

  const conteudoCarteira = (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Clientes-tomadores cadastrados{nomeEmpresaSelecionada ? ` para ${nomeEmpresaSelecionada}` : ""}. Também usados nas{" "}
          <Link href="/cotacoes" className="text-frota-600 hover:underline">
            Cotações
          </Link>{" "}
          e na emissão de CT-e.
        </p>
        {empresaSelecionada && (
          <Link href={`/crm-comercial/clientes/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Novo cliente
          </Link>
        )}
      </div>

      {empresaSelecionada && clientes.length > 0 && (
        <form className="mb-4">
          <input type="hidden" name="empresa" value={empresaSelecionada} />
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Buscar por nome ou CNPJ/CPF..." className="input max-w-sm" />
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver a carteira de clientes.</p>
      ) : clientes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhum cliente cadastrado ainda. Clique em &quot;+ Novo cliente&quot; pra começar.
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhum cliente encontrado para &quot;{q}&quot;.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((c) => (
            <Link
              key={c.id}
              href={`/crm-comercial/clientes/${c.id}?empresa=${empresaSelecionada}`}
              className="card flex flex-col gap-2 p-5 hover:border-frota-300"
            >
              <h3 className="font-semibold text-slate-900">{c.razao_social}</h3>
              <p className="text-xs text-slate-500">{formatarCnpjCpf(c.cnpj_cpf)}</p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{c.telefone ?? c.email ?? "sem contato"}</span>
                <span className="font-medium text-frota-600">{contarPropostas(c.id)} proposta(s)</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const conteudoFunil = (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Propostas geradas em{" "}
        <Link href="/cotacoes" className="text-frota-600 hover:underline">
          Cotações
        </Link>
        , organizadas por status.
      </p>
      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver o funil.</p>
      ) : cotacoes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhuma proposta ainda. Simule uma em{" "}
          <Link href={`/cotacoes/novo?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
            Cotações
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {colunas.map((coluna) => (
            <div key={coluna.status} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{STATUS_PROPOSTA_LABEL[coluna.status]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{coluna.itens.length}</span>
              </div>
              <div className="space-y-2">
                {coluna.itens.length === 0 && <p className="text-xs text-slate-400">Nenhuma proposta.</p>}
                {coluna.itens.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cotacoes/${c.id}?empresa=${empresaSelecionada}`}
                    className="block rounded-md border border-slate-200 bg-white p-3 text-xs hover:border-frota-300"
                  >
                    <p className="font-medium text-slate-800">
                      {c.origem_label} → {c.destino_label}
                    </p>
                    <p className="mt-1 text-slate-500">{nomeCliente(c.cliente_tomador_id)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{formatarMoeda(c.valor_total)}</span>
                      <span className="text-slate-400">{formatarData(c.criado_em)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const abas: Aba[] = [
    { id: "carteira", label: "🤝 Carteira de Clientes", conteudo: conteudoCarteira },
    { id: "funil", label: "📊 Funil de Propostas", conteudo: conteudoFunil },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">CRM Comercial</h1>
        </div>
        {empresas.length > 1 && (
          <form className="flex items-end gap-2">
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary text-sm">
              Filtrar
            </button>
          </form>
        )}
      </div>
      <AbasPainel abas={abas} />
    </div>
  );
}
