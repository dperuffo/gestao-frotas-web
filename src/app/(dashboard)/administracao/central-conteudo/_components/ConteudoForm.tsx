"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarConteudoAcao, atualizarConteudoAcao } from "../actions";
import { PERFIS, PERFIL_LABEL } from "@/lib/constants";
import { urlImagemTreinamento } from "@/lib/ajuda/imagemTreinamento";
import type { Database } from "@/types/database.types";

type ConteudoAjuda = Database["public"]["Tables"]["conteudo_ajuda"]["Row"];

// Sugestões de módulo — os mesmos grupos usados no tour de boas-vindas
// (src/lib/ajuda/tourPassos.ts) e pretendidos pra Central de Treinamento.
// É só sugestão (datalist), o campo aceita qualquer texto — não é enum no
// banco de propósito, pra não travar a criação de um módulo novo.
const MODULOS_SUGERIDOS = [
  "Dashboard",
  "Financeiro",
  "Assistente FNI",
  "Cadastros",
  "Operação",
  "Administração",
  "Integrações",
  "Assinatura",
  "Posto — Dashboard",
  "Posto — Negociações",
  "Posto — Clientes",
  "Posto — Meus Preços",
  "Posto — Financeiro",
  "Posto — Integrações",
];

export function ConteudoForm({ conteudo }: { conteudo?: ConteudoAjuda }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(conteudo?.tipo ?? "contextual");
  const urlAtual = urlImagemTreinamento(conteudo?.imagem_path ?? null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = conteudo
        ? await atualizarConteudoAcao(conteudo.id, undefined, formData)
        : await criarConteudoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Tipo" required>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
              <option value="contextual">Ajuda contextual (ícone &quot;?&quot;)</option>
              <option value="licao">Lição da Central de Treinamento</option>
            </select>
          </Campo>
          <Campo label="Chave (única)" required>
            <input
              name="chave"
              required
              defaultValue={conteudo?.chave}
              placeholder="ex.: dashboard.custo_total"
              className="input font-mono text-xs"
            />
          </Campo>
          <Campo label="Módulo" hint="Agrupamento — usado sobretudo nas lições da Central de Treinamento">
            <input name="modulo" defaultValue={conteudo?.modulo ?? ""} list="modulos-sugeridos" className="input" />
            <datalist id="modulos-sugeridos">
              {MODULOS_SUGERIDOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Ordem" hint="Define a posição dentro do módulo (menor aparece primeiro)">
            <input name="ordem" type="number" defaultValue={conteudo?.ordem ?? 0} className="input" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Conteúdo</h2>
        <div className="space-y-4">
          <Campo label="Título" required>
            <input name="titulo" required defaultValue={conteudo?.titulo} className="input" />
          </Campo>
          <Campo
            label="Texto"
            required
            hint={
              tipo === "contextual"
                ? "1 a 3 frases — aparece no popover pequeno do ícone \"?\""
                : "Pode ser mais longo — aparece na página da lição, na Central de Treinamento"
            }
          >
            <textarea name="texto" required defaultValue={conteudo?.texto} rows={tipo === "licao" ? 10 : 3} className="input" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Imagem (opcional)</h2>
        {urlAtual && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem de storage dinâmica, sem domínio fixo pra next/image */}
            <img src={urlAtual} alt="Imagem atual" className="max-h-48 rounded-lg border border-slate-200" />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="remover_imagem" className="rounded border-slate-300" />
              Remover esta imagem
            </label>
          </div>
        )}
        <Campo label={urlAtual ? "Substituir por outra imagem" : "Enviar screenshot"}>
          <input type="file" name="imagem" accept="image/*" className="input" />
        </Campo>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Visibilidade</h2>
            <p className="mt-1 text-xs text-slate-500">Deixe todos desmarcados pra aparecer pra qualquer perfil.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {PERFIS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="perfis"
                value={p}
                defaultChecked={conteudo?.perfis?.includes(p) ?? false}
                className="rounded border-slate-300"
              />
              {PERFIL_LABEL[p]}
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="ativo" defaultChecked={conteudo?.ativo ?? true} className="rounded border-slate-300" />
          Ativo (visível para os usuários)
        </label>
      </section>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
