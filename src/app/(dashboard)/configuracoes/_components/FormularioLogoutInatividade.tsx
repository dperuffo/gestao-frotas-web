"use client";

import { useState, useTransition } from "react";
import { atualizarLogoutInatividadeAcao } from "../actions";
import {
  LOGOUT_INATIVIDADE_MINUTOS_MIN,
  LOGOUT_INATIVIDADE_MINUTOS_MAX,
} from "@/lib/configuracoesSistema";

// Fase 27.86 — pedido do Daniel: "Implementar logout automatico por um
// período de inatividade do usuario no sistema. Parametrizavel em tela de
// configuração do admin". Este formulário edita esse único parâmetro —
// segue o mesmo espírito visual de FormularioCicloPagamento (Fase 27.80),
// mas sempre visível (é uma tela de configuração dedicada, não precisa do
// padrão "recolhido até clicar Editar").
export function FormularioLogoutInatividade({ minutosAtuais }: { minutosAtuais: number }) {
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card max-w-lg p-6">
      <h2 className="text-sm font-semibold text-slate-900">Logout automático por inatividade</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        Se um usuário ficar sem interagir com o sistema (sem mexer o mouse, digitar ou rolar a tela) por
        esse tempo, ele é desconectado automaticamente e precisa entrar de novo. Vale para todos os
        perfis (admin, gestor de frota, analista e posto) em todos os clientes.
      </p>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(undefined);
          setOk(false);
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            const resultado = await atualizarLogoutInatividadeAcao(formData);
            if (resultado?.erro) {
              setErro(resultado.erro);
              return;
            }
            setOk(true);
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tempo de inatividade (minutos)</label>
          <input
            type="number"
            name="logout_inatividade_minutos"
            required
            min={LOGOUT_INATIVIDADE_MINUTOS_MIN}
            max={LOGOUT_INATIVIDADE_MINUTOS_MAX}
            step="1"
            defaultValue={minutosAtuais}
            className="input w-28 text-sm"
          />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary text-sm">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        {ok && <span className="text-xs text-green-700">Salvo.</span>}
      </form>

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      <p className="mt-4 text-xs text-slate-400">
        Entre {LOGOUT_INATIVIDADE_MINUTOS_MIN} e {LOGOUT_INATIVIDADE_MINUTOS_MAX} minutos.
      </p>
    </div>
  );
}
