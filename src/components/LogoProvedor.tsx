import Image from "next/image";

// Fase Provedores-Logos — pedido do Daniel: "Colocar estes icones no lugar
// dos textos de meios de pagamento. Somente as logos já identificam os
// meios de pagamento na tela financeira, nos abastecimentos (substituir
// somente nos filtros) e nas integrações" + "padroniza o tamanho das
// logos" + "os icones na frente das logos também não precisa, somente a
// logo". Um mapa central slug → arquivo em public/logos/, com a proporção
// real de cada logo (largura/altura do arquivo original, depois de
// recortado — ver histórico de conversa) — assim dá pra fixar a ALTURA via
// className (ex: "h-6 w-auto") e a largura escala proporcional sozinha,
// sem esticar nenhuma logo pra caber num quadrado.
const LOGOS: Record<string, { src: string; width: number; height: number; nome: string }> = {
  profrotas: { src: "/logos/profrotas.png", width: 1063, height: 259, nome: "Pró-Frotas" },
  ticket_log: { src: "/logos/ticketlog.png", width: 403, height: 156, nome: "TicketLog" },
  rede_frota: { src: "/logos/redefrota.png", width: 386, height: 96, nome: "Rede Frota" },
  veloe: { src: "/logos/veloe.png", width: 798, height: 339, nome: "Veloe" },
  valecard: { src: "/logos/valecard.png", width: 339, height: 178, nome: "Valecard" },
};

// O campo "provedor" é texto livre (quem envia é o sistema externo — ver
// /api/integracoes/abastecimentos) — normaliza variações razoáveis de
// grafia (maiúscula/minúscula, espaço, hífen) antes de procurar no mapa,
// pra não depender de todo mundo mandar exatamente "ticket_log".
function normalizarSlug(provedor: string): string {
  return provedor
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function logoDoProvedor(provedor: string) {
  return LOGOS[normalizarSlug(provedor)];
}

// Nome legível de fallback pra provedor sem logo cadastrada ainda (parceiro
// novo que a FNI não desenhou ícone específico) — mesmo texto que os
// nomeProvedor() locais de /financeiro e /abastecimentos já usavam.
export function nomeProvedor(provedor: string): string {
  return logoDoProvedor(provedor)?.nome ?? (provedor === "profrotas" ? "Pró-Frotas" : provedor);
}

export function LogoProvedor({
  provedor,
  className = "h-6 w-auto",
}: {
  provedor: string;
  className?: string;
}) {
  const logo = logoDoProvedor(provedor);
  if (!logo) {
    // Parceiro sem logo cadastrada ainda — cai pro texto, não quebra a tela.
    return <span className="text-sm font-medium text-slate-600">{provedor}</span>;
  }
  return (
    <Image
      src={logo.src}
      alt={logo.nome}
      title={logo.nome}
      width={logo.width}
      height={logo.height}
      className={className}
      unoptimized
    />
  );
}
