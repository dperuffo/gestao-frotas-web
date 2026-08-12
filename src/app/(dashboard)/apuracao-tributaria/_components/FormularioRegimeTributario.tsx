"use client";

import { useActionState } from "react";
import { atualizarRegimeTributarioAcao, type RegimeFormState } from "../actions";

// Fase Apuracao-ICMS-Combustivel (12/08/2026) — pedido do Daniel: "O regime
// tributario deve ser preenchido pelo cliente para o calculo da apuracao".
// Sem regime "normal" (RPA) confirmado + elegibilidade marcada, a apuração
// abaixo fica em modo informativo (mostra o que a NF-e já traz, mas não
// soma como "crédito seu") — ver comentário grande na migration sobre por
// que essas 2 confirmações importam (Simples Nacional não tem direito a
// crédito; mesmo no regime normal, só quem presta serviço de transporte
// tributado por ICMS e não optou por crédito outorgado tem direito real).
export function FormularioRegimeTributario({
  empresaId,
  regimeAtual,
  elegivelAtual,
}: {
  empresaId: string;
  regimeAtual: string | null;
  elegivelAtual: boolean | null;
}) {
  const acaoComEmpresa = atualizarRegimeTributarioAcao.bind(null, empresaId);
  const [estado, formAction, isPending] = useActionState<RegimeFormState, FormData>(acaoComEmpresa, undefined);

  return (
    <form action={formAction} className="card p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Dados fiscais da sua empresa</h2>
      <p className="mb-4 text-xs text-slate-500">
        Usados só pra calcular a apuração abaixo — confirme com o seu contador se tiver dúvida.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Regime tributário</label>
          <select name="regime_tributario" defaultValue={regimeAtual ?? ""} required className="input text-sm">
            <option value="" disabled>
              Selecione...
            </option>
            <option value="normal">Regime normal (RPA / Lucro Presumido ou Real)</option>
            <option value="simples_nacional">Simples Nacional</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              name="elegivel_credito_icms_combustivel"
              defaultChecked={elegivelAtual ?? false}
              className="mt-0.5"
            />
            <span>
              Minha empresa presta serviço de transporte tributado por ICMS (ou isento com manutenção de crédito) e{" "}
              <strong>não</strong> é optante pelo regime de crédito outorgado.
            </span>
          </label>
        </div>
      </div>

      {estado?.erro && <p className="mt-3 text-sm text-red-600">{estado.erro}</p>}
      {estado?.sucesso && <p className="mt-3 text-sm text-status-ativo">Dados salvos.</p>}

      <button type="submit" disabled={isPending} className="btn-primary mt-4 text-sm">
        {isPending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
