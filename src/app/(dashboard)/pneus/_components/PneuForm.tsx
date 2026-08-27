"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarPneuAcao, atualizarPneuAcao } from "../actions";
import type { Database } from "@/types/database.types";

type Pneu = Database["public"]["Tables"]["pneus"]["Row"];

const POSICOES_SUGERIDAS = [
  "Dianteiro Esquerdo",
  "Dianteiro Direito",
  "Traseiro Esquerdo Externo",
  "Traseiro Esquerdo Interno",
  "Traseiro Direito Externo",
  "Traseiro Direito Interno",
  "Estepe",
];

export function PneuForm({
  empresaId,
  pneu,
  placas,
}: {
  empresaId: string;
  pneu?: Pneu;
  placas: string[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = pneu
        ? await atualizarPneuAcao(pneu.id, undefined, formData)
        : await criarPneuAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Placa <span className="text-red-500">*</span>
          </label>
          <input list="placas-pneu" name="placa" required defaultValue={pneu?.placa ?? ""} className="input" />
          <datalist id="placas-pneu">
            {placas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Posição no veículo <span className="text-red-500">*</span>
          </label>
          <input list="posicoes-pneu" name="posicao" required defaultValue={pneu?.posicao ?? ""} className="input" />
          <datalist id="posicoes-pneu">
            {POSICOES_SUGERIDAS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Número de fogo</label>
          <input name="numero_fogo" defaultValue={pneu?.numero_fogo ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Marca</label>
          <input name="marca" defaultValue={pneu?.marca ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Modelo</label>
          <input name="modelo" defaultValue={pneu?.modelo ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Medida</label>
          <input name="medida" defaultValue={pneu?.medida ?? ""} className="input" placeholder="295/80R22.5" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data de instalação <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="data_instalacao"
            required
            defaultValue={pneu?.data_instalacao ?? new Date().toISOString().slice(0, 10)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hodômetro na instalação (km)</label>
          <input
            type="number"
            name="hodometro_instalacao"
            min={0}
            step="1"
            defaultValue={pneu?.hodometro_instalacao ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Valor de aquisição (R$)</label>
          <input
            type="number"
            name="valor_aquisicao"
            min={0}
            step="0.01"
            defaultValue={pneu?.valor_aquisicao ?? ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="observacoes" rows={3} defaultValue={pneu?.observacoes ?? ""} className="input" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : pneu ? "Salvar alterações" : "Cadastrar pneu"}
        </button>
      </div>
    </form>
  );
}
