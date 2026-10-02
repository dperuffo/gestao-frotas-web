"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { FORMAS_PAGAMENTO_PDV, ROTULOS_FORMA_PAGAMENTO_PDV, type FormaPagamentoPdv } from "@/lib/formasPagamentoPdv";
import { salvarFormaPagamentoPdvAcao } from "../actions";

// Fase 4 PDV (02/10/2026) — lista de toggles, um por forma de pagamento,
// mesmo markup de switch usado em SecaoPrePedido.tsx (parametros-uso) e
// ToggleStatusVinculo.tsx. Estado otimista local (useState inicializado do
// servidor) pra feedback imediato no clique, sem esperar o revalidatePath;
// se a Server Action falhar, reverte.
export function ListaFormasPagamentoPdv({
  empresaId,
  ativasIniciais,
}: {
  empresaId: string;
  ativasIniciais: Partial<Record<FormaPagamentoPdv, boolean>>;
}) {
  const [ativas, setAtivas] = useState(ativasIniciais);
  const [pendente, setPendente] = useState<FormaPagamentoPdv | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternar(forma: FormaPagamentoPdv) {
    const novoValor = !ativas[forma];
    setAtivas((atual) => ({ ...atual, [forma]: novoValor }));
    setPendente(forma);
    startTransition(async () => {
      const resultado = await salvarFormaPagamentoPdvAcao(empresaId, forma, novoValor);
      if (resultado?.erro) {
        // Reverte em caso de erro — mesma estratégia defensiva de outras
        // telas de toggle do app (ex.: ToggleStatusVinculo).
        setAtivas((atual) => ({ ...atual, [forma]: !novoValor }));
      }
      setPendente(null);
    });
  }

  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-700">
      {FORMAS_PAGAMENTO_PDV.map((forma) => {
        const ativo = ativas[forma] === true;
        const estaSalvando = isPending && pendente === forma;
        return (
          <div key={forma} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {ROTULOS_FORMA_PAGAMENTO_PDV[forma]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => alternar(forma)}
              disabled={estaSalvando}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                ativo ? "bg-frota-600" : "bg-slate-300 dark:bg-slate-600"
              }`}
              aria-pressed={ativo}
              aria-label={`${ativo ? "Desativar" : "Ativar"} ${ROTULOS_FORMA_PAGAMENTO_PDV[forma]} no PDV`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  ativo ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
