import BotaoBaixarPdfEntregaLazy from "./BotaoBaixarPdfEntregaLazy";

// Fase P0.4 — canhoto digital (POD): mostra o que o motorista confirmou no
// PWA (foto do canhoto + assinatura + dados do recebedor) e oferece o
// comprovante em PDF pro gestor.
export type EntregaConfirmada = {
  nomeRecebedor: string;
  documentoRecebedor: string | null;
  criadoEm: string;
  fotoCanhotoUrl: string | null;
  assinaturaUrl: string | null;
};

export function EntregaCard({
  freteTitulo,
  origemLabel,
  destinoLabel,
  entrega,
}: {
  freteTitulo: string;
  origemLabel: string;
  destinoLabel: string;
  entrega: EntregaConfirmada;
}) {
  const dataConfirmacao = new Date(entrega.criadoEm).toLocaleString("pt-BR");

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">✅ Entrega confirmada (canhoto digital)</h2>
      <p className="mb-3 text-xs text-slate-500">
        {entrega.nomeRecebedor}
        {entrega.documentoRecebedor ? ` · doc. ${entrega.documentoRecebedor}` : ""} · {dataConfirmacao}
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Foto do canhoto</p>
          {entrega.fotoCanhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entrega.fotoCanhotoUrl} alt="Foto do canhoto" className="h-40 w-full rounded-lg border border-slate-200 object-cover" />
          ) : (
            <p className="text-xs text-slate-400">Sem foto.</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Assinatura do recebedor</p>
          {entrega.assinaturaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entrega.assinaturaUrl} alt="Assinatura do recebedor" className="h-40 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          ) : (
            <p className="text-xs text-slate-400">Sem assinatura.</p>
          )}
        </div>
      </div>

      <BotaoBaixarPdfEntregaLazy
        nomeArquivo={`comprovante-entrega-${freteTitulo}.pdf`}
        freteTitulo={freteTitulo}
        origemLabel={origemLabel}
        destinoLabel={destinoLabel}
        nomeRecebedor={entrega.nomeRecebedor}
        documentoRecebedor={entrega.documentoRecebedor}
        dataConfirmacao={dataConfirmacao}
        fotoCanhotoUrl={entrega.fotoCanhotoUrl}
        assinaturaUrl={entrega.assinaturaUrl}
      />
    </div>
  );
}
