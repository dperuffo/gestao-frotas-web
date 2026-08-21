"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarAbastecimentoInternoAcao } from "../actions-interno";
import { COMBUSTIVEIS_POSTO_INTERNO, ARLA32 } from "@/lib/constants";

type EmpresaOpcao = { id: string; nome: string };

// Fase Abastecimento-Interno (21/08/2026) — irmão do AbastecimentoForm
// (lançamento manual "externo"), mas gravando em abastecimentos_internos.
// Preço unitário nunca aparece aqui pro usuário digitar — é sempre o
// cadastrado em Postos Internos, resolvido no servidor (criarAbastecimentoInternoAcao).
export function FormAbastecimentoInterno({ empresas }: { empresas: EmpresaOpcao[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState<string | undefined>();
  const [combustivel, setCombustivel] = useState("");
  const [isPending, startTransition] = useTransition();

  const ehDiesel = combustivel.toLowerCase().startsWith("diesel");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setOk(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarAbastecimentoInternoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else if (resultado?.ok) {
        setOk(resultado.ok);
        (e.target as HTMLFormElement).reset();
        setCombustivel("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {ok && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Use este formulário para registrar um abastecimento feito na garagem/tanque próprio da
        empresa (matriz ou filial). O preço unitário é o cadastrado em Postos Internos — não é
        digitado aqui.
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Abastecimento Interno</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Empresa (posto interno)" required>
            <select name="empresa_id" required defaultValue="" className="input">
              <option value="" disabled>
                Selecione...
              </option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data e hora">
            <input type="datetime-local" name="data_abastecimento" className="input" />
          </Campo>
          <Campo label="Placa do veículo" required>
            <input name="placa" required className="input" />
          </Campo>
          <Campo label="Motorista">
            <input name="motorista_nome" className="input" />
          </Campo>
          <Campo label="Hodômetro (km)">
            <input type="number" name="hodometro" className="input" />
          </Campo>
          <Campo label="Combustível" required>
            <select
              name="combustivel"
              required
              value={combustivel}
              onChange={(e) => setCombustivel(e.target.value)}
              className="input"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {COMBUSTIVEIS_POSTO_INTERNO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Quantidade (L)" required>
            <input type="number" step="0.001" name="quantidade" required className="input" />
          </Campo>
          {ehDiesel && (
            <Campo label={`${ARLA32} — quantidade (L, opcional)`}>
              <input type="number" step="0.001" name="arla_quantidade" className="input" />
            </Campo>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Lançar Abastecimento Interno"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
