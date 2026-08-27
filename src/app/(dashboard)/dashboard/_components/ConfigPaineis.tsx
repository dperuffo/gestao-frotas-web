"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { definirVisibilidadePainelAcao } from "../preferenciasActions";

// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação", item do roadmap "Dashboard configurável por
// usuário") — a tela /dashboard hoje mostra os mesmos 9 painéis de
// "Indicadores avançados" pra todo mundo, na mesma ordem, sem opção de
// esconder o que não usa. Este botão abre um painel simples de
// mostrar/ocultar (sem arrastar/reordenar nesta 1ª versão — reordenar
// exigiria uma biblioteca de drag-and-drop nova no projeto; mostrar/ocultar
// já resolve o problema de ruído citado no pedido, sem essa dependência
// extra).
export type OpcaoPainel = { chave: string; titulo: string };

export function ConfigPaineis({
  opcoes,
  ocultosIniciais,
}: {
  opcoes: OpcaoPainel[];
  ocultosIniciais: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set(ocultosIniciais));
  const [, iniciarTransicao] = useTransition();

  function alternar(chave: string) {
    const oculto = !ocultos.has(chave);
    // Atualização otimista — some/aparece na hora, sem esperar o servidor.
    setOcultos((prev) => {
      const novo = new Set(prev);
      if (oculto) novo.add(chave);
      else novo.delete(chave);
      return novo;
    });
    iniciarTransicao(async () => {
      try {
        await definirVisibilidadePainelAcao(chave, oculto);
      } catch {
        // Desfaz em caso de falha.
        setOcultos((prev) => {
          const novo = new Set(prev);
          if (oculto) novo.delete(chave);
          else novo.add(chave);
          return novo;
        });
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="btn-secondary flex items-center gap-1.5 text-sm"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Personalizar painéis
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setAberto(false)} />
          <div className="card absolute right-0 top-full z-[100] mt-2 w-72 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Painéis visíveis
              </p>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
            <ul className="space-y-1">
              {opcoes.map((opcao) => (
                <li key={opcao.chave}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!ocultos.has(opcao.chave)}
                      onChange={() => alternar(opcao.chave)}
                      className="h-4 w-4 rounded border-slate-300 text-frota-500 focus:ring-frota-500"
                    />
                    {opcao.titulo}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
