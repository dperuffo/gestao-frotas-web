// Lista de preços de um posto como "chips" (um por combustível), em vez de
// texto corrido com " · " — mais fácil de escanear numa tabela quando o
// posto tem várias variações (Comum/Aditivado de diesel, gasolina, etanol).
export function PrecosChips({ precos }: { precos: { combustivel: string; preco: number }[] }) {
  if (precos.length === 0) {
    return <span className="text-xs text-slate-400">Sem preço registrado</span>;
  }
  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {precos.map((p) => (
        <span
          key={p.combustivel}
          className="whitespace-nowrap rounded-md bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600"
        >
          {p.combustivel} <span className="font-medium text-slate-800">R$ {p.preco.toFixed(3)}</span>
        </span>
      ))}
    </div>
  );
}
