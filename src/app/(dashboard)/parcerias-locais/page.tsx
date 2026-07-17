import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { LABEL_CATEGORIA_FIDELIDADE } from "@/lib/fidelidadeCategorias";
import { CardVoucher } from "./_components/CardVoucher";
import { ToggleAtivoItemParceria } from "./_components/ToggleAtivoItemParceria";
import { ExcluirItemParceria } from "./_components/ExcluirItemParceria";
import { AtualizarStatusResgateProprio } from "./_components/AtualizarStatusResgateProprio";
import { QueimarVoucherForm } from "./_components/QueimarVoucherForm";

// Parcerias Locais (Fase 17/07) — tela self-service, acessível tanto pro
// perfil posto quanto cliente (ver menuOperacao/menuPostoOperacao em
// layout.tsx): cada um cria e gerencia os PRÓPRIOS benefícios no catálogo
// de fidelidade "Estrada que Cuida" (motoristas resgatam gastando pontos) e
// acompanha/atualiza o status dos vouchers resgatados pelos motoristas.
// resolverEmpresaAtual é agnóstico de segmento — posto e cliente são ambos
// linhas de "empresas", só muda o valor de segmento.

type ItemRow = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  parceiro_nome: string | null;
  pontos_necessarios: number;
  ativo: boolean;
  imagem_url: string | null;
  validade_dias: number | null;
};

type ResgateRow = {
  id: string;
  titulo: string;
  categoria: string;
  pontos_gastos: number;
  status: string;
  numero_voucher: string | null;
  valido_ate: string | null;
  solicitado_em: string;
  atualizado_em: string;
  nome_motorista: string;
};

export default async function ParceriasLocaisPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let itens: ItemRow[] = [];
  let resgates: ResgateRow[] = [];
  let erroItens: string | undefined;

  if (empresaSelecionada) {
    const { data: dataItens, error } = await supabase
      .from("fidelidade_catalogo_itens")
      .select("id, categoria, titulo, descricao, parceiro_nome, pontos_necessarios, ativo, imagem_url, validade_dias")
      .eq("criador_empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false });
    itens = (dataItens ?? []) as ItemRow[];
    erroItens = error?.message;

    // fidelidade_resgates permite leitura (RLS) de vouchers dos próprios
    // itens, mas o embed de motoristas(nome_completo) não funciona aqui:
    // a RLS de "motoristas" só libera leitura pra empresa DONA do
    // motorista (cliente/frota), não pra empresa dona do BENEFÍCIO
    // (posto). RPC resgates_beneficios_empresa (SECURITY DEFINER) resolve
    // isso trazendo o nome já junto, com a mesma checagem de autorização
    // por empresa feita dentro da função.
    const { data: dataResgates } = await supabase.rpc("resgates_beneficios_empresa", {
      p_empresa_id: empresaSelecionada,
    });
    resgates = (dataResgates ?? []) as unknown as ResgateRow[];
  }

  // "Queimado" = voucher já entregue/honrado (status concluído) — pedido do
  // Daniel (17/07): painel de controle e gestão separado dos que ainda
  // precisam de atendimento, tanto na visão posto quanto cliente (mesma
  // tela pros dois).
  const pendentes = resgates.filter((r) => r.status === "solicitado" || r.status === "em_andamento");
  const queimados = resgates.filter((r) => r.status === "concluido");
  const cancelados = resgates.filter((r) => r.status === "cancelado");
  const pontosQueimados = queimados.reduce((soma, r) => soma + r.pontos_gastos, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🎟️ Parcerias Locais</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie benefícios próprios pro catálogo de fidelidade &quot;Estrada que Cuida&quot; — vale-refeição,
            lavagem, treinamentos, telemedicina, o que fizer sentido pro seu negócio. Motoristas de toda a rede
            enxergam e resgatam com os pontos que acumulam.
            {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/parcerias-locais/novo?empresa=${empresaSelecionada}`} className="btn-primary">
            + Novo Benefício
          </Link>
        )}
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
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
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e criar benefícios.</p>
      ) : (
        <>
          {erroItens && <p className="mb-4 text-sm text-red-600">Erro ao carregar benefícios: {erroItens}</p>}

          {itens.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-400">
              Nenhum benefício criado ainda. Clique em &quot;+ Novo Benefício&quot; pra começar.
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map((item) => (
                <CardVoucher
                  key={item.id}
                  titulo={item.titulo}
                  descricao={item.descricao}
                  categoria={item.categoria}
                  parceiroNome={item.parceiro_nome}
                  pontos={item.pontos_necessarios}
                  imagemUrl={item.imagem_url}
                  rodape={
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className={item.ativo ? "badge-ativo" : "badge-inativo"}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {item.validade_dias ? <span>Válido por {item.validade_dias} dias</span> : <span>Sem validade</span>}
                    </div>
                  }
                  acoes={
                    <div className="flex items-center gap-3 border-t border-dashed border-slate-300 pt-2">
                      <Link
                        href={`/parcerias-locais/${item.id}/editar?empresa=${empresaSelecionada}`}
                        className="text-xs font-medium text-frota-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <ToggleAtivoItemParceria id={item.id} empresaId={empresaSelecionada} ativo={item.ativo} />
                      <ExcluirItemParceria id={item.id} empresaId={empresaSelecionada} titulo={item.titulo} />
                    </div>
                  }
                />
              ))}
            </div>
          )}

          <QueimarVoucherForm empresaId={empresaSelecionada} />

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Pendentes de atendimento</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{pendentes.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Vouchers queimados</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{queimados.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Pontos queimados</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{pontosQueimados.toLocaleString("pt-BR")}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase text-slate-500">Cancelados</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{cancelados.length}</p>
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pendentes de atendimento</h2>
          <div className="mb-8 card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Voucher</th>
                  <th className="px-4 py-3">Benefício</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Pontos</th>
                  <th className="px-4 py-3">Válido até</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendentes.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.numero_voucher ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.titulo}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({LABEL_CATEGORIA_FIDELIDADE[r.categoria] ?? r.categoria})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.nome_motorista}</td>
                    <td className="px-4 py-3 text-slate-600">{r.pontos_gastos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.valido_ate ? new Date(r.valido_ate).toLocaleDateString("pt-BR") : "Sem validade"}
                    </td>
                    <td className="px-4 py-3">
                      <AtualizarStatusResgateProprio id={r.id} empresaId={empresaSelecionada} status={r.status} />
                    </td>
                  </tr>
                ))}
                {pendentes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhum voucher pendente de atendimento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mb-1 text-sm font-semibold text-slate-900">🔥 Vouchers queimados</h2>
          <p className="mb-3 text-xs text-slate-500">
            Histórico de benefícios já entregues aos motoristas — pra controle e conferência.
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Voucher</th>
                  <th className="px-4 py-3">Benefício</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Pontos</th>
                  <th className="px-4 py-3">Queimado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queimados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.numero_voucher ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.titulo}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({LABEL_CATEGORIA_FIDELIDADE[r.categoria] ?? r.categoria})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.nome_motorista}</td>
                    <td className="px-4 py-3 text-slate-600">{r.pontos_gastos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(r.atualizado_em).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {queimados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum voucher queimado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
