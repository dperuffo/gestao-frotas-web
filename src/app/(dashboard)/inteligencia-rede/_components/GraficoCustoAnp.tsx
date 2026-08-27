"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemCustoAnp = {
  combustivel: string;
  precoMedio: number;
  referencia: number | null;
  ehOficial: boolean;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase Hotfix-Grafico-Custo-Anp (27/08/2026, achado do Daniel: rótulos do
// eixo Y ("Diesel S-10 Aditivado" etc.) apareciam soltos no canto superior
// esquerdo da tela, por cima do menu — só em /postos (aba "Inteligência da
// Minha Frota"), não em /inteligencia-rede, mesmo sendo o mesmo componente.
// Causa provável: em /postos a troca de aba usa <Link> (navegação
// client-side dentro da mesma rota, só trocando ?visao=), então este
// gráfico monta pela primeira vez DEPOIS que a página já está de pé, no
// meio de uma transição do router. O ResponsiveContainer mede o
// container nesse instante e às vezes pega uma medida errada (0 ou o
// tamanho antigo do card anterior), e o Recharts não corrige sozinho
// depois — a medição de tamanho só acontece de novo se o navegador
// disparar um resize real. Em /inteligencia-rede isso não acontecia
// porque é sempre navegação "fresca" (outra rota).
//
// Fix: só monta o ResponsiveContainer depois que o componente já está no
// DOM (via useEffect, que só roda após o browser confirmar o layout) —
// garante que a primeira medição de tamanho já pega as dimensões
// corretas do card, em vez de arriscar medir no meio da transição.
export function GraficoCustoAnp({ dados }: { dados: ItemCustoAnp[] }) {
  const [pronto, setPronto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há preços cadastrados na rede.</p>;
  }

  const dadosGrafico = dados.map((d) => ({
    nome: d.combustivel,
    "Preço médio GF": d.precoMedio,
    "Referência ANP": d.referencia ?? undefined,
  }));

  const altura = Math.max(220, dados.length * 46);

  return (
    <div ref={containerRef} style={{ width: "100%", height: altura }}>
      {pronto && (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(valor: number) => formatarMoeda(valor)} />
            <Legend />
            <Bar dataKey="Preço médio GF" fill="#E65100" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Referência ANP" fill="#1565C0" radius={[0, 4, 4, 0]} fillOpacity={0.75} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
