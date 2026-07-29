"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarMultaAcao } from "../actions";

export function NovaMultaForm({ empresaId, placas }: { empresaId: string; placas: string[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarMultaAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else router.push(`/multas?empresa=${empresaId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Placa <span className="text-red-500">*</span>
          </label>
          <input list="placas-multa" name="placa" required className="input" placeholder="ABC1D23" />
          <datalist id="placas-multa">
            {placas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data da infração <span className="text-red-500">*</span>
          </label>
          <input type="date" name="data_infracao" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Prazo p/ indicação / desconto
          </label>
          <input type="date" name="data_limite_indicacao" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nº do AIT</label>
          <input name="numero_ait" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Órgão autuador</label>
          <input name="orgao_autuador" className="input" placeholder="DETRAN-SP, PRF..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Local da infração</label>
          <input name="local_infracao" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Gravidade</label>
          <select name="gravidade" className="input" defaultValue="">
            <option value="">Selecione...</option>
            <option value="leve">Leve</option>
            <option value="media">Média</option>
            <option value="grave">Grave</option>
            <option value="gravissima">Gravíssima</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Pontos na CNH</label>
          <input type="number" name="pontos" min={0} max={20} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Valor original (R$)</label>
          <input type="number" name="valor_original" min={0} step="0.01" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Valor c/ desconto (R$)</label>
          <input type="number" name="valor_desconto" min={0} step="0.01" className="input" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descrição da infração</label>
        <input name="descricao" className="input" placeholder="Ex.: Excesso de velocidade até 20%" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="observacoes" rows={3} className="input" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Anexo da notificação <span className="font-normal text-slate-400">(opcional — PDF ou foto)</span>
        </label>
        <input type="file" name="anexo" accept="image/*,.pdf" className="input" />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Registrar Multa"}
        </button>
      </div>
    </form>
  );
}
