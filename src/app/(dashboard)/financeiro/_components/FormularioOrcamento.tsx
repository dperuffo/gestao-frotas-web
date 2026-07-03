"use client";

import { useState, useTransition, type FormEvent } from "react";
import { salvarOrcamentoAcao } from "../actions";
import { CATEGORIAS_ORCAMENTO, CATEGORIA_ORCAMENTO_LABEL, NOMES_MES } from "@/lib/financeiro";

export function FormularioOrcamento({
  empresaId,
  centrosCusto,
}: {
  empresaId: string;
  centrosCusto: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await salvarOrcamentoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setSucesso(resultado?.sucesso);
    });
  }

  const agora = new Date();

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="empresa_id" value={empresaId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
          <select name="categoria" className="input" defaultValue="geral">
            {CATEGORIAS_ORCAMENTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_ORCAMENTO_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Centro de custo</label>
          <select name="centro_custo_id" className="input" defaultValue="">
            <option value="">Toda a empresa</option>
            {centrosCusto.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Mês</label>
          <select name="mes" className="input" defaultValue={agora.getMonth() + 1}>
            {NOMES_MES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ano</label>
          <input type="number" name="ano" className="input" defaultValue={agora.getFullYear()} min={2020} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Valor planejado (R$)</label>
        <input type="number" name="valor_planejado" step="0.01" min={0} required className="input" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Observações (opcional)</label>
        <input type="text" name="observacoes" className="input" />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Salvar orçamento"}
      </button>
    </form>
  );
}
