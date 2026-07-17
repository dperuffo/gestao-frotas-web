"use client";

import { useState, useTransition, type FormEvent } from "react";
import { queimarVoucher } from "../actions";

// Pedido do Daniel (17/07): "o voucher precisa ter um código para ser
// queimado". Antes, o posto/cliente marcava "Concluído" direto num
// dropdown, sem checar nada — agora a baixa final passa por aqui: digita o
// código que o motorista mostra no app, o servidor confere dono/status/
// validade antes de marcar como entregue (ver queimarVoucher em actions.ts).
export function QueimarVoucherForm({ empresaId }: { empresaId: string }) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const resultado = await queimarVoucher(empresaId, undefined, formData);
      if (resultado?.erro) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      } else if (resultado?.sucesso) {
        setMensagem({
          tipo: "sucesso",
          texto: `Voucher queimado: "${resultado.sucesso.titulo}" — ${resultado.sucesso.motorista}.`,
        });
        form.reset();
      }
    });
  }

  return (
    <div className="card mb-6 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">🔥 Queimar voucher</h2>
      <p className="mb-3 text-xs text-slate-500">
        Digite o código que o motorista mostra no app pra confirmar a entrega do benefício e dar baixa.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="codigo"
          required
          placeholder="Ex.: EQC-A1B2C3D4"
          className="input flex-1 font-mono uppercase"
        />
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Verificando..." : "Queimar"}
        </button>
      </form>
      {mensagem && (
        <p className={`mt-3 text-sm font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
