// Fase Financeiro-ERP / pedido do Daniel (26/07/2026) — "Aba de Piso mínimo
// ANTT tem que estar na visão do cliente, web e PWA". Tabela NACIONAL
// (Res. ANTT 5.867/2020, não é por tenant — ver migração
// fase_p0_5_pisos_antt), hoje só visível/editável em
// /administracao/pisos-antt (perfil admin). O CLIENTE (Frota) precisa
// enxergar os mesmos valores — que já usa indiretamente ao simular uma
// cotação em /cotacoes — mas só em modo LEITURA: quem importa/exclui a
// planilha oficial da ANTT continua sendo só o time interno. Este
// componente é a tabela em si, compartilhada entre a tela admin (que
// ainda tem o formulário de import + exclusão ao redor) e a aba read-only
// do cliente em /cotacoes.
export type LinhaPisoAntt = {
  id: string;
  tipo_carga: string;
  numero_eixos: number;
  coeficiente_deslocamento: number;
  coeficiente_carga_descarga: number;
  vigencia_inicio: string;
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function TabelaPisoAntt({
  pisos,
  acoes,
}: {
  pisos: LinhaPisoAntt[];
  // Coluna extra opcional (ex: botão excluir) — só a tela admin usa; a
  // visão do cliente não passa isso, e a coluna nem aparece.
  acoes?: (piso: LinhaPisoAntt) => React.ReactNode;
}) {
  const porTipo = new Map<string, LinhaPisoAntt[]>();
  for (const p of pisos) {
    const lista = porTipo.get(p.tipo_carga) ?? [];
    lista.push(p);
    porTipo.set(p.tipo_carga, lista);
  }

  if (pisos.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        Nenhum piso ANTT cadastrado ainda.
      </div>
    );
  }

  return (
    <>
      {Array.from(porTipo.entries()).map(([tipo, linhas]) => (
        <div key={tipo} className="card mb-6 overflow-x-auto p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">{tipo}</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº de eixos</th>
                <th className="px-4 py-3">Coef. deslocamento (R$/km)</th>
                <th className="px-4 py-3">Coef. carga/descarga (R$)</th>
                <th className="px-4 py-3">Vigência</th>
                {acoes && <th className="px-4 py-3">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-600">{p.numero_eixos}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatoMoeda.format(p.coeficiente_deslocamento)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatoMoeda.format(p.coeficiente_carga_descarga)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(`${p.vigencia_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                  </td>
                  {acoes && <td className="px-4 py-3">{acoes(p)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
