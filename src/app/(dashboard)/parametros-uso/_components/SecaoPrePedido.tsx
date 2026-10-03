"use client";

import { useState, useTransition } from "react";
import { cancelarPrePedidoAcao, criarPrePedidoAcao, salvarParametroPrePedidoAcao, type ParadaPrePedidoForm } from "../actions";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null; empresaNome?: string };
type MotoristaOpcao = { id: string; nome_completo: string; empresaNome?: string };
type PostoOpcao = { cnpj: string; nome: string };
export type PrePedidoLinha = {
  id: string;
  numero: number;
  placa: string | null;
  status: string;
  criado_em: string;
  motorista_nome: string | null;
  paradas: { ordem: number; posto_nome: string | null; posto_cnpj: string; litros_previstos: number | null; valor_previsto: number | null; atendido: boolean }[];
};

type ParadaForm = { posto: string; tipo: "litros" | "valor"; quantidade: string };
const PARADA_VAZIA: ParadaForm = { posto: "", tipo: "litros", quantidade: "" };

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Pré-Pedido (reformulado em 03/10/2026, pedido do Daniel): o parâmetro de uso
// liga/desliga a exigência; abaixo, o gestor cria Pré-Pedidos — placa, postos
// de parada e limite de cada parada (litros ou R$). O sistema gera o número,
// que o motorista informa no posto e o caixa digita no PDV FNI.
export function SecaoPrePedido({
  empresaId,
  habilitado,
  veiculos,
  motoristas,
  postos,
  prePedidos,
}: {
  empresaId: string;
  habilitado: boolean;
  veiculos: VeiculoOpcao[];
  motoristas: MotoristaOpcao[];
  postos: PostoOpcao[];
  prePedidos: PrePedidoLinha[];
}) {
  const [isPending, startTransition] = useTransition();
  const [criando, setCriando] = useState(false);
  const [placa, setPlaca] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [paradas, setParadas] = useState<ParadaForm[]>([{ ...PARADA_VAZIA }]);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<number | null>(null);

  function alternarParametro() {
    const pergunta = habilitado
      ? "Desativar o Pré-Pedido? O PDV deixará de exigir o número do Pré-Pedido nos abastecimentos deste cliente."
      : "Ativar o Pré-Pedido? A partir de agora, todo abastecimento deste cliente no PDV só é autorizado com o número de um Pré-Pedido válido para a placa e o posto, dentro do limite de litros/valor da parada.";
    if (!window.confirm(pergunta)) return;
    startTransition(async () => {
      await salvarParametroPrePedidoAcao(empresaId, !habilitado);
    });
  }

  function atualizarParada(i: number, campo: Partial<ParadaForm>) {
    setParadas((lista) => lista.map((p, idx) => (idx === i ? { ...p, ...campo } : p)));
  }

  function limparFormulario() {
    setPlaca("");
    setMotoristaId("");
    setParadas([{ ...PARADA_VAZIA }]);
    setErro(null);
  }

  function gerar() {
    setErro(null);
    setGerado(null);
    const lista: ParadaPrePedidoForm[] = [];
    for (let i = 0; i < paradas.length; i++) {
      const p = paradas[i];
      const posto = postos.find((x) => x.cnpj === p.posto);
      const qtd = Number(p.quantidade.replace(",", "."));
      if (!posto || !(qtd > 0)) {
        setErro(`Parada ${i + 1}: escolha o posto e informe uma quantidade maior que zero.`);
        return;
      }
      lista.push({ posto_cnpj: posto.cnpj, posto_nome: posto.nome, tipo: p.tipo, quantidade: qtd });
    }
    if (!placa) {
      setErro("Escolha a placa do veículo.");
      return;
    }
    startTransition(async () => {
      const r = await criarPrePedidoAcao(empresaId, placa, motoristaId || null, lista);
      if (r.erro) setErro(r.erro);
      else {
        setGerado(r.numero ?? null);
        limparFormulario();
        setCriando(false);
      }
    });
  }

  function cancelar(id: string, numero: number) {
    if (!window.confirm(`Cancelar o Pré-Pedido nº ${numero}? O motorista não poderá mais usá-lo.`)) return;
    startTransition(async () => {
      await cancelarPrePedidoAcao(id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Pré-Pedido <AjudaIcon chave="parametros-uso.pre-pedido" />
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Com o parâmetro <strong>habilitado</strong>, o abastecimento só é autorizado no PDV com o <strong>número de
          um Pré-Pedido</strong> válido para a placa e o posto, dentro do limite (litros ou R$) da parada. Crie os
          Pré-Pedidos abaixo e passe o número ao motorista.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <button
            type="button"
            onClick={alternarParametro}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              habilitado ? "bg-frota-600" : "bg-slate-300"
            }`}
            aria-pressed={habilitado}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition dark:bg-slate-800 ${
                habilitado ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exigir Pré-Pedido {habilitado ? "habilitado" : "desabilitado"} para este cliente
          </span>
        </div>
      </div>

      {gerado !== null && (
        <div className="card border-l-4 border-status-ativo p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Pré-Pedido gerado. Informe este número ao motorista:</p>
          <p className="mt-1 text-3xl font-bold tracking-wide text-slate-900 dark:text-slate-100">nº {gerado}</p>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pré-Pedidos</h3>
          {!criando && (
            <button type="button" onClick={() => { setCriando(true); setGerado(null); }} className="btn-primary text-sm">
              + Novo Pré-Pedido
            </button>
          )}
        </div>

        {criando && (
          <div className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Veículo (placa)</label>
                <select value={placa} onChange={(e) => setPlaca(e.target.value)} className="input text-sm">
                  <option value="">Selecione...</option>
                  {veiculos.map((v) => (
                    <option key={v.placa} value={v.placa}>
                      {v.placa}
                      {v.modelo ? ` — ${v.marca ?? ""} ${v.modelo}` : ""}
                      {v.empresaNome ? ` (${v.empresaNome})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Motorista (opcional)</label>
                <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className="input text-sm">
                  <option value="">Qualquer motorista</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome_completo}
                      {m.empresaNome ? ` (${m.empresaNome})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-400">Postos de parada</p>
              <div className="space-y-2">
                {paradas.map((p, i) => (
                  <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Posto {i + 1}</label>
                      <select value={p.posto} onChange={(e) => atualizarParada(i, { posto: e.target.value })} className="input text-sm">
                        <option value="">Selecione...</option>
                        {postos.map((x) => (
                          <option key={x.cnpj} value={x.cnpj}>
                            {x.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Limitar por</label>
                      <select value={p.tipo} onChange={(e) => atualizarParada(i, { tipo: e.target.value as "litros" | "valor" })} className="input text-sm">
                        <option value="litros">Volume (L)</option>
                        <option value="valor">Valor (R$)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{p.tipo === "litros" ? "Litros" : "Valor (R$)"}</label>
                      <input
                        inputMode="decimal"
                        value={p.quantidade}
                        onChange={(e) => atualizarParada(i, { quantidade: e.target.value })}
                        placeholder={p.tipo === "litros" ? "Ex.: 200" : "Ex.: 1500,00"}
                        className="input text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setParadas((l) => l.filter((_, idx) => idx !== i))}
                      disabled={paradas.length === 1}
                      className="pb-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-30"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
              {postos.length === 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Nenhum posto com negociação aceita para este cliente. Aceite uma negociação para poder incluí-lo como parada.
                </p>
              )}
              <button type="button" onClick={() => setParadas((l) => [...l, { ...PARADA_VAZIA }])} className="mt-2 text-xs font-medium text-frota-600 hover:underline">
                + Adicionar parada
              </button>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={gerar} disabled={isPending} className="btn-primary text-sm">
                {isPending ? "Gerando..." : "Gerar nº do Pré-Pedido"}
              </button>
              <button type="button" onClick={() => { limparFormulario(); setCriando(false); }} className="btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Paradas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {prePedidos.map((pp) => (
                <tr key={pp.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{pp.numero}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pp.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pp.motorista_nome ?? "Qualquer"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <ul className="space-y-0.5">
                      {pp.paradas.map((pa) => (
                        <li key={pa.ordem} className={pa.atendido ? "text-slate-400 line-through" : ""}>
                          {pa.ordem}. {pa.posto_nome ?? pa.posto_cnpj} —{" "}
                          {pa.litros_previstos != null ? `até ${pa.litros_previstos} L` : pa.valor_previsto != null ? `até ${moeda(pa.valor_previsto)}` : "sem limite"}
                          {pa.atendido ? " (atendida)" : ""}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <span className={pp.status === "ativo" ? "badge-ativo" : pp.status === "concluido" ? "badge-atencao" : "badge-inativo"}>
                      {pp.status === "ativo" ? "Ativo" : pp.status === "concluido" ? "Concluído" : "Cancelado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pp.status === "ativo" && (
                      <button type="button" onClick={() => cancelar(pp.id, pp.numero)} disabled={isPending} className="text-xs font-medium text-red-600 hover:underline">
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {prePedidos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhum Pré-Pedido criado. Clique em &quot;Novo Pré-Pedido&quot; para gerar o primeiro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
