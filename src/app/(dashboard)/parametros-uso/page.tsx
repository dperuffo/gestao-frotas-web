import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { ToggleStatusVinculo } from "./_components/ToggleStatusVinculo";
import { SecaoIntervalo } from "./_components/SecaoIntervalo";
import { SecaoValorDiario } from "./_components/SecaoValorDiario";
import { SecaoVolumeDiario } from "./_components/SecaoVolumeDiario";
import { SecaoProduto } from "./_components/SecaoProduto";
import { SecaoVariacaoHodometro } from "./_components/SecaoVariacaoHodometro";
import { SecaoDiasHorarios } from "./_components/SecaoDiasHorarios";
import { SecaoPostosPermitidos } from "./_components/SecaoPostosPermitidos";
import { SecaoLimiteServicos } from "./_components/SecaoLimiteServicos";
import { SecaoCota } from "./_components/SecaoCota";

// Fase 27.120/27.121 — tela de "Parâmetros de Uso" (pedido do Daniel, com
// base num anexo de referência com 10 tipos de regra pra balizar
// abastecimentos feitos em postos ou soluções externas de automação/meios
// de pagamento). Abas trocadas via ?tipo= (Link, mesmo padrão de filtro já
// usado em /abastecimentos e /ciclo-aberto). "Vínculo" (Fase 27.120) usa
// página própria de criar/editar (era o 1º tipo, validando o padrão); os
// outros 9 (Fase 27.121) usam modal inline dentro da própria aba.
const ABAS: { tipo: string; label: string }[] = [
  { tipo: "vinculo", label: "Vínculo Motorista ↔ Veículo" },
  { tipo: "intervalo", label: "Intervalo" },
  { tipo: "valor-diario", label: "Valor Diário" },
  { tipo: "volume-diario", label: "Vol. Diário" },
  { tipo: "produto", label: "Produto" },
  { tipo: "hodometro-leve", label: "Hodôm. Leve" },
  { tipo: "hodometro-pesado", label: "Hodôm. Pesado" },
  { tipo: "dias-horarios", label: "Dias/Horários" },
  { tipo: "postos", label: "Postos" },
  { tipo: "servicos", label: "Serviços" },
  { tipo: "cotas", label: "Cotas" },
];

type VinculoRow = {
  id: string;
  placa: string;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string; cpf: string } | null;
};

