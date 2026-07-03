"use client";

import { useState } from "react";
import { TERMO_ADESAO_PARAGRAFOS, VERSAO_TERMO_ADESAO } from "@/lib/termoAdesao";

// Modal de aceite do Termo de Adesão — aparece ANTES de qualquer chamada ao
// checkout do Stripe. O botão de confirmação só habilita depois que a
// pessoa marca a caixa de "li e aceito"; o texto do checkbox já deixa
// explícito que aceitar este termo também vale como aceite dos Termos de
// Uso gerais da plataforma (pedido do Daniel — um aceite só, não dois).
export function ModalTermoAdesao({
  aberto,
  planoLabel,
  precoLabel,
  carregando,
  erro,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  planoLabel: string;
  precoLabel: string;
  carregando: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const [aceitou, setAceitou] = useState(false);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Termo de Adesão e Contrato de Prestação de Serviços</h2>
          <p className="mt-1 text-xs text-slate-500">
            Plano selecionado: <strong>{planoLabel}</strong> — {precoLabel} · Versão {VERSAO_TERMO_ADESAO}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-700">
          {TERMO_ADESAO_PARAGRAFOS.map((p, i) =>
            p === "" ? (
              <div key={i} className="h-2" />
            ) : p.startsWith("PARTE") ? (
              <p key={i} className="mb-2 mt-4 text-sm font-semibold text-frota-700 first:mt-0">
                {p}
              </p>
            ) : (
              <p key={i} className="mb-2 text-xs leading-relaxed text-slate-600">
                {p}
              </p>
            )
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={aceitou}
              onChange={(e) => setAceitou(e.target.checked)}
              className="mt-0.5 accent-frota-600"
            />
            <span>
              Li e aceito o Termo de Adesão e Contrato de Prestação de Serviços acima, o que também
              indica minha concordância com os Termos de Uso da plataforma FNI Gestão de Frotas.
            </span>
          </label>

          {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onFechar} disabled={carregando} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={!aceitou || carregando}
              className="btn-primary"
            >
              {carregando ? "Processando..." : "Aceito os Termos de Adesão"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
