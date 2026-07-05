"use client";

import { useState, useTransition, type FormEvent } from "react";
import { gerarChaveApiAcao } from "../actionsApiKeys";
import { CATALOGO_ESCOPOS } from "@/lib/apiKeys";

// Formulário genérico de geração de chave de API (Fase 25) — antes só
// gerava chave com o escopo fixo custos_fixos:write; agora o usuário marca
// quais permissões aquela chave específica vai ter, agrupadas por categoria
// (Pagamentos: o sistema externo empurra dados pra dentro da FNI;
// Cadastros: o sistema externo lê dados da FNI). Least privilege — uma
// chave só pedida pro que de fato vai ser usada.
const TODAS_CATEGORIAS = Array.from(new Set(CATALOGO_ESCOPOS.map((e) => e.categoria)));

export function FormularioNovaChaveCustosFixos({
  empresas,
  apenasCategorias,
}: {
  empresas: { id: string; nome: string }[];
  // Fase 27.53 — um posto (segmento Revenda) só tem motivo pra gerar chave
  // com escopo de Negociação; as demais categorias (Pagamentos, Cadastros)
  // são do lado Frota e não fazem sentido pra ele. Quando informado, só
  // essas categorias aparecem nos checkboxes.
  apenasCategorias?: string[];
}) {
  const CATEGORIAS = apenasCategorias
    ? TODAS_CATEGORIAS.filter((c) => apenasCategorias.includes(c))
    : TODAS_CATEGORIAS;
  const [erro, setErro] = useState<string | undefined>();
  const [chaveGerada, setChaveGerada] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setChaveGerada(undefined);
    const formData = new FormData(e.currentTarget);
    const empresaId = String(formData.get("empresa_id") ?? "");
    const nome = String(formData.get("nome") ?? "");
    const escopos = formData.getAll("escopos").map(String);
    const alvo = e.currentTarget;

    startTransition(async () => {
      const resultado = await gerarChaveApiAcao(empresaId, nome, escopos);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setChaveGerada(resultado.chave);
      alvo.reset();
    });
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Gerar chave de API</h2>
      <p className="mb-4 text-xs text-slate-500">
        Dê essa chave pro time técnico do cliente (ERP, cartão de combustível, corretora, oficina credenciada
        etc.) usar. Marque só as permissões que aquele sistema vai precisar.
      </p>

      {chaveGerada ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            Copie a chave agora — ela não será mostrada novamente.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-xs text-slate-800">
            {chaveGerada}
          </code>
          <button
            type="button"
            onClick={() => setChaveGerada(undefined)}
            className="mt-3 text-xs font-medium text-frota-600 hover:underline"
          >
            Ok, já copiei
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
              <select name="empresa_id" required className="input" defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Nome da chave</label>
              <input type="text" name="nome" required className="input" placeholder="Ex: Ticket Log — combustível" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Permissões desta chave</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CATEGORIAS.map((categoria) => (
                <div key={categoria} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{categoria}</p>
                  <div className="space-y-1.5">
                    {CATALOGO_ESCOPOS.filter((e) => e.categoria === categoria).map((e) => (
                      <label key={e.escopo} className="flex items-start gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="escopos" value={e.escopo} className="mt-0.5" />
                        <span>
                          <span className="font-medium text-slate-700">{e.label}</span> — {e.descricao}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Gerando..." : "Gerar chave"}
          </button>
        </form>
      )}

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
