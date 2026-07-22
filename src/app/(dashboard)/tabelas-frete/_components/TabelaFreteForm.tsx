"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarTabelaFrete, atualizarTabelaFrete } from "../actions";
import { UFS } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type TabelaFrete = Database["public"]["Tables"]["tabelas_frete"]["Row"];
type Faixa = { pesoMinKg: number; pesoMaxKg: number | null; valorPorKg: number; valorMinimo: number };

export type ParceiroOpcao = { id: string; razaoSocial: string; cnpjCpf: string };

// Fase P0.5 — formulário de Tabela de Frete, usado em /novo e /[id]
// (edição). Faixas de peso são uma lista dinâmica no client, serializada em
// JSON num campo hidden no submit — mesmo padrão de pedagios_json em
// PlanoViagemForm.tsx.
export function TabelaFreteForm({
  empresaId,
  tabela,
  faixasIniciais,
  parceiros,
}: {
  empresaId: string;
  tabela?: TabelaFrete;
  faixasIniciais?: Faixa[];
  parceiros: ParceiroOpcao[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [faixas, setFaixas] = useState<Faixa[]>(
    faixasIniciais && faixasIniciais.length > 0 ? faixasIniciais : [{ pesoMinKg: 0, pesoMaxKg: null, valorPorKg: 0, valorMinimo: 0 }]
  );

  function adicionarFaixa() {
    setFaixas((atual) => [...atual, { pesoMinKg: 0, pesoMaxKg: null, valorPorKg: 0, valorMinimo: 0 }]);
  }

  function removerFaixa(indice: number) {
    setFaixas((atual) => atual.filter((_, i) => i !== indice));
  }

  function atualizarFaixa(indice: number, campo: keyof Faixa, valor: string) {
    setFaixas((atual) =>
      atual.map((f, i) => {
        if (i !== indice) return f;
        if (campo === "pesoMaxKg") return { ...f, pesoMaxKg: valor.trim() === "" ? null : Number(valor) };
        return { ...f, [campo]: Number(valor) || 0 };
      })
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    formData.set("faixas_json", JSON.stringify(faixas));

    startTransition(async () => {
      const resultado = tabela
        ? await atualizarTabelaFrete(tabela.id, empresaId, undefined, formData)
        : await criarTabelaFrete(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome da tabela" required className="sm:col-span-2">
            <input name="nome" required defaultValue={tabela?.nome} placeholder="Ex: Tabela padrão 2026" className="input" />
          </Campo>
          <Campo label="Cliente-tomador">
            <select name="cliente_tomador_id" defaultValue={tabela?.cliente_tomador_id ?? ""} className="input">
              <option value="">Geral (qualquer cliente)</option>
              {parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razaoSocial} — {p.cnpjCpf}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Deixe &quot;Geral&quot; se esta tabela vale pra qualquer cliente. Só aparecem aqui os clientes-tomadores já
          cadastrados (ver emissão de CT-e).
        </p>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Rota (opcional)</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="UF origem">
            <select name="uf_origem" defaultValue={tabela?.uf_origem ?? ""} className="input">
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Cidade origem">
            <input name="cidade_origem" defaultValue={tabela?.cidade_origem ?? ""} className="input" />
          </Campo>
          <Campo label="UF destino">
            <select name="uf_destino" defaultValue={tabela?.uf_destino ?? ""} className="input">
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Cidade destino">
            <input name="cidade_destino" defaultValue={tabela?.cidade_destino ?? ""} className="input" />
          </Campo>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Deixe em branco se a tabela vale pra qualquer rota — só um jeito de organizar quando você tem uma tabela por
          corredor.
        </p>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Faixas de peso (frete-peso)</h2>
          <button type="button" onClick={adicionarFaixa} className="btn-secondary text-sm">
            + Faixa
          </button>
        </div>
        <div className="space-y-2">
          {faixas.map((f, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
              <Campo label="Peso mín. (kg)">
                <input
                  type="number"
                  step="0.01"
                  value={f.pesoMinKg}
                  onChange={(e) => atualizarFaixa(i, "pesoMinKg", e.target.value)}
                  className="input text-sm"
                />
              </Campo>
              <Campo label="Peso máx. (kg)">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Sem limite"
                  value={f.pesoMaxKg ?? ""}
                  onChange={(e) => atualizarFaixa(i, "pesoMaxKg", e.target.value)}
                  className="input text-sm"
                />
              </Campo>
              <Campo label="Valor / kg (R$)">
                <input
                  type="number"
                  step="0.01"
                  value={f.valorPorKg}
                  onChange={(e) => atualizarFaixa(i, "valorPorKg", e.target.value)}
                  className="input text-sm"
                />
              </Campo>
              <Campo label="Valor mínimo (R$)">
                <input
                  type="number"
                  step="0.01"
                  value={f.valorMinimo}
                  onChange={(e) => atualizarFaixa(i, "valorMinimo", e.target.value)}
                  className="input text-sm"
                />
              </Campo>
              <button
                type="button"
                onClick={() => removerFaixa(i)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Frete-peso = maior valor entre (peso da carga × valor/kg) e o valor mínimo da faixa que contém o peso.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Adicionais</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Campo label="Ad valorem (%)">
            <input type="number" step="0.01" name="percentual_ad_valorem" defaultValue={tabela?.percentual_ad_valorem ?? 0} className="input" />
          </Campo>
          <Campo label="GRIS (%)">
            <input type="number" step="0.01" name="percentual_gris" defaultValue={tabela?.percentual_gris ?? 0} className="input" />
          </Campo>
          <Campo label="ICMS por dentro (%)">
            <input type="number" step="0.01" name="percentual_icms" defaultValue={tabela?.percentual_icms ?? 0} className="input" />
          </Campo>
          <Campo label="TDE (R$)">
            <input type="number" step="0.01" name="valor_tde" defaultValue={tabela?.valor_tde ?? 0} className="input" />
          </Campo>
          <Campo label="TDA (R$)">
            <input type="number" step="0.01" name="valor_tda" defaultValue={tabela?.valor_tda ?? 0} className="input" />
          </Campo>
          <Campo label="Taxa de despacho (R$)">
            <input type="number" step="0.01" name="valor_despacho" defaultValue={tabela?.valor_despacho ?? 0} className="input" />
          </Campo>
          <Campo label="Pedágio estimado (R$)">
            <input type="number" step="0.01" name="valor_pedagio" defaultValue={tabela?.valor_pedagio ?? 0} className="input" />
          </Campo>
        </div>
      </section>

      <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
        {isPending ? "Salvando..." : tabela ? "Salvar alterações" : "Criar tabela de frete"}
      </button>
    </form>
  );
}

function Campo({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
