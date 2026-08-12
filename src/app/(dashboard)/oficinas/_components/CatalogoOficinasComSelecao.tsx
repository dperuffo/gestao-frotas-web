"use client";

import { useState, useTransition, type FormEvent } from "react";
import { solicitarOrcamentoMultiAcao } from "../actions";

// Fase marketplace-pecas (04/08/2026, item 7 do benchmark FNI vs KMM,
// Grupo 2: "Evoluir Rede de Oficinas para marketplace de peças") —
// substitui o antigo botão "Solicitar orçamento" por card (1 oficina por
// vez) por uma seleção multi-card: o cliente marca quantas oficinas
// quiser, e 1 pedido só sai pra todas de uma vez. Precisa ser um único
// componente client (não dá pra ter estado de seleção compartilhado entre
// vários cards de Server Component) — por isso o grid inteiro do catálogo
// mora aqui agora, não em page.tsx.
type Oficina = {
  id: string;
  nome: string;
  especialidades: string[];
  telefone: string | null;
  email: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacao_media: number | null;
};

export function CatalogoOficinasComSelecao({
  oficinas,
  empresaId,
  placas,
}: {
  oficinas: Oficina[];
  empresaId: string | null;
  placas: string[];
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function alternar(id: string) {
    setSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId) return;
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await solicitarOrcamentoMultiAcao(empresaId, Array.from(selecionadas), undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(true);
        setTimeout(() => {
          setSucesso(false);
          setModalAberto(false);
          setSelecionadas(new Set());
        }, 1200);
      }
    });
  }

  const oficinasSelecionadas = oficinas.filter((o) => selecionadas.has(o.id));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {oficinas.map((o) => (
          <label
            key={o.id}
            className={`card cursor-pointer p-4 transition hover:border-frota-300 ${selecionadas.has(o.id) ? "ring-2 ring-frota-500" : ""} ${!empresaId ? "cursor-default" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{o.nome}</p>
                <p className="text-xs text-slate-500">
                  {[o.municipio, o.uf].filter(Boolean).join(" / ") || "—"}
                  {o.avaliacao_media != null && ` · ⭐ ${o.avaliacao_media.toFixed(1)}`}
                </p>
              </div>
              {empresaId && (
                <input
                  type="checkbox"
                  checked={selecionadas.has(o.id)}
                  onChange={() => alternar(o.id)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
              )}
            </div>
            {o.especialidades.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {o.especialidades.map((e) => (
                  <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {e}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {o.telefone ?? ""} {o.email ? `· ${o.email}` : ""}
            </p>
          </label>
        ))}
        {oficinas.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-400">Nenhuma oficina encontrada para esse filtro.</p>
        )}
      </div>

      {!empresaId && oficinas.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">Selecione um cliente para pedir cotação.</p>
      )}

      {empresaId && selecionadas.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-lg border border-frota-200 bg-white p-3 shadow-lg">
          <p className="text-sm text-slate-700">
            <strong>{selecionadas.size}</strong> oficina{selecionadas.size > 1 ? "s" : ""} selecionada{selecionadas.size > 1 ? "s" : ""}
          </p>
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary text-sm">
            Pedir cotação
          </button>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3 rounded-lg bg-white p-5">
            <p className="font-medium text-slate-900">
              Pedir cotação pra {selecionadas.size} oficina{selecionadas.size > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {oficinasSelecionadas.map((o) => (
                <span key={o.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {o.nome}
                </span>
              ))}
            </div>
            {erro && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</div>}
            {sucesso && <div className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Pedido enviado pra todas as oficinas selecionadas!</div>}
            <input list="placas-marketplace" name="placa" placeholder="Placa (opcional)" className="input text-sm" />
            <datalist id="placas-marketplace">
              {placas.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <textarea name="descricao_servico" required rows={3} placeholder="Descreva o serviço desejado..." className="input text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)} className="text-xs text-slate-500 hover:underline">
                Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn-primary text-xs">
                {isPending ? "Enviando..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
