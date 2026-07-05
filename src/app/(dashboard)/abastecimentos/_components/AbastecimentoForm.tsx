"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarAbastecimento, atualizarAbastecimento } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Abastecimento = Database["public"]["Tables"]["profrotas_abastecimentos"]["Row"];
type EmpresaOpcao = { id: string; nome: string };

// Formata um timestamp ISO para o formato que o <input type="datetime-local"> espera.
function paraDatetimeLocal(valor: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export function AbastecimentoForm({
  abastecimento,
  empresas,
  nomeEmpresaAtual,
}: {
  abastecimento?: Abastecimento;
  empresas: EmpresaOpcao[];
  nomeEmpresaAtual?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = abastecimento
        ? await atualizarAbastecimento(abastecimento.id, undefined, formData)
        : await criarAbastecimento(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {!abastecimento && (
        <div className="rounded-lg bg-frota-50 px-3 py-2 text-sm text-frota-700">
          Use este formulário só para lançamentos manuais (clientes sem integração automática
          com o meio de pagamento) ou para corrigir um registro pontual. Os abastecimentos de
          clientes com integração (ex: PróFrotas) chegam automaticamente.
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Abastecimento</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Data e hora">
            <input
              type="datetime-local"
              name="data_abastecimento"
              defaultValue={paraDatetimeLocal(abastecimento?.data_abastecimento ?? null)}
              className="input"
            />
          </Campo>
          <Campo label="Placa do veículo">
            <input name="veiculo_placa" defaultValue={abastecimento?.veiculo_placa ?? ""} className="input" />
          </Campo>
          <Campo label="Motorista">
            <input name="motorista_nome" defaultValue={abastecimento?.motorista_nome ?? ""} className="input" />
          </Campo>
          <Campo label="Hodômetro (km)">
            <input type="number" name="hodometro" defaultValue={abastecimento?.hodometro ?? ""} className="input" />
          </Campo>
          <Campo label="Produto">
            <select name="item_nome" defaultValue={abastecimento?.item_nome ?? ""} className="input">
              <option value="">Selecione...</option>
              {abastecimento?.item_nome && !PRODUTOS_POSTO.includes(abastecimento.item_nome as (typeof PRODUTOS_POSTO)[number]) && (
                <option value={abastecimento.item_nome}>{abastecimento.item_nome}</option>
              )}
              {PRODUTOS_POSTO.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Litros">
            <input
              type="number"
              step="0.001"
              name="item_quantidade"
              defaultValue={abastecimento?.item_quantidade ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Preço por litro (R$)">
            <input
              type="number"
              step="0.01"
              name="item_valor_unitario"
              defaultValue={abastecimento?.item_valor_unitario ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Valor total (R$)">
            <input
              type="number"
              step="0.01"
              name="item_valor_total"
              defaultValue={abastecimento?.item_valor_total ?? ""}
              className="input"
            />
          </Campo>
          {!abastecimento && (
            <Campo label="Cliente" required>
              <select name="empresa_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Selecione o cliente...
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Posto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Nome do posto">
            <input name="pv_razao_social" defaultValue={abastecimento?.pv_razao_social ?? ""} className="input" />
          </Campo>
          <Campo label="Município">
            <input name="pv_municipio" defaultValue={abastecimento?.pv_municipio ?? ""} className="input" />
          </Campo>
          <Campo label="UF">
            <input name="pv_uf" maxLength={2} defaultValue={abastecimento?.pv_uf ?? ""} className="input" />
          </Campo>
        </div>

        {abastecimento && nomeEmpresaAtual && (
          <p className="mt-4 text-xs text-slate-500">Cliente: {nomeEmpresaAtual} (não pode ser alterado aqui).</p>
        )}
        {abastecimento && (
          <p className="mt-1 text-xs text-slate-500">
            Identificador: {abastecimento.identificador} · Origem:{" "}
            {
              // Fase 27.55 — o robô de teste (negociação com postos) também
              // grava aqui, usando o mesmo identificador negativo do
              // lançamento manual (só pra não colidir com IDs reais da
              // integração) — dá pra diferenciar pelo prefixo do sync_key.
              abastecimento.sync_key?.startsWith("robo-")
                ? "robô de teste (simulado)"
                : abastecimento.identificador < 0
                  ? "lançamento manual"
                  : "integração automática"
            }
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : abastecimento ? "Salvar alterações" : "Lançar Abastecimento"}
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
