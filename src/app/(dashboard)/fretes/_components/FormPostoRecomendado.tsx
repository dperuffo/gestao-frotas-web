"use client";

import { useRef, useState, useTransition } from "react";
import { adicionarPostoRecomendadoAcao } from "../actions";

type ItemParceriaOpcao = { id: string; titulo: string; parceiro_nome: string | null };

export function FormPostoRecomendado({
  freteId,
  empresaId,
  itensParceria,
}: {
  freteId: string;
  empresaId: string;
  itensParceria: ItemParceriaOpcao[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await adicionarPostoRecomendadoAcao(freteId, empresaId, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-slate-500">Nome do posto</label>
        <input type="text" name="nome_posto" required placeholder='Ex.: "Posto Bandeirantes - km 320"' className="input text-sm" />
      </div>
      {itensParceria.length > 0 && (
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Vincular benefício (opcional)</label>
          <select name="item_catalogo_id" className="input text-sm">
            <option value="">Nenhum</option>
            {itensParceria.map((item) => (
              <option key={item.id} value={item.id}>
                {item.titulo}
                {item.parceiro_nome ? ` — ${item.parceiro_nome}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-slate-500">Observação</label>
        <input type="text" name="observacao" placeholder="Opcional" className="input text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="btn-secondary text-sm">
        {isPending ? "..." : "Adicionar"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
    </form>
  );
}
