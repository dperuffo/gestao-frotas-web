"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarCliente, atualizarCliente } from "../actions";
import { CICLOS_COMBUSTIVEL, PORTES, SEGMENTOS_TRANSPORTE, STATUS_EMPRESA, STATUS_EMPRESA_LABEL } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

export function ClienteForm({ cliente, souAdmin }: { cliente?: Empresa; souAdmin?: boolean }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const volumeAtual = (cliente?.volume_potencial as Record<string, number>) ?? {};

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = cliente
        ? await atualizarCliente(cliente.id, undefined, formData)
        : await criarCliente(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Razão Social" required>
            <input name="nome" required defaultValue={cliente?.nome} className="input" />
          </Campo>
          <Campo label="CNPJ (alfanumérico)">
            <input name="cnpj" defaultValue={cliente?.cnpj ?? ""} className="input" placeholder="00.000.000/0001-00" />
          </Campo>
          <Campo label="Status">
            <select name="status" defaultValue={cliente?.status ?? "trial"} className="input">
              {STATUS_EMPRESA.map((s) => (
                <option key={s} value={s}>
                  {STATUS_EMPRESA_LABEL[s]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Porte da empresa">
            <select name="porte" defaultValue={cliente?.porte ?? ""} className="input">
              <option value="">Selecione...</option>
              {PORTES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Segmento de atuação">
            <select name="segmento_transporte" defaultValue={cliente?.segmento_transporte ?? ""} className="input">
              <option value="">Selecione...</option>
              {SEGMENTOS_TRANSPORTE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Endereço</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Logradouro" className="sm:col-span-2">
            <input name="logradouro" defaultValue={cliente?.logradouro ?? ""} className="input" />
          </Campo>
          <Campo label="Número">
            <input name="numero" defaultValue={cliente?.numero ?? ""} className="input" />
          </Campo>
          <Campo label="Complemento">
            <input name="complemento" defaultValue={cliente?.complemento ?? ""} className="input" />
          </Campo>
          <Campo label="Bairro">
            <input name="bairro" defaultValue={cliente?.bairro ?? ""} className="input" />
          </Campo>
          <Campo label="CEP">
            <input name="cep" defaultValue={cliente?.cep ?? ""} className="input" />
          </Campo>
          <Campo label="Município">
            <input name="municipio" defaultValue={cliente?.municipio ?? ""} className="input" />
          </Campo>
          <Campo label="UF">
            <input name="uf" maxLength={2} defaultValue={cliente?.uf ?? ""} className="input uppercase" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Contatos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Telefone de contato">
            <input name="telefone_contato" defaultValue={cliente?.telefone_contato ?? ""} className="input" />
          </Campo>
          <Campo label="E-mail de contato">
            <input type="email" name="email_contato" defaultValue={cliente?.email_contato ?? ""} className="input" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Volume potencial por ciclo de combustível</h2>
        <p className="mb-4 text-xs text-slate-500">Estimativa de litros/mês, usada como referência de potencial comercial.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CICLOS_COMBUSTIVEL.map((c) => (
            <Campo key={c.key} label={`${c.label} (Ciclo ${c.ciclo})`}>
              <input
                type="number"
                min={0}
                step="1"
                name={`volume_${c.key}`}
                defaultValue={volumeAtual[c.key] ?? 0}
                className="input"
              />
            </Campo>
          ))}
        </div>
      </section>

      {cliente && (
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Plano (somente leitura)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm text-slate-600">
            <div>Plano: <strong className="text-slate-900">{cliente.plano}</strong></div>
            <div>Máx. usuários: <strong className="text-slate-900">{cliente.max_usuarios ?? "—"}</strong></div>
            <div>Máx. veículos: <strong className="text-slate-900">{cliente.max_veiculos ?? "—"}</strong></div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Gerido pela assinatura (Stripe) — não editável por aqui.</p>

          {/* Fase 27.42 — só admin vê/edita: ignora o bloqueio de limite de
              frota (Fase 27.41) pra empresas de teste, sem inflar
              plano/max_veiculos (o que mascararia o comportamento real do
              plano nos testes). A checagem de quem pode gravar isso também
              é feita no servidor (atualizarCliente), não só aqui na tela. */}
          {souAdmin && (
            <label className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                name="bypass_limite_frota"
                defaultChecked={cliente.bypass_limite_frota}
                className="mt-0.5"
              />
              <span>
                <strong>Ignorar limite de veículos do plano</strong> — uso interno/teste. Libera a
                sincronização mesmo com a frota acima do limite, sem mudar o plano nem os números
                mostrados em Minha Assinatura.
              </span>
            </label>
          )}
        </section>
      )}

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
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
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
