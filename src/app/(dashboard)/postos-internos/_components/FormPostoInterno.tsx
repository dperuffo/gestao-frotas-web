"use client";

import { useState, useTransition, type FormEvent } from "react";
import { salvarDadosPostoInternoAcao, salvarPrecosPostoInternoAcao } from "../actions";
import { COMBUSTIVEIS_POSTO_INTERNO, ARLA32 } from "@/lib/constants";

type PrecoExistente = { combustivel: string; preco: number };

export function FormPostoInterno({
  empresaId,
  postoInternoId,
  nome,
  ativo,
  precos,
}: {
  empresaId: string;
  postoInternoId: string;
  nome: string | null;
  ativo: boolean;
  precos: PrecoExistente[];
}) {
  const [mensagemDados, setMensagemDados] = useState<{ tipo: "erro" | "ok"; texto: string } | undefined>();
  const [mensagemPrecos, setMensagemPrecos] = useState<{ tipo: "erro" | "ok"; texto: string } | undefined>();
  const [isPendingDados, startDados] = useTransition();
  const [isPendingPrecos, startPrecos] = useTransition();

  const mapaPrecos = new Map(precos.map((p) => [p.combustivel, p.preco]));

  function handleSubmitDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagemDados(undefined);
    const formData = new FormData(e.currentTarget);
    startDados(async () => {
      const resultado = await salvarDadosPostoInternoAcao(undefined, formData);
      if (resultado?.erro) setMensagemDados({ tipo: "erro", texto: resultado.erro });
      else if (resultado?.ok) setMensagemDados({ tipo: "ok", texto: resultado.ok });
    });
  }

  function handleSubmitPrecos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagemPrecos(undefined);
    const formData = new FormData(e.currentTarget);
    startPrecos(async () => {
      const resultado = await salvarPrecosPostoInternoAcao(undefined, formData);
      if (resultado?.erro) setMensagemPrecos({ tipo: "erro", texto: resultado.erro });
      else if (resultado?.ok) setMensagemPrecos({ tipo: "ok", texto: resultado.ok });
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmitDados} className="card space-y-4 p-6">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="posto_interno_id" value={postoInternoId} />
        <h2 className="text-sm font-semibold text-slate-900">Posto interno</h2>
        <p className="text-xs text-slate-500">
          Representa a garagem/tanque próprio desta empresa. Enquanto estiver ativo, ele aparece como opção de
          empresa no app do motorista (aba Abastecimento Interno) e entra no cálculo de custo da Roteirização.
        </p>
        {mensagemDados && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              mensagemDados.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}
          >
            {mensagemDados.texto}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nome (opcional)</label>
            <input
              type="text"
              name="nome"
              defaultValue={nome ?? ""}
              placeholder="Ex.: Garagem Matriz, Pátio Filial SP..."
              className="input"
            />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ativo" defaultChecked={ativo} />
            Posto interno ativo
          </label>
        </div>
        <button type="submit" disabled={isPendingDados} className="btn-primary">
          {isPendingDados ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <form onSubmit={handleSubmitPrecos} className="card space-y-4 p-6">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="posto_interno_id" value={postoInternoId} />
        <h2 className="text-sm font-semibold text-slate-900">Preços por combustível</h2>
        <p className="text-xs text-slate-500">
          Preencha só os combustíveis realmente abastecidos aqui. O preço unitário informado é o que vale no
          abastecimento manual e no que o motorista confirma pelo app — ele nunca digita o preço.
        </p>
        {mensagemPrecos && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              mensagemPrecos.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}
          >
            {mensagemPrecos.texto}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Combustível</th>
                <th className="px-3 py-2">Preço (R$/litro ou R$/kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMBUSTIVEIS_POSTO_INTERNO.map((c) => (
                <tr key={c}>
                  <td className="px-3 py-2 text-slate-700">{c}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      name={`preco__${c}`}
                      defaultValue={mapaPrecos.get(c)?.toString() ?? ""}
                      placeholder="0,00"
                      className="input w-32"
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-50/40">
                <td className="px-3 py-2 font-medium text-slate-700">
                  {ARLA32} <span className="text-xs font-normal text-slate-400">(aditivo, junto do Diesel)</span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    name={`preco__${ARLA32}`}
                    defaultValue={mapaPrecos.get(ARLA32)?.toString() ?? ""}
                    placeholder="0,00"
                    className="input w-32"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button type="submit" disabled={isPendingPrecos} className="btn-primary">
          {isPendingPrecos ? "Salvando..." : "Salvar preços"}
        </button>
      </form>
    </div>
  );
}
