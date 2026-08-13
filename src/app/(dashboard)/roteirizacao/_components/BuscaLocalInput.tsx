"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buscarSugestoesLocalAcao } from "../actions";
import type { SugestaoGeocoding } from "@/lib/geo";

export type LocalSelecionado = { label: string; lat: number; lon: number };

export function BuscaLocalInput({
  placeholder,
  valorInicial,
  onSelecionar,
}: {
  placeholder: string;
  valorInicial?: LocalSelecionado | null;
  onSelecionar: (local: LocalSelecionado | null) => void;
}) {
  const [texto, setTexto] = useState(valorInicial?.label ?? "");
  const [sugestoes, setSugestoes] = useState<SugestaoGeocoding[]>([]);
  const [mostrar, setMostrar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTexto(valorInicial?.label ?? "");
  }, [valorInicial?.label]);

  function handleChange(valor: string) {
    setTexto(valor);
    onSelecionar(null);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 3) {
      setSugestoes([]);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const resultado = await buscarSugestoesLocalAcao(valor);
        setSugestoes(resultado);
        setMostrar(true);
      });
    }, 400);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={texto}
        placeholder={placeholder}
        className="input"
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setMostrar(true)}
        onBlur={() => setTimeout(() => setMostrar(false), 150)}
      />
      {isPending && <span className="absolute right-2 top-2.5 text-xs text-slate-400">buscando...</span>}
      {mostrar && sugestoes.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {sugestoes.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-frota-50/60"
                onClick={() => {
                  setTexto(s.label);
                  setMostrar(false);
                  onSelecionar({ label: s.label, lat: s.lat, lon: s.lon });
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
