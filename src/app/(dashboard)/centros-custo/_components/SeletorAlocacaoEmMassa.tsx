"use client";

import { useMemo, useState } from "react";

export type ItemAlocavel = { chave: string; label: string; subLabel?: string | null };

// Fase 27.36 — achado real: cliente com frota grande (centenas de
// veículos/motoristas) tinha que alocar um de cada vez — um <select> +
// clique em "Alocar" por operação. Inviável em volume. Este componente é
// genérico (usado tanto pra veículos quanto motoristas, ver
// AlocarVeiculoForm.tsx/AlocarMotoristaForm.tsx) e resolve isso com: busca
// pra filtrar tanto a lista de disponíveis quanto a de já alocados (frotas
// grandes tornam AMBAS as listas longas), "selecionar todos os filtrados" e
// um único botão que aloca/remove tudo que foi marcado de uma vez.
export function SeletorAlocacaoEmMassa({
  itensDisponiveis,
  itensAlocados,
  onAlocar,
  onRemover,
  labelPlural,
  placeholderBusca,
}: {
  itensDisponiveis: ItemAlocavel[];
  itensAlocados: ItemAlocavel[];
  onAlocar: (chaves: string[]) => Promise<{ erro?: string } | void>;
  onRemover: (chaves: string[]) => Promise<{ erro?: string } | void>;
  labelPlural: string;
  placeholderBusca: string;
}) {
  const [buscaDisponiveis, setBuscaDisponiveis] = useState("");
  const [buscaAlocados, setBuscaAlocados] = useState("");
  const [selecionadosDisponiveis, setSelecionadosDisponiveis] = useState<Set<string>>(new Set());
  const [selecionadosAlocados, setSelecionadosAlocados] = useState<Set<string>>(new Set());
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  function filtrar(itens: ItemAlocavel[], termo: string) {
    const t = termo.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter((i) => i.label.toLowerCase().includes(t) || i.subLabel?.toLowerCase().includes(t));
  }

  const disponiveisFiltrados = useMemo(() => filtrar(itensDisponiveis, buscaDisponiveis), [itensDisponiveis, buscaDisponiveis]);
  const alocadosFiltrados = useMemo(() => filtrar(itensAlocados, buscaAlocados), [itensAlocados, buscaAlocados]);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, chave: string) {
    const novo = new Set(set);
    if (novo.has(chave)) novo.delete(chave);
    else novo.add(chave);
    setSet(novo);
  }

  function alternarTodos(itens: ItemAlocavel[], set: Set<string>, setSet: (s: Set<string>) => void) {
    const todosMarcados = itens.length > 0 && itens.every((i) => set.has(i.chave));
    if (todosMarcados) {
      const novo = new Set(set);
      itens.forEach((i) => novo.delete(i.chave));
      setSet(novo);
    } else {
      const novo = new Set(set);
      itens.forEach((i) => novo.add(i.chave));
      setSet(novo);
    }
  }

  async function alocarSelecionados() {
    setErro(undefined);
    setPendente(true);
    try {
      const resultado = await onAlocar(Array.from(selecionadosDisponiveis));
      if (resultado?.erro) setErro(resultado.erro);
      else setSelecionadosDisponiveis(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao alocar.");
    } finally {
      setPendente(false);
    }
  }

  async function removerSelecionados() {
    setErro(undefined);
    setPendente(true);
    try {
      const resultado = await onRemover(Array.from(selecionadosAlocados));
      if (resultado?.erro) setErro(resultado.erro);
      else setSelecionadosAlocados(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setPendente(false);
    }
  }

  async function removerUm(chave: string) {
    setErro(undefined);
    setPendente(true);
    try {
      const resultado = await onRemover([chave]);
      if (resultado?.erro) setErro(resultado.erro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setPendente(false);
    }
  }

  return (
    <div>
      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Disponíveis pra alocar */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Disponíveis ({disponiveisFiltrados.length})
            </p>
            <button
              type="button"
              onClick={alocarSelecionados}
              disabled={pendente || selecionadosDisponiveis.size === 0}
              className="btn-primary text-xs"
            >
              Alocar {selecionadosDisponiveis.size > 0 ? `(${selecionadosDisponiveis.size})` : "selecionados"}
            </button>
          </div>
          <input
            type="search"
            value={buscaDisponiveis}
            onChange={(e) => setBuscaDisponiveis(e.target.value)}
            placeholder={placeholderBusca}
            className="input mb-2 text-sm"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            {disponiveisFiltrados.length > 0 && (
              <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={disponiveisFiltrados.every((i) => selecionadosDisponiveis.has(i.chave))}
                  onChange={() => alternarTodos(disponiveisFiltrados, selecionadosDisponiveis, setSelecionadosDisponiveis)}
                  className="h-4 w-4 rounded border-slate-300 text-frota-600 focus:ring-frota-500"
                />
                Selecionar todos os filtrados
              </label>
            )}
            <ul className="divide-y divide-slate-100">
              {disponiveisFiltrados.map((item) => (
                <li key={item.chave}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-frota-50/60">
                    <input
                      type="checkbox"
                      checked={selecionadosDisponiveis.has(item.chave)}
                      onChange={() => toggle(selecionadosDisponiveis, setSelecionadosDisponiveis, item.chave)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-frota-600 focus:ring-frota-500"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      {item.subLabel && <span className="ml-1 text-slate-400">{item.subLabel}</span>}
                    </span>
                  </label>
                </li>
              ))}
              {disponiveisFiltrados.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  {itensDisponiveis.length === 0 ? `Nenhum ${labelPlural} disponível.` : "Nenhum resultado para essa busca."}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Já alocados */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Alocados ({alocadosFiltrados.length})
            </p>
            <button
              type="button"
              onClick={removerSelecionados}
              disabled={pendente || selecionadosAlocados.size === 0}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              Remover {selecionadosAlocados.size > 0 ? `(${selecionadosAlocados.size})` : "selecionados"}
            </button>
          </div>
          <input
            type="search"
            value={buscaAlocados}
            onChange={(e) => setBuscaAlocados(e.target.value)}
            placeholder={placeholderBusca}
            className="input mb-2 text-sm"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            {alocadosFiltrados.length > 0 && (
              <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={alocadosFiltrados.every((i) => selecionadosAlocados.has(i.chave))}
                  onChange={() => alternarTodos(alocadosFiltrados, selecionadosAlocados, setSelecionadosAlocados)}
                  className="h-4 w-4 rounded border-slate-300 text-frota-600 focus:ring-frota-500"
                />
                Selecionar todos os filtrados
              </label>
            )}
            <ul className="divide-y divide-slate-100">
              {alocadosFiltrados.map((item) => (
                <li key={item.chave} className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-frota-50/60">
                  <input
                    type="checkbox"
                    checked={selecionadosAlocados.has(item.chave)}
                    onChange={() => toggle(selecionadosAlocados, setSelecionadosAlocados, item.chave)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-frota-600 focus:ring-frota-500"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    {item.subLabel && <span className="ml-1 text-slate-400">{item.subLabel}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerUm(item.chave)}
                    disabled={pendente}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
              {alocadosFiltrados.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  {itensAlocados.length === 0 ? "Nenhum alocado ainda." : "Nenhum resultado para essa busca."}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
