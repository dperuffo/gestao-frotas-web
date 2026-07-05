"use client";

import { useState, useTransition, type FormEvent } from "react";
import { solicitarAjusteAcao, contrapropostaAjusteAcao } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";
import type { AutorAjuste } from "@/lib/ajustesAbastecimentos";

type ValoresAjuste = {
  data_abastecimento: string | null;
  hodometro: number | null;
  item_nome: string | null;
  item_quantidade: number | null;
  item_valor_unitario: number | null;
  item_valor_total: number | null;
};

// Fase 27.65 — formulário de solicitação de ajuste (ou contraproposta,
// quando `ajusteId` é passado). Todo campo vem em branco por padrão — o
// solicitante só preenche o(s) campo(s) que quer corrigir; os demais ficam
// como estão (ver validarCamposAjuste em ajustesAbastecimentos.ts: pelo
// menos 1 precisa vir preenchido). Os valores ATUAIS aparecem como
// placeholder/legenda, só pra referência de quem está preenchendo.
export function FormularioSolicitarAjuste({
  abastecimentoId,
  empresaClienteId,
  empresaPostoId,
  autor,
  valoresAtuais,
  ajusteIdParaContraproposta,
}: {
  abastecimentoId: number;
  empresaClienteId: string;
  empresaPostoId: string;
  autor: AutorAjuste;
  valoresAtuais: ValoresAjuste;
  ajusteIdParaContraproposta?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [aberto, setAberto] = useState(!!ajusteIdParaContraproposta);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = ajusteIdParaContraproposta
        ? await contrapropostaAjusteAcao(ajusteIdParaContraproposta, abastecimentoId, autor, undefined, formData)
        : await solicitarAjusteAcao(abastecimentoId, empresaClienteId, empresaPostoId, autor, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else if (!ajusteIdParaContraproposta) setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary">
        Solicitar ajuste
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-slate-900">
        {ajusteIdParaContraproposta ? "Enviar contraproposta" : "Solicitar ajuste"}
      </h2>
      <p className="text-xs text-slate-500">
        Preencha só o(s) campo(s) que precisa corrigir — os demais continuam como estão. A outra parte
        (cliente ou posto) vai receber uma notificação para aprovar ou recusar.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo label="Data e hora" atual={valoresAtuais.data_abastecimento ? new Date(valoresAtuais.data_abastecimento).toLocaleString("pt-BR") : "—"}>
          <input type="datetime-local" name="data_abastecimento" className="input" />
        </Campo>
        <Campo label="Hodômetro (km)" atual={valoresAtuais.hodometro?.toLocaleString("pt-BR") ?? "—"}>
          <input type="number" name="hodometro" className="input" />
        </Campo>
        <Campo label="Combustível" atual={valoresAtuais.item_nome ?? "—"}>
          <select name="item_nome" defaultValue="" className="input">
            <option value="">Sem alteração</option>
            {PRODUTOS_POSTO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Litros" atual={valoresAtuais.item_quantidade?.toLocaleString("pt-BR") ?? "—"}>
          <input type="number" step="0.001" name="item_quantidade" className="input" />
        </Campo>
        <Campo
          label="Preço por litro (R$)"
          atual={valoresAtuais.item_valor_unitario != null ? valoresAtuais.item_valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
        >
          <input type="number" step="0.01" name="item_valor_unitario" className="input" />
        </Campo>
        <Campo
          label="Valor total (R$)"
          atual={valoresAtuais.item_valor_total != null ? valoresAtuais.item_valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
        >
          <input type="number" step="0.01" name="item_valor_total" className="input" />
        </Campo>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Motivo (opcional)</label>
        <textarea name="motivo" rows={2} className="input" placeholder="Ex: litros digitados errado, deveria ser 45L" />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2">
        {!ajusteIdParaContraproposta && (
          <button type="button" onClick={() => setAberto(false)} className="btn-secondary">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Enviando..." : ajusteIdParaContraproposta ? "Enviar contraproposta" : "Enviar solicitação"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, atual, children }: { label: string; atual: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label} <span className="text-slate-400">(atual: {atual})</span>
      </label>
      {children}
    </div>
  );
}
