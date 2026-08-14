"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { VeiculoKpi } from "@/lib/indicadoresFrota";
import { formatarMoeda } from "@/lib/financeiro";

type Coluna = {
  chave: keyof VeiculoKpi;
  label: string;
  formatar: (v: VeiculoKpi) => string;
  numerica?: boolean;
};

const COLUNAS: Coluna[] = [
  { chave: "modelo", label: "Marca / Modelo", formatar: (v) => [v.marca, v.modelo].filter(Boolean).join(" ") || "—" },
  { chave: "tipo_veiculo", label: "Tipo", formatar: (v) => v.tipo_veiculo ?? "—" },
  {
    chave: "disponibilidade_pct",
    label: "Disponibilidade",
    formatar: (v) => (v.disponibilidade_pct !== null ? `${v.disponibilidade_pct}%` : "—"),
    numerica: true,
  },
  {
    chave: "cpk_operacional",
    label: "CPK",
    formatar: (v) => (v.cpk_operacional !== null ? `${formatarMoeda(v.cpk_operacional)}/km` : "—"),
    numerica: true,
  },
  { chave: "media_km_l", label: "Consumo", formatar: (v) => (v.media_km_l !== null ? `${v.media_km_l} km/l` : "—"), numerica: true },
  {
    chave: "utilizacao_pct",
    label: "Utilização",
    formatar: (v) => (v.utilizacao_pct !== null ? `${v.utilizacao_pct}%` : "—"),
    numerica: true,
  },
  {
    chave: "pct_corretiva",
    label: "Corretiva",
    formatar: (v) => (v.pct_corretiva !== null ? `${v.pct_corretiva}%` : "—"),
    numerica: true,
  },
  {
    chave: "conformidade_pct",
    label: "Conformidade",
    formatar: (v) => (v.conformidade_pct !== null ? `${v.conformidade_pct}%` : "—"),
    numerica: true,
  },
  { chave: "tmrnc_horas", label: "TMRNC", formatar: (v) => (v.tmrnc_horas !== null ? `${v.tmrnc_horas}h` : "—"), numerica: true },
  { chave: "total_sinistros", label: "Sinistros", formatar: (v) => String(v.total_sinistros), numerica: true },
];

// Fase Indicadores-da-Frota D (30/07/2026) — tabela de comparação entre
// veículos, pedido do Daniel: "poder comparar veículos entre si". Cada
// coluna é ordenável (clique no cabeçalho); clicar na placa seleciona
// aquele veículo pros cards acima (navega mantendo os demais filtros na
// URL, mesmo padrão de link com querystring usado no resto do app).
export function TabelaComparacaoVeiculos({ veiculos, placaSelecionada }: { veiculos: VeiculoKpi[]; placaSelecionada?: string }) {
  const searchParams = useSearchParams();
  const [ordenarPor, setOrdenarPor] = useState<keyof VeiculoKpi>("placa");
  const [ordemAsc, setOrdemAsc] = useState(true);

  function hrefComVeiculo(placa: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (placaSelecionada === placa) {
      params.delete("veiculo");
    } else {
      params.set("veiculo", placa);
    }
    return `?${params.toString()}`;
  }

  const ordenados = useMemo(() => {
    const copia = [...veiculos];
    copia.sort((a, b) => {
      const va = a[ordenarPor];
      const vb = b[ordenarPor];
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return ordemAsc ? va - vb : vb - va;
      return ordemAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return copia;
  }, [veiculos, ordenarPor, ordemAsc]);

  function handleOrdenar(chave: keyof VeiculoKpi) {
    if (ordenarPor === chave) {
      setOrdemAsc((a) => !a);
    } else {
      setOrdenarPor(chave);
      setOrdemAsc(true);
    }
  }

  if (veiculos.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Nenhum veículo encontrado para esse filtro.</p>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="cursor-pointer select-none px-4 py-3 hover:text-slate-700" onClick={() => handleOrdenar("placa")}>
              Placa {ordenarPor === "placa" && (ordemAsc ? "↑" : "↓")}
            </th>
            {COLUNAS.map((col) => (
              <th
                key={String(col.chave)}
                className={`cursor-pointer select-none px-4 py-3 hover:text-slate-700 ${col.numerica ? "text-right" : ""}`}
                onClick={() => handleOrdenar(col.chave)}
              >
                {col.label} {ordenarPor === col.chave && (ordemAsc ? "↑" : "↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordenados.map((v) => (
            <tr key={v.placa} className={`transition-colors hover:bg-frota-50/60 ${placaSelecionada === v.placa ? "bg-frota-50" : ""}`}>
              <td className="px-4 py-2.5">
                <Link href={hrefComVeiculo(v.placa)} className="font-medium text-frota-600 hover:underline">
                  {v.placa}
                </Link>
              </td>
              {COLUNAS.map((col) => (
                <td key={String(col.chave)} className={`px-4 py-2.5 text-slate-600 ${col.numerica ? "text-right tabular-nums" : ""}`}>
                  {col.formatar(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
