"use client";

import { useState, useTransition } from "react";
import { salvarDadosFiscaisAcao } from "../actions";

// Fase P0.1 — formulário dos dados fiscais do emitente. Mesmo padrão de
// FormularioLogoutInatividade (useTransition + Server Action retornando
// { erro?, ok? }).

type DadosAtuais = {
  inscricao_estadual: string | null;
  rntrc: string | null;
  regime_tributario: string;
  serie_cte: number;
  serie_mdfe: number;
  ambiente: string;
  provedor: string;
} | null;

export function FormularioFiscal({ empresaId, dados }: { empresaId: string; dados: DadosAtuais }) {
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Dados fiscais do emitente</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        Informações usadas na emissão de CT-e/MDF-e. O CNPJ e a razão social vêm do cadastro de Clientes;
        aqui entram os dados específicos de emissão.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErro(undefined);
          setOk(undefined);
          const formData = new FormData(e.currentTarget);
          formData.set("empresa_id", empresaId);
          startTransition(async () => {
            const resultado = await salvarDadosFiscaisAcao(formData);
            if (resultado?.erro) setErro(resultado.erro);
            else setOk(resultado?.ok ?? "Salvo.");
          });
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Inscrição Estadual</label>
          <input name="inscricao_estadual" defaultValue={dados?.inscricao_estadual ?? ""} className="input w-full text-sm" placeholder="Somente números, ou ISENTO" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">RNTRC (registro ANTT)</label>
          <input name="rntrc" defaultValue={dados?.rntrc ?? ""} className="input w-full text-sm" placeholder="8 dígitos" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Regime tributário</label>
          <select name="regime_tributario" defaultValue={dados?.regime_tributario ?? "simples"} className="input w-full text-sm">
            <option value="simples">Simples Nacional</option>
            <option value="presumido">Lucro Presumido</option>
            <option value="real">Lucro Real</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Série do CT-e</label>
          <input type="number" name="serie_cte" min={1} step={1} defaultValue={dados?.serie_cte ?? 1} className="input w-full text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Série do MDF-e</label>
          <input type="number" name="serie_mdfe" min={1} step={1} defaultValue={dados?.serie_mdfe ?? 1} className="input w-full text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ambiente</label>
          <select name="ambiente" defaultValue={dados?.ambiente ?? "homologacao"} className="input w-full text-sm">
            <option value="homologacao">Homologação (testes, sem valor fiscal)</option>
            <option value="producao">Produção</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Provedor fiscal</label>
          <select name="provedor" defaultValue={dados?.provedor ?? "mock"} className="input w-full text-sm">
            <option value="mock">Simulador (testes — sem SEFAZ)</option>
            <option value="focusnfe">Focus NFe (disponível na Fase P0.2)</option>
            <option value="plugnotas">PlugNotas (disponível na Fase P0.2)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={isPending} className="btn-primary text-sm">
            {isPending ? "Salvando..." : "Salvar dados fiscais"}
          </button>
        </div>
      </form>

      {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}
      {ok && <p className="mt-3 text-xs text-green-700">{ok}</p>}
    </div>
  );
}
