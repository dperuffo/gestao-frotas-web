"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarCotacao } from "../actions";
import { CampoLocalFrete } from "../../fretes/_components/CampoLocalFrete";

export type TabelaFreteOpcao = { id: string; nome: string; clienteTomadorId: string | null };
export type ParceiroOpcao = { id: string; razaoSocial: string };
export type TipoCargaOpcao = { tipoCarga: string; numerosEixos: number[] };

export function CotacaoForm({
  empresaId,
  tabelas,
  parceiros,
  tiposCarga,
}: {
  empresaId: string;
  tabelas: TabelaFreteOpcao[];
  parceiros: ParceiroOpcao[];
  tiposCarga: TipoCargaOpcao[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [tabelaFreteId, setTabelaFreteId] = useState(tabelas[0]?.id ?? "");
  const [tipoCarga, setTipoCarga] = useState("");

  const tipoSelecionado = tiposCarga.find((t) => t.tipoCarga === tipoCarga);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarCotacao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  if (tabelas.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Você ainda não tem nenhuma tabela de frete ativa. Cadastre uma em{" "}
        <a href={`/tabelas-frete/novo?empresa=${empresaId}`} className="font-medium text-frota-600 hover:underline">
          Tabelas de Frete
        </a>{" "}
        antes de simular uma cotação.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Tabela de frete</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tabela<span className="text-red-500"> *</span>
            </label>
            <select
              name="tabela_frete_id"
              required
              value={tabelaFreteId}
              onChange={(e) => setTabelaFreteId(e.target.value)}
              className="input"
            >
              {tabelas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cliente-tomador</label>
            <select name="cliente_tomador_id" defaultValue="" className="input">
              <option value="">— não informar —</option>
              {parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-slate-900">Rota</h2>
        <CampoLocalFrete label="Origem" prefixo="origem" />
        <CampoLocalFrete label="Destino" prefixo="destino" />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Distância estimada (km)</label>
          <input name="km_estimado" type="number" step="0.1" className="input" placeholder="Opcional — usada no alerta de piso ANTT" />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Carga</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Peso da carga (kg)<span className="text-red-500"> *</span>
            </label>
            <input name="peso_kg" type="number" step="0.01" required className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valor da carga / NF (R$)</label>
            <input name="valor_carga" type="number" step="0.01" defaultValue={0} className="input" />
            <p className="mt-1 text-xs text-slate-500">Base do ad valorem e do GRIS.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de carga (piso ANTT)</label>
            <select name="tipo_carga" value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)} className="input">
              <option value="">— não informar —</option>
              {tiposCarga.map((t) => (
                <option key={t.tipoCarga} value={t.tipoCarga}>
                  {t.tipoCarga}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nº de eixos (piso ANTT)</label>
            <select name="numero_eixos" defaultValue="" className="input" disabled={!tipoSelecionado}>
              <option value="">—</option>
              {(tipoSelecionado?.numerosEixos ?? []).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tipo de carga + nº de eixos + distância estimada juntos habilitam o alerta de piso mínimo ANTT.
        </p>
      </section>

      <section className="card p-6">
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="observacoes" rows={2} className="input" />
      </section>

      <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
        {isPending ? "Calculando..." : "Simular e salvar cotação"}
      </button>
    </form>
  );
}
