"use client";

import { useState, useTransition, type FormEvent } from "react";
import { lancarContaPagarAvulsaAcao } from "../actions";

// Fase Financeiro-ERP (26/07/2026) — lançamento manual de contas a pagar
// que não vêm de nenhuma integração (origem="avulso"), mesmo espírito de
// FormularioCustoFixo. A maioria das contas a pagar nasce sozinha via
// /api/integracoes/faturas-meio-pagamento — isto aqui é só o fallback pra
// quando ainda não existe integração com aquele credor.
export function FormularioContaPagarAvulsa({ empresaId }: { empresaId: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await lancarContaPagarAvulsaAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(resultado?.sucesso);
        (document.getElementById("form-conta-pagar-avulsa") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="form-conta-pagar-avulsa" onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="empresa_id" value={empresaId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Credor</label>
          <input type="text" name="credor_nome" required className="input" placeholder="Posto Alvorada" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
          <input type="number" name="valor_original" step="0.01" min={0.01} required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vencimento</label>
          <input type="date" name="vencimento" required className="input" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Descrição (opcional)</label>
        <input type="text" name="descricao" className="input" />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Lançar conta a pagar"}
      </button>
    </form>
  );
}
