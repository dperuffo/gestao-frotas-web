import Link from "next/link";
import { STATUS_AJUSTE_LABEL, caminhoAbastecimento, type ItemResumoAjuste } from "@/lib/ajustesAbastecimentos";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase 27.70 — seção "Ajustes de abastecimento", reaproveitada nos 4 lugares
// pedidos pelo Daniel: dashboard do posto, dashboard da frota/cliente, e os
// painéis financeiros de ambos (/financeiro-posto e /financeiro). Cada
// página busca os dados via resumoAjustesAbastecimentos (ajustesAbastecimentos.ts)
// — só muda o "lado" (cliente/posto) e a empresa selecionada — e só passa o
// resultado pronto pra cá, que cuida só da apresentação.
export function SecaoAjustesAbastecimentos({
  pendentes,
  aceitosNoPeriodo,
  impactoFinanceiro,
  ultimosAjustes,
  diasPeriodo,
}: {
  pendentes: number;
  aceitosNoPeriodo: number;
  impactoFinanceiro: number;
  ultimosAjustes: ItemResumoAjuste[];
  diasPeriodo: number;
}) {
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Ajustes de abastecimento — últimos {diasPeriodo} dias
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador
          label="Pendentes de resposta"
          valor={String(pendentes)}
          destaque={pendentes > 0 ? "negativo" : undefined}
        />
        <Indicador label="Aceitos no período" valor={String(aceitosNoPeriodo)} />
        <Indicador
          label="Impacto financeiro"
          valor={formatarMoeda(impactoFinanceiro)}
          destaque={impactoFinanceiro < 0 ? "negativo" : impactoFinanceiro > 0 ? "positivo" : undefined}
        />
      </div>

      <div className="mb-6 card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Últimos ajustes</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Abastecimento</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Atualizado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ultimosAjustes.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">#{a.identificador.id}</td>
                <td className="px-4 py-3 text-slate-500">{a.origem === "cliente" ? "Cliente" : "Posto"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {STATUS_AJUSTE_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(a.atualizadoEm).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={caminhoAbastecimento(a.identificador)} className="text-frota-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {ultimosAjustes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum ajuste registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Indicador({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: "positivo" | "negativo";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          destaque === "negativo" ? "text-red-600" : destaque === "positivo" ? "text-green-700" : "text-slate-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
