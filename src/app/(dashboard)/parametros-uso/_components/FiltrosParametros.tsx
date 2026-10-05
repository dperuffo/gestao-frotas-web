import Link from "next/link";

// Filtros de pesquisa da tela Parâmetros de Uso (05/10/2026, pedido do Daniel:
// "colocar filtros de pesquisa para ajudar o usuário na escolha, como placa,
// motorista etc."). Formulário GET simples: os valores viajam na URL e a página
// (server component) filtra as linhas de qualquer aba.
export function FiltrosParametros({
  empresaParam,
  tipo,
  placa,
  motorista,
  status,
  motoristas,
  mostrarPlaca,
  mostrarMotorista,
  mostrarStatus,
}: {
  empresaParam?: string;
  tipo: string;
  placa?: string;
  motorista?: string;
  status?: string;
  motoristas: { id: string; nome_completo: string }[];
  mostrarPlaca: boolean;
  mostrarMotorista: boolean;
  mostrarStatus: boolean;
}) {
  if (!mostrarPlaca && !mostrarMotorista && !mostrarStatus) return null;
  const temFiltro = Boolean(placa || motorista || status);
  const paramsLimpar = new URLSearchParams();
  if (empresaParam) paramsLimpar.set("empresa", empresaParam);
  if (tipo !== "vinculo") paramsLimpar.set("tipo", tipo);
  const hrefLimpar = paramsLimpar.toString() ? `?${paramsLimpar.toString()}` : "?";

  return (
    <form className="card mb-4 flex flex-wrap items-end gap-3 p-3">
      {empresaParam && <input type="hidden" name="empresa" value={empresaParam} />}
      {tipo !== "vinculo" && <input type="hidden" name="tipo" value={tipo} />}
      {mostrarPlaca && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Placa</label>
          <input name="placa" defaultValue={placa ?? ""} placeholder="Ex.: ABC1D23" className="input w-36 text-sm uppercase" />
        </div>
      )}
      {mostrarMotorista && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Motorista</label>
          <select name="motorista" defaultValue={motorista ?? ""} className="input w-56 text-sm">
            <option value="">Todos</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome_completo}
              </option>
            ))}
          </select>
        </div>
      )}
      {mostrarStatus && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
          <select name="status" defaultValue={status ?? ""} className="input w-32 text-sm">
            <option value="">Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
      )}
      <button type="submit" className="btn-secondary text-sm">
        Filtrar
      </button>
      {temFiltro && (
        <Link href={hrefLimpar} className="text-xs font-medium text-frota-600 hover:underline">
          Limpar filtros
        </Link>
      )}
    </form>
  );
}
