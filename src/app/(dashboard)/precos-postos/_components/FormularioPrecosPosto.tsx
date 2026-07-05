"use client";

import { useState, useTransition, type FormEvent } from "react";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { formatarDataHoraBr } from "@/lib/utils";
import { salvarPrecosPostoAcao } from "../actions";

type PrecoAtual = {
  combustivel: string;
  preco: number;
  atualizado_em: string;
  atualizado_por: string | null;
  atualizado_por_nome: string | null;
};

export function FormularioPrecosPosto({
  empresaPostoId,
  precosAtuais,
}: {
  empresaPostoId: string;
  precosAtuais: PrecoAtual[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mapaAtual = new Map(precosAtuais.map((p) => [p.combustivel, p.preco]));
  // Fase 27.62 — data/hora + usuário (nome e e-mail) da última atualização
  // de cada combustível, exibido como legenda abaixo de cada campo.
  const mapaAuditoria = new Map(precosAtuais.map((p) => [p.combustivel, p]));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await salvarPrecosPostoAcao(empresaPostoId, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setSucesso(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Meus preços</h2>
      <p className="mb-4 text-xs text-slate-500">
        Deixe em branco o combustível que você não vende. Os clientes com quem você negocia veem
        estes preços — ajuda a embasar as propostas sem depender só da média da ANP.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Preços salvos.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUTOS_POSTO.map((produto) => {
          const auditoria = mapaAuditoria.get(produto);
          return (
            <label key={produto} className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">{produto} (R$/L)</span>
              <input
                type="number"
                step="0.001"
                min="0"
                name={`preco_${produto}`}
                defaultValue={mapaAtual.get(produto) ?? ""}
                placeholder="—"
                className="input"
              />
              {auditoria && (
                <span className="mt-1 block text-xs text-slate-400">
                  Atualizado em {formatarDataHoraBr(auditoria.atualizado_em)}
                  {auditoria.atualizado_por_nome && (
                    <>
                      {" "}
                      por {auditoria.atualizado_por_nome}
                      {auditoria.atualizado_por && auditoria.atualizado_por !== auditoria.atualizado_por_nome && (
                        <> ({auditoria.atualizado_por})</>
                      )}
                    </>
                  )}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar preços"}
        </button>
      </div>
    </form>
  );
}
