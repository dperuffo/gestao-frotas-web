import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";

type SearchParams = { empresa?: string; numero?: string };

// Fase Pré-Pedido — tela do posto pra conferir, antes de liberar o
// abastecimento, se aquele veículo tem um Pré-Pedido ativo com parada
// pré-agendada NESTE posto (gerado automaticamente no Plano de Viagem do
// cliente quando ele habilita o parâmetro de uso "Pré-Pedido" — ver
// /parametros-uso). Mesmo padrão de tela exclusiva-Revenda de /clientes-posto:
// segmento verificado direto em `empresas`, com aviso claro se acessada por
// engano do lado Frota.
//
// A consulta usa a RPC SECURITY DEFINER `consultar_pre_pedido_para_posto`
// (não uma query direta em pre_pedidos/pre_pedidos_paradas): RLS dessas
// tabelas é escopada pela empresa DONA do pré-pedido (o cliente/frota), não
// pelo posto — a RPC resolve isso devolvendo só a parada do próprio posto
// chamador, nunca o itinerário completo do cliente (evita vazar rota pra
// concorrente).
export default async function PrePedidosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, numero: numeroParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Esta tela é exclusiva para postos revendedores conferirem Pré-Pedidos de clientes.
      </div>
    );
  }

  const numero = numeroParam?.trim() ? Number(numeroParam.trim()) : null;
  const numeroValido = numero !== null && Number.isFinite(numero) && numero > 0;

  const { data: resultado, error } =
    empresaSelecionada && numeroValido
      ? await supabase.rpc("consultar_pre_pedido_para_posto", {
          p_numero: numero,
          p_empresa_posto_id: empresaSelecionada,
        })
      : { data: null, error: null };

  const linhas = resultado ?? [];
  const cabecalho = linhas[0] ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Consulta de Pré-Pedido</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confira o número do Pré-Pedido informado pelo motorista antes de liberar o abastecimento
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Posto</label>
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

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione um posto acima para consultar.</p>
      ) : (
        <>
          <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="empresa" value={empresaSelecionada} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Número do Pré-Pedido</label>
              <input
                type="number"
                name="numero"
                min={1}
                defaultValue={numeroParam ?? ""}
                placeholder="Ex.: 1024"
                className="input text-sm"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary text-sm">
              Consultar
            </button>
          </form>

          {error && <p className="mb-4 text-sm text-red-600">Erro ao consultar: {error.message}</p>}

          {numeroValido && !error && linhas.length === 0 && (
            <div className="card p-6 text-sm text-slate-500">
              Nenhum Pré-Pedido nº {numero} com parada pré-agendada para este posto foi encontrado. Confira o número
              com o motorista ou se o CNPJ deste posto está na rota planejada.
            </div>
          )}

          {cabecalho && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Pré-Pedido nº {cabecalho.numero}</h2>
                <span
                  className={
                    cabecalho.status === "ativo"
                      ? "badge-ativo"
                      : cabecalho.status === "concluido"
                        ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        : "badge-inativo"
                  }
                >
                  {cabecalho.status === "ativo" ? "Ativo" : cabecalho.status === "concluido" ? "Concluído" : "Cancelado"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-400">Placa</dt>
                  <dd className="font-medium text-slate-800">{cabecalho.placa ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Motorista</dt>
                  <dd className="font-medium text-slate-800">{cabecalho.motorista_nome ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Data de saída</dt>
                  <dd className="font-medium text-slate-800">
                    {cabecalho.data_saida ? formatDate(cabecalho.data_saida) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Km estimado</dt>
                  <dd className="font-medium text-slate-800">{cabecalho.km_estimado ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase text-slate-400">Parada pré-agendada neste posto</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">{cabecalho.parada_posto_nome ?? "Este posto"}</span>
                    {cabecalho.parada_litros_previstos != null && (
                      <span className="text-slate-400"> · {cabecalho.parada_litros_previstos} L previstos</span>
                    )}
                  </div>
                  <span
                    className={
                      cabecalho.parada_atendida
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded-full bg-frota-100 px-2 py-0.5 text-xs font-medium text-frota-700"
                    }
                  >
                    {cabecalho.parada_atendida ? "Já abastecido" : "Autorizado — pendente"}
                  </span>
                </div>
                {!cabecalho.parada_atendida && cabecalho.status === "ativo" && (
                  <p className="mt-2 text-xs text-slate-500">
                    Este veículo está autorizado a abastecer aqui. A confirmação é feita automaticamente pela
                    integração no momento do abastecimento (ver{" "}
                    <Link href="/integracoes" className="text-frota-600 hover:underline">
                      Integrações
                    </Link>
                    ).
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
