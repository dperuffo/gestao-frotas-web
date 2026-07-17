"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarItemCatalogo, atualizarItemCatalogo } from "../actions";

type ItemExistente = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  parceiro_nome: string | null;
  pontos_necessarios: number;
  ativo: boolean;
};

const CATEGORIAS = [
  { valor: "economia_imediata", label: "Economia Imediata" },
  { valor: "marketplace_cabine", label: "Marketplace da Cabine" },
  { valor: "saude_estrada", label: "Saúde na Estrada" },
  { valor: "universidade_estrada", label: "Universidade da Estrada" },
  { valor: "clube_caminhao", label: "Clube do Caminhão" },
  { valor: "volte_para_casa", label: "Volte para Casa" },
] as const;

export function ItemCatalogoForm({ item }: { item?: ItemExistente }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = item
        ? await atualizarItemCatalogo(item.id, undefined, formData)
        : await criarItemCatalogo(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados do item</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Título" required>
            <input
              type="text"
              name="titulo"
              required
              defaultValue={item?.titulo ?? ""}
              placeholder='Ex.: "10% de desconto em pneus"'
              className="input"
            />
          </Campo>
          <Campo label="Categoria" required>
            <select name="categoria" required defaultValue={item?.categoria ?? CATEGORIAS[0].valor} className="input">
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Parceiro (nome fictício/placeholder)">
            <input
              type="text"
              name="parceiro_nome"
              defaultValue={item?.parceiro_nome ?? ""}
              placeholder='Ex.: "Rede Pneus Brasil" (simulado)'
              className="input"
            />
          </Campo>
          <Campo label="Pontos necessários" required>
            <input
              type="number"
              min="1"
              step="1"
              name="pontos_necessarios"
              required
              defaultValue={item?.pontos_necessarios ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Descrição">
            <textarea
              name="descricao"
              rows={3}
              defaultValue={item?.descricao ?? ""}
              className="input sm:col-span-2"
            />
          </Campo>
        </div>

        {item && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ativo" defaultChecked={item.ativo} className="h-4 w-4 rounded border-slate-300" />
            Item visível/resgatável no app
          </label>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : item ? "Salvar alterações" : "Salvar item"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
