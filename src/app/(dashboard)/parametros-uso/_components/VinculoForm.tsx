"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarVinculo, atualizarVinculo } from "../actions";

type VinculoExistente = {
  id: string;
  placa: string;
  motorista_id: string;
  data_inicio: string;
  data_fim: string | null;
  observacao: string | null;
  status: string;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string };

export function VinculoForm({
  vinculo,
  empresaId,
  veiculos,
  motoristas,
}: {
  vinculo?: VinculoExistente;
  empresaId: string;
  veiculos: VeiculoOpcao[];
  motoristas: MotoristaOpcao[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = vinculo
        ? await atualizarVinculo(vinculo.id, undefined, formData)
        : await criarVinculo(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {!vinculo && <input type="hidden" name="empresa_id" value={empresaId} />}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Vínculo Motorista ↔ Veículo</h2>
        <p className="mb-4 text-xs text-slate-500">
          Associa um motorista a um veículo específico. O abastecimento (feito no posto ou via solução de automação
          integrada) só é permitido quando este par estiver ativo.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Veículo (placa)" required>
            <select name="placa" required defaultValue={vinculo?.placa ?? ""} className="input">
              <option value="" disabled>
                Selecione o veículo...
              </option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa} {v.marca ? `— ${v.marca} ${v.modelo ?? ""}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Motorista" required>
            <select name="motorista_id" required defaultValue={vinculo?.motorista_id ?? ""} className="input">
              <option value="" disabled>
                Selecione o motorista...
              </option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome_completo} — {m.cpf}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data de início" required>
            <input
              type="date"
              name="data_inicio"
              required
              defaultValue={vinculo?.data_inicio ?? new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </Campo>
          <Campo label="Data fim (em branco = sem prazo)">
            <input type="date" name="data_fim" defaultValue={vinculo?.data_fim ?? ""} className="input" />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Observação">
            <textarea name="observacao" defaultValue={vinculo?.observacao ?? ""} rows={2} className="input" />
          </Campo>
        </div>

        {vinculo && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={vinculo.status === "Ativo"}
              className="h-4 w-4 rounded border-slate-300"
            />
            Vínculo ativo
          </label>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : vinculo ? "Salvar alterações" : "Salvar Vínculo"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
