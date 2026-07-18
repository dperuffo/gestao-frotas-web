// Fase Fretes-Dados-Completos — pedido do Daniel: "cliente precisa de
// algumas garantias de que o motorista é idôneo". Consolida sinais que já
// existiam espalhados (avaliações por frete, CNH+validade, telefone
// verificado, 2FA) num cartão só — usado tanto nas propostas do mercado
// aberto quanto na lista de parceiros, os dois momentos em que o cliente
// decide se confia num motorista que talvez nunca tenha usado antes.

export type ReputacaoMotorista = {
  media_estrelas: number | null;
  total_avaliacoes: number;
  fretes_concluidos: number;
  taxa_conclusao: number | null;
  cnh_valida: boolean;
  cnh_vencimento: string | null;
  telefone_verificado: boolean;
  seguranca_2fa_ativo: boolean;
  dias_cadastro: number | null;
  selo_verificado: boolean;
  // Fase Destaques-Automaticos — tags que o cliente marcou na avaliação e
  // que se repetiram em 2+ avaliações diferentes (ver _reputacao_motorista).
  tags_destaque: { tag: string; quantidade: number }[];
};

function formatarTempoCadastro(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 30) return `${dias} dia${dias === 1 ? "" : "s"} na rede`;
  if (dias < 365) return `${Math.floor(dias / 30)} mês(es) na rede`;
  return `${Math.floor(dias / 365)} ano(s) na rede`;
}

export function CartaoReputacaoMotorista({ reputacao }: { reputacao: ReputacaoMotorista }) {
  const {
    media_estrelas,
    total_avaliacoes,
    fretes_concluidos,
    taxa_conclusao,
    cnh_valida,
    telefone_verificado,
    seguranca_2fa_ativo,
    dias_cadastro,
    selo_verificado,
    tags_destaque,
  } = reputacao;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {selo_verificado && (
        <span className="rounded-full bg-status-ativo/15 px-2 py-0.5 text-[11px] font-semibold text-status-ativo">
          ✅ Motorista verificado
        </span>
      )}
      {(tags_destaque ?? []).map(({ tag, quantidade }) => (
        <span
          key={tag}
          className="rounded-full bg-frota-100 px-2 py-0.5 text-[11px] font-medium text-frota-700"
          title={`Mencionado por ${quantidade} cliente${quantidade === 1 ? "" : "s"}`}
        >
          🏷️ {tag}
        </span>
      ))}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
        {media_estrelas !== null ? `⭐ ${media_estrelas.toFixed(1)} (${total_avaliacoes})` : "⭐ Sem avaliações ainda"}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
        📦 {fretes_concluidos} concluído{fretes_concluidos === 1 ? "" : "s"}
        {taxa_conclusao !== null ? ` · ${taxa_conclusao}% de conclusão` : ""}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${cnh_valida ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
        {cnh_valida ? "🪪 CNH válida" : "🪪 CNH vencida/ausente"}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
        {telefone_verificado ? "📱 Telefone verificado" : "📱 Telefone não verificado"}
      </span>
      {seguranca_2fa_ativo && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">🔒 2FA ativo</span>
      )}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{formatarTempoCadastro(dias_cadastro)}</span>
    </div>
  );
}
