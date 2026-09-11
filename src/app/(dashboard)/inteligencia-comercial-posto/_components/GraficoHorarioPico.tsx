// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — heatmap dia×faixa de
// horário colorido pelo ticket médio (não existe um heatmap pronto no
// Recharts, então isso é uma grade de <div>s pura, sem biblioteca — mesma
// ideia visual de um heatmap, só que server-renderável, sem custo de JS no
// cliente). Tooltip é o próprio atributo `title` nativo do navegador.
export type ItemHorarioPico = {
  dia_semana: number;
  dia_semana_label: string;
  faixa_horario: string;
  ticket_medio: number | null;
  qtd_abastecimentos: number;
};

const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0]; // segunda...domingo (0 = domingo)

function corPorIntensidade(valor: number, min: number, max: number) {
  if (max === min) return "#fde68a";
  const t = (valor - min) / (max - min); // 0..1
  // slate-50 -> laranja do tema (acento), interpolação simples
  const r = Math.round(248 + t * (222 - 248));
  const g = Math.round(250 + t * (96 - 250));
  const b = Math.round(252 + t * (36 - 252));
  return `rgb(${r}, ${g}, ${b})`;
}

export function GraficoHorarioPico({ dados }: { dados: ItemHorarioPico[] }) {
  if (dados.length === 0) return null;

  const faixas = Array.from(new Set(dados.map((d) => d.faixa_horario))).sort();
  const dias = DIAS_ORDEM.filter((d) => dados.some((x) => x.dia_semana === d)).map((d) => {
    const item = dados.find((x) => x.dia_semana === d);
    return { dia: d, label: item?.dia_semana_label ?? String(d) };
  });

  const tickets = dados.map((d) => d.ticket_medio ?? 0);
  const min = Math.min(...tickets);
  const max = Math.max(...tickets);

  function celula(dia: number, faixa: string) {
    return dados.find((d) => d.dia_semana === dia && d.faixa_horario === faixa);
  }

  return (
    <div className="card mb-6 overflow-x-auto p-5">
      <p className="mb-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
        Ticket médio por dia × horário (mais forte = maior ticket)
      </p>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-slate-400" />
            {faixas.map((f) => (
              <th key={f} className="px-2 py-1 text-center font-medium text-slate-500 dark:text-slate-400">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map(({ dia, label }) => (
            <tr key={dia}>
              <td className="px-2 py-1 text-right font-medium text-slate-600 dark:text-slate-300">{label}</td>
              {faixas.map((f) => {
                const c = celula(dia, f);
                const ticket = c?.ticket_medio ?? null;
                return (
                  <td key={f} className="p-1">
                    <div
                      title={
                        c
                          ? `${label} · ${f}: ${ticket != null ? ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "sem dados"} (${c.qtd_abastecimentos} abastecimentos)`
                          : "Sem dados"
                      }
                      className="flex h-9 w-16 items-center justify-center rounded text-[11px] font-medium text-slate-700 dark:text-slate-300"
                      style={{ backgroundColor: ticket != null ? corPorIntensidade(ticket, min, max) : "#f8fafc" }}
                    >
                      {ticket != null ? ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace("R$", "").trim() : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
