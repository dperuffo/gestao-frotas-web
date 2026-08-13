"use client";

import { useState } from "react";
import { geocodificar, type SugestaoGeocoding } from "@/lib/geo";

// Busca de local por texto livre (Nominatim), mesmo serviço da Roteirização
// — aqui simplificado pra um campo só com sugestões em lista, guardando
// label/lat/lon em inputs hidden pro form de criação do frete ler.
export function CampoLocalFrete({
  label,
  prefixo,
  valorInicial,
}: {
  label: string;
  prefixo: "origem" | "destino";
  valorInicial?: { label: string; lat: number; lon: number };
}) {
  const [texto, setTexto] = useState(valorInicial?.label ?? "");
  const [sugestoes, setSugestoes] = useState<SugestaoGeocoding[]>([]);
  const [escolhido, setEscolhido] = useState<SugestaoGeocoding | null>(valorInicial ?? null);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    if (texto.trim().length < 3) return;
    setBuscando(true);
    const opcoes = await geocodificar(texto);
    setSugestoes(opcoes);
    setBuscando(false);
  }

  function escolher(opcao: SugestaoGeocoding) {
    setEscolhido(opcao);
    setTexto(opcao.label);
    setSugestoes([]);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        <span className="text-red-500"> *</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setEscolhido(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Digite a cidade e busque..."
          className="input flex-1"
        />
        <button type="button" onClick={buscar} disabled={buscando} className="btn-secondary shrink-0 text-sm">
          {buscando ? "..." : "Buscar"}
        </button>
      </div>
      {sugestoes.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
          {sugestoes.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => escolher(s)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-frota-50/60"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {escolhido ? (
        <p className="mt-1 text-xs text-status-ativo">✓ {escolhido.label}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Escolha uma sugestão da busca.</p>
      )}
      <input type="hidden" name={`${prefixo}_label`} value={escolhido?.label ?? ""} />
      <input type="hidden" name={`${prefixo}_lat`} value={escolhido?.lat ?? ""} />
      <input type="hidden" name={`${prefixo}_lon`} value={escolhido?.lon ?? ""} />
    </div>
  );
}
