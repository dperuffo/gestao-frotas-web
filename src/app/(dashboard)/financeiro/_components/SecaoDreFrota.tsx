import { formatarMoeda } from "@/lib/financeiro";

// Fase DRE-Gerencial (26/07/2026, pedido do Daniel: "Faz sentido criarmos
// um modelo de DRE para clientes e postos?") — DRE gerencial da FROTA, só
// exibido quando a empresa tem receita de frete (faz sentido pra quem
// fatura frete pros próprios clientes via /fretes — ver gate em page.tsx:
// checa se existe ao menos 1 faturas_fretes histórica não cancelada; sem
// isso, "receita" da frota é sempre zero e o DRE não diz nada). Dados vêm
// da RPC dre_frota() (ver database.types.ts): faturas_fretes (receita),
// abastecimentos_unificado + manutencoes_realizadas (custo variável,
// mesmos dados já usados em indicadores_financeiros) e custos_fixos.
export type DreFrotaDados = {
  receita_bruta_fretes: number;
  custo_combustivel: number;
  custo_manutencao: number;
  resultado_bruto: number;
  custos_fixos: number;
  ebitda: number;
};

export function SecaoDreFrota({ dados }: { dados: DreFrotaDados }) {
  const margemEbitda = dados.receita_bruta_fretes > 0 ? (dados.ebitda / dados.receita_bruta_fretes) * 100 : null;

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">DRE gerencial — Fretes</h2>
      <p className="mb-4 text-xs text-slate-500">
        Resultado das viagens faturadas no mês, por competência. Não inclui impostos sobre venda nem
        depreciação — é um DRE gerencial, não fiscal.
      </p>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-slate-100">
          <LinhaDre label="Receita bruta de fretes" valor={dados.receita_bruta_fretes} negrito />
          <LinhaDre label="(–) Custo de combustível" valor={-dados.custo_combustivel} indent />
          <LinhaDre label="(–) Custo de manutenção" valor={-dados.custo_manutencao} indent />
          <LinhaDre label="= Resultado bruto" valor={dados.resultado_bruto} negrito subtotal />
          <LinhaDre label="(–) Custos fixos (seguro, IPVA, licenciamento...)" valor={-dados.custos_fixos} />
          <LinhaDre label="= EBITDA" valor={dados.ebitda} negrito destaque />
        </tbody>
      </table>
      {margemEbitda !== null && (
        <p className="mt-3 text-xs text-slate-500">
          Margem EBITDA: <span className="font-medium text-slate-700">{margemEbitda.toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
}

function LinhaDre({
  label,
  valor,
  negrito,
  indent,
  subtotal,
  destaque,
}: {
  label: string;
  valor: number;
  negrito?: boolean;
  indent?: boolean;
  subtotal?: boolean;
  destaque?: boolean;
}) {
  const cor = destaque ? (valor < 0 ? "text-red-600" : "text-green-600") : valor < 0 ? "text-slate-500" : "text-slate-700";
  return (
    <tr className={subtotal ? "bg-slate-50" : ""}>
      <td className={`py-2 pr-4 ${indent ? "pl-6 text-slate-500" : "text-slate-700"} ${negrito ? "font-semibold" : ""}`}>
        {label}
      </td>
      <td className={`py-2 text-right ${cor} ${negrito ? "font-semibold" : ""}`}>{formatarMoeda(valor)}</td>
    </tr>
  );
}