function inicioDoPeriodo(periodicidade: string, hoje: Date): string {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const dia = hoje.getUTCDate();
  if (periodicidade === "Semana") {
    const diaSemana = hoje.getUTCDay(); // 0=domingo
    const offset = diaSemana === 0 ? 6 : diaSemana - 1; // dias desde a última segunda
    const inicio = new Date(hoje);
    inicio.setUTCDate(dia - offset);
    return inicio.toISOString().slice(0, 10);
  }
  if (periodicidade === "Quinzena") {
    return new Date(Date.UTC(ano, mes, dia <= 15 ? 1 : 16)).toISOString().slice(0, 10);
  }
  if (periodicidade === "Abastecimento") {
    return hoje.toISOString().slice(0, 10);
  }
  // "Mes" (padrão)
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

export default async function ParametrosUsoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; status?: string; tipo?: string }>;
}) {
  const { empresa: empresaParam, status: statusParam, tipo: tipoParam } = await searchParams;
  const tipo = ABAS.some((a) => a.tipo === tipoParam) ? (tipoParam as string) : "vinculo";
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  function linkAba(tipoAba: string) {
    const params = new URLSearchParams();
    if (empresaParam) params.set("empresa", empresaParam);
    if (tipoAba !== "vinculo") params.set("tipo", tipoAba);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Parâmetros de Uso <AjudaIcon chave="parametros-uso.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Regras que balizam abastecimentos feitos em postos ou soluções de automação/meios de pagamento integrados
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {empresaSelecionada && tipo === "vinculo" && (
          <Link href="/parametros-uso/novo" className="btn-primary">
            + Novo Vínculo
          </Link>
        )}
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
          <input type="hidden" name="tipo" value={tipo === "vinculo" ? "" : tipo} />
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {ABAS.map((a) => (
          <Link
            key={a.tipo}
            href={linkAba(a.tipo)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tipo === a.tipo ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {semClienteEscolhido || !empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os parâmetros dele.</p>
      ) : (
        <ConteudoAba
          tipo={tipo}
          empresaId={empresaSelecionada}
          statusParam={statusParam}
          empresaParam={empresaParam}
        />
      )}
    </div>
  );
}

async function ConteudoAba({
  tipo,
  empresaId,
  statusParam,
  empresaParam,
}: {
  tipo: string;
  empresaId: string;
  statusParam?: string;
  empresaParam?: string;
}) {
  const supabase = await createClient();

  if (tipo === "vinculo") {
    let query = supabase
      .from("parametros_vinculo_motorista_veiculo")
      .select("id, placa, data_inicio, data_fim, status, observacao, motoristas(nome_completo, cpf)")
      .eq("empresa_id", empresaId)
      .order("placa");
    if (statusParam === "Ativo" || statusParam === "Inativo") query = query.eq("status", statusParam);
    const { data, error } = await query;
    const vinculos = (data ?? []) as unknown as VinculoRow[];

    function linkFiltroStatus(valor: string) {
      const params = new URLSearchParams();
      if (empresaParam) params.set("empresa", empresaParam);
      if (valor) params.set("status", valor);
      const qs = params.toString();
      return qs ? `?${qs}` : "?";
    }

    return (
      <>
        <div className="card mb-4 p-4">
          <p className="text-sm text-slate-600">
            Associa um motorista a um veículo específico. Abastecimentos feitos em postos ou soluções de automação
            integradas via API podem ser autorizados apenas quando o par motorista/veículo estiver{" "}
            <strong>ativo</strong> neste cadastro.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={linkFiltroStatus("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${!statusParam ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Todos ({vinculos.length})
          </Link>
          <Link
            href={linkFiltroStatus("Ativo")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusParam === "Ativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Ativos
          </Link>
          <Link
            href={linkFiltroStatus("Inativo")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusParam === "Inativo" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Inativos
          </Link>
        </div>

        <div className="card overflow-x-auto">
          {error && <p className="p-4 text-sm text-red-600">Erro ao carregar vínculos: {error.message}</p>}
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Data início</th>
                <th className="px-4 py-3">Data fim</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vinculos.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{v.placa}</td>
                  <td className="px-4 py-3 text-slate-600">{v.motoristas?.nome_completo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{v.motoristas?.cpf ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(v.data_inicio)}</td>
                  <td className="px-4 py-3 text-slate-600">{v.data_fim ? formatDate(v.data_fim) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={v.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.observacao ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/parametros-uso/${v.id}/editar`} className="text-xs font-medium text-frota-600 hover:underline">
                        Editar
                      </Link>
                      <ToggleStatusVinculo id={v.id} ativo={v.status === "Ativo"} />
                    </div>
                  </td>
                </tr>
              ))}
              {vinculos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhum vínculo encontrado. Clique em &quot;Novo Vínculo&quot; para associar um motorista a um
                    veículo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // Fase 27.121 — os outros 9 tipos: opções compartilhadas (veículos,
  // motoristas, postos negociados) carregadas uma vez, e cada aba busca só
  // a própria tabela.
  const [{ data: veiculosData }, { data: motoristasData }, { data: postosData }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, empresaId),
    supabase.from("motoristas").select("id, nome_completo, cpf").eq("empresa_id", empresaId).order("nome_completo"),
    supabase
      .from("negociacoes_postos")
      .select("posto_cnpj, posto_nome")
      .eq("empresa_cliente_id", empresaId)
      .eq("status", "aceita"),
  ]);
  const veiculos = (veiculosData ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo }));
  const motoristas = motoristasData ?? [];
  const postosMap = new Map<string, string>();
  (postosData ?? []).forEach((p) => {
    if (p.posto_cnpj) postosMap.set(p.posto_cnpj, p.posto_nome ?? p.posto_cnpj);
  });
  const postos = Array.from(postosMap, ([cnpj, nome]) => ({ cnpj, nome }));

  if (tipo === "intervalo") {
    const { data } = await supabase
      .from("parametros_intervalo_abastecimento")
      .select("id, tipo, placa, intervalo_minimo, unidade, status, observacao, motoristas(nome_completo)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return (
      <SecaoIntervalo
        linhas={(data ?? []) as any}
        empresaId={empresaId}
        veiculos={veiculos}
        motoristas={motoristas}
      />
    );
  }

  if (tipo === "valor-diario") {
    const { data } = await supabase
      .from("parametros_valor_diario_motorista")
      .select("id, valor_maximo, status, observacao, motoristas(nome_completo)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return <SecaoValorDiario linhas={(data ?? []) as any} empresaId={empresaId} motoristas={motoristas} />;
  }

  if (tipo === "volume-diario") {
    const { data } = await supabase
      .from("parametros_volume_diario_veiculo")
      .select("id, placa, volume_maximo, status, observacao")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return <SecaoVolumeDiario linhas={data ?? []} empresaId={empresaId} veiculos={veiculos} />;
  }

  if (tipo === "produto") {
    const { data } = await supabase
      .from("parametros_produto_abastecido")
      .select("id, placa, combustiveis_permitidos, status, observacao")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return <SecaoProduto linhas={data ?? []} empresaId={empresaId} veiculos={veiculos} />;
  }

  if (tipo === "hodometro-leve" || tipo === "hodometro-pesado") {
    const classificacao = tipo === "hodometro-leve" ? "Leve" : "Pesado";
    const { data } = await supabase
      .from("parametros_variacao_hodometro")
      .select("id, placa, variacao_maxima_km, status, observacao")
      .eq("empresa_id", empresaId)
      .eq("classificacao", classificacao)
      .order("criado_em", { ascending: false });
    return (
      <SecaoVariacaoHodometro
        linhas={data ?? []}
        empresaId={empresaId}
        classificacao={classificacao}
        veiculos={veiculos}
      />
    );
  }

  if (tipo === "dias-horarios") {
    const { data } = await supabase
      .from("parametros_dias_horarios")
      .select("id, classificacao, placa, dias_permitidos, hora_inicio, hora_fim, status, observacao, motoristas(nome_completo)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return (
      <SecaoDiasHorarios
        linhas={(data ?? []) as any}
        empresaId={empresaId}
        veiculos={veiculos}
        motoristas={motoristas}
      />
    );
  }

  if (tipo === "postos") {
    const { data } = await supabase
      .from("parametros_postos_permitidos")
      .select("id, classificacao, placa, postos_cnpj, tipo_limite, valor_maximo, status, observacao, motoristas(nome_completo)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return (
      <SecaoPostosPermitidos
        linhas={(data ?? []) as any}
        empresaId={empresaId}
        veiculos={veiculos}
        motoristas={motoristas}
        postos={postos}
      />
    );
  }

  if (tipo === "servicos") {
    const { data } = await supabase
      .from("parametros_limite_servicos")
      .select("id, placa, postos_cnpj, limites, status, observacao, motoristas(nome_completo)")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    return (
      <SecaoLimiteServicos
        linhas={(data ?? []) as any}
        empresaId={empresaId}
        veiculos={veiculos}
        motoristas={motoristas}
        postos={postos}
      />
    );
  }

  // tipo === "cotas"
  const { data: cotas } = await supabase
    .from("parametros_cota_veiculo")
    .select("id, placa, tipo, limite, periodicidade, status, observacao")
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false });

  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const fimExclusivo = amanha.toISOString().slice(0, 10);
  const linhasCotas = await Promise.all(
    (cotas ?? []).map(async (c) => {
      const inicio = inicioDoPeriodo(c.periodicidade, hoje);
      // Fase 27.121 — data_abastecimento é timestamptz; usar "< amanhã" em
      // vez de "<= hoje" pra não cortar abastecimentos de hoje feitos à
      // tarde/noite (comparação com string de data pura assume 00:00).
      const { data: abastecimentos } = await supabase
        .from("abastecimentos_unificado")
        .select("valor_total, litros")
        .eq("empresa_id", empresaId)
        .eq("placa", c.placa)
        .gte("data_abastecimento", inicio)
        .lt("data_abastecimento", fimExclusivo);
      const consumido = (abastecimentos ?? []).reduce(
        (soma, a) => soma + (c.tipo === "Valor" ? (a.valor_total ?? 0) : (a.litros ?? 0)),
        0
      );
      return { ...c, consumido };
    })
  );

  return <SecaoCota linhas={linhasCotas} empresaId={empresaId} veiculos={veiculos} />;
}
