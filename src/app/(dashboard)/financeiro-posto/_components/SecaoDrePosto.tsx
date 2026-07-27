import { formatarMoeda } from "@/lib/financeiro";

// Fase DRE-Gerencial (26/07/2026, pedido do Daniel: "Faz sentido criarmos
// um modelo de DRE para clientes e postos?") — DRE gerencial do posto,
// por competência. Dados vêm da RPC dre_posto() (ver database.types.ts),
// que já soma faturas_postos (receita) e despesas_postos (custo/despesas)
// no período selecionado — os mesmos dados já usados no restante desta
// tela, só reagrupados no formato de demonstração de resultado.
// Gerencial = sem impostos sobre venda nem depreciação estimada (não
// rastreados no sistema hoje); "impostos" aqui é só o que o posto lançou
// manualmente como despesa tipo "impostos" (ex: PIS/Cofins recolhidos).
export type DrePostoDados = {
  receita_bruta: number;
  cmv_combustivel: number;
  lucro_bruto: number;
  despesa_salarios: number;
  despesa_manutencao: number;
  despesa_aluguel: number;
  despesa_energia: number;
  despesa_outras: number;
  despesas_operacionais: number;
  ebitda: number;
  impostos: number;
  lucro_liquido: number;
};

export function SecaoDrePosto({ dados }: { dados: DrePostoDados }) {
  const margemLiquida = dados.receita_bruta > 0 ? (dados.lucro_liquido / dados.receita_bruta) * 100 : null;

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">DRE gerencial</h2>
      <p className="mb-4 text-xs text-slate-500">
        Resultado do posto no período, por competência (mês de referência da fatura/despesa, não data de
        pagamento). Não inclui impostos sobre venda nem depreciação — é um DRE gerencial, não fiscal.
      </p>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-slate-100">
          <LinhaDre label="Receita bruta (faturas emitidas)" valor={dados.receita_bruta} negrito />
          <LinhaDre label="(–) Custo do combustível repassado à distribuidora" valor={-dados.cmv_combustivel} />
          <LinhaDre label="= Lucro bruto" valor={dados.lucro_bruto} negrito subtotal />
          <LinhaDre label="(–) Salários" valor={-dados.despesa_salarios} indent />
          <LinhaDre label="(–) Manutenção" valor={-dados.despesa_manutencao} indent />
          <LinhaDre label="(–) Aluguel" valor={-dados.despesa_aluguel} indent />
          <LinhaDre label="(–) Energia" valor={-dados.despesa_energia} indent />
          <LinhaDre label="(–) Outras despesas" valor={-dados.despesa_outras} indent />
          <LinhaDre label="= EBITDA" valor={dados.ebitda} negrito subtotal />
          <LinhaDre label="(–) Impostos lançados" valor={-dados.impostos} />
          <LinhaDre label="= Lucro líquido" valor={dados.lucro_liquido} negrito destaque />
        </tbody>
      </table>
      {margemLiquida !== null && (
        <p className="mt-3 text-xs text-slate-500">
          Margem líquida: <span className="font-medium text-slate-700">{margemLiquida.toFixed(1)}%</span>
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
