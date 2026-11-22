"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarRegraConsumo, alternarStatusRegraConsumo, excluirRegraConsumo } from "../actions";

type Linha = {
  id: string;
  marca_contem: string | null;
  placa: string | null;
  consumo_minimo: number;
  consumo_maximo: number;
  percentual_tanque_minimo: number;
  status: string;
  observacao: string | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Regra de consumo (km/l): bloqueia o abastecimento quando o consumo estimado
// (km rodados desde o último abastecimento ÷ litros) fica fora da faixa.
export function SecaoConsumo({
  linhas,
  empresaId,
  veiculos,
}: {
  linhas: Linha[];
  empresaId: string;
  veiculos: VeiculoOpcao[];
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Linha | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  // Sugestões para o campo "marca/modelo": marca (1ª palavra) e descrição completa.
  const sugestoes = Array.from(
    new Set(
      veiculos.flatMap((v) => {
        const m = (v.marca ?? "").trim();
        return m ? [m.split(/\s+/)[0], m] : [];
      }),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarRegraConsumo(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Faixa de consumo (km/l) aceita por marca/modelo ou placa. O abastecimento é <strong>bloqueado</strong> quando o
            consumo estimado (km rodados desde o último abastecimento ÷ litros) fica fora da faixa. Só é avaliado quando há
            hodômetro atual e anterior e o abastecimento enche ao menos o percentual mínimo do tanque (abastecimento
            parcial distorce o cálculo).
          </p>
          <button type="button" onClick={() => { setEditando(null); setModalAberto(true); }} className="btn-primary shrink-0">
            + Nova Regra
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Marca/modelo ou placa</th>
              <th className="px-4 py-3">Faixa (km/l)</th>
              <th className="px-4 py-3">Tanque mín.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {linhas.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.placa ?? `Marca/modelo contém “${l.marca_contem}”`}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {fmt(l.consumo_minimo)} a {fmt(l.consumo_maximo)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt(l.percentual_tanque_minimo)}%</td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.observacao ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setEditando(l); setModalAberto(true); }}
                      className="text-xs font-medium text-frota-600 hover:underline"
                    >
                      Editar
                    </button>
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusRegraConsumo} />
                    <ExcluirRegra id={l.id} acao={excluirRegraConsumo} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra
        titulo={`${editando ? "Editar" : "Nova"} Regra — Consumo (km/l)`}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      >
        <form key={editando?.id ?? "novo"} onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />
          {editando && <input type="hidden" name="id" value={editando.id} />}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Marca/modelo contém</label>
            <input
              name="marca_contem"
              list="sugestoes-marca-consumo"
              placeholder="Ex.: Fiat"
              defaultValue={editando?.marca_contem ?? ""}
              className="input"
            />
            <datalist id="sugestoes-marca-consumo">
              {sugestoes.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              …ou uma placa específica (preencha só um dos dois)
            </label>
            <select name="placa" defaultValue={editando?.placa ?? ""} className="input">
              <option value="">—</option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Consumo mínimo (km/l) *</label>
              <input type="number" step="0.1" min={0} name="consumo_minimo" required defaultValue={editando?.consumo_minimo ?? undefined} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Consumo máximo (km/l) *</label>
              <input type="number" step="0.1" min={0} name="consumo_maximo" required defaultValue={editando?.consumo_maximo ?? undefined} className="input" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Avaliar só se o abastecimento encher pelo menos (% do tanque)
            </label>
            <input type="number" step="1" min={0} max={100} name="percentual_tanque_minimo" defaultValue={editando?.percentual_tanque_minimo ?? 50} className="input" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Observação</label>
            <textarea name="observacao" rows={2} defaultValue={editando?.observacao ?? ""} className="input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Salvando..." : "Salvar Regra"}
            </button>
          </div>
        </form>
      </ModalRegra>
    </div>
  );
}
