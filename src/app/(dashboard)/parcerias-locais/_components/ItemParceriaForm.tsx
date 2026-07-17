"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { criarItemParceria, atualizarItemParceria, CATEGORIAS_FIDELIDADE } from "../actions";

type ItemExistente = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  parceiro_nome: string | null;
  pontos_necessarios: number;
  ativo: boolean;
  imagem_url: string | null;
  validade_dias: number | null;
};

export function ItemParceriaForm({ empresaId, item }: { empresaId: string; item?: ItemExistente }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(item?.imagem_url ?? null);

  function handleImagemChange(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) setPreview(URL.createObjectURL(arquivo));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = item
        ? await atualizarItemParceria(item.id, empresaId, undefined, formData)
        : await criarItemParceria(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados do benefício</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Título" required>
            <input
              type="text"
              name="titulo"
              required
              defaultValue={item?.titulo ?? ""}
              placeholder='Ex.: "Vale-almoço no restaurante do posto"'
              className="input"
            />
          </Campo>
          <Campo label="Categoria" required>
            <select name="categoria" required defaultValue={item?.categoria ?? CATEGORIAS_FIDELIDADE[0].valor} className="input">
              {CATEGORIAS_FIDELIDADE.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Nome do parceiro/estabelecimento">
            <input
              type="text"
              name="parceiro_nome"
              defaultValue={item?.parceiro_nome ?? ""}
              placeholder='Ex.: "Restaurante do Posto Bandeirantes"'
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
          <Campo label="Validade do voucher (dias após o resgate)">
            <input
              type="number"
              min="1"
              step="1"
              name="validade_dias"
              defaultValue={item?.validade_dias ?? ""}
              placeholder="Deixe em branco pra sem validade"
              className="input"
            />
          </Campo>
          <Campo label="Imagem do benefício">
            <input type="file" name="imagem" accept="image/*" onChange={handleImagemChange} className="input" />
          </Campo>
          <Campo label="Descrição">
            <textarea name="descricao" rows={3} defaultValue={item?.descricao ?? ""} className="input sm:col-span-2" />
          </Campo>
        </div>

        {preview && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-slate-500">Pré-visualização</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Pré-visualização" className="h-32 w-48 rounded-lg border border-slate-200 object-cover" />
          </div>
        )}

        {item && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ativo" defaultChecked={item.ativo} className="h-4 w-4 rounded border-slate-300" />
            Benefício visível/resgatável no app
          </label>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : item ? "Salvar alterações" : "Salvar benefício"}
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
