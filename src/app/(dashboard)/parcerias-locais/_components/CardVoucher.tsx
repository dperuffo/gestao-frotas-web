import { ESTILO_CATEGORIA_FIDELIDADE, ESTILO_CATEGORIA_PADRAO, LABEL_CATEGORIA_FIDELIDADE } from "@/lib/fidelidadeCategorias";

// Card estilo "cupom de voucher" — pedido do Daniel (17/07): "em ambas as
// visões, cliente, posto e motorista, deverão ser apresentados em cards,
// coloridos, em formato de cupons de voucher, que contenham imagens dos
// produtos e serviços, quantidade de pontos para resgate, número do
// voucher, validade e descrição do benefício". Usado tanto pro catálogo
// (itens ainda não resgatados — sem número de voucher, esse só existe após
// o resgate) quanto pra fila "Meus Benefícios Resgatados" (com número do
// voucher e validade).
export function CardVoucher({
  titulo,
  descricao,
  categoria,
  parceiroNome,
  pontos,
  imagemUrl,
  numeroVoucher,
  validoAte,
  rodape,
  acoes,
}: {
  titulo: string;
  descricao?: string | null;
  categoria: string;
  parceiroNome?: string | null;
  pontos: number;
  imagemUrl?: string | null;
  numeroVoucher?: string | null;
  validoAte?: string | null;
  rodape?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  const estilo = ESTILO_CATEGORIA_FIDELIDADE[categoria] ?? ESTILO_CATEGORIA_PADRAO;

  return (
    <div className={`overflow-hidden rounded-2xl border-2 border-dashed ${estilo.border} ${estilo.bg} shadow-sm`}>
      <div className="relative h-32 w-full bg-slate-200">
        {imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagemUrl} alt={titulo} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center text-4xl ${estilo.text}`}>🎟️</div>
        )}
        <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-bold text-white ${estilo.badge}`}>
          {pontos.toLocaleString("pt-BR")} pts
        </span>
      </div>
      <div className="p-4">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${estilo.text}`}>
          {LABEL_CATEGORIA_FIDELIDADE[categoria] ?? categoria}
        </p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-900">{titulo}</h3>
        {parceiroNome && <p className="text-xs text-slate-500">{parceiroNome}</p>}
        {descricao && <p className="mt-1 text-xs text-slate-600">{descricao}</p>}

        {(numeroVoucher || validoAte) && (
          <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-xs text-slate-500">
            {numeroVoucher && <p className="font-mono">Voucher: {numeroVoucher}</p>}
            {validoAte && <p>Válido até {new Date(validoAte).toLocaleDateString("pt-BR")}</p>}
          </div>
        )}

        {rodape && <div className="mt-3">{rodape}</div>}
        {acoes && <div className="mt-3">{acoes}</div>}
      </div>
    </div>
  );
}
