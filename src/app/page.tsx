import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LANDING_BODY_HTML } from "./_landing/landingBody";

export const metadata: Metadata = {
  title: "FNI — Fleet Network Intelligence | Gestão de Frotas",
  description:
    "Plataforma SaaS para gestão de frotas. Compare preços ANP, monitore consumo e identifique os melhores postos. Trial grátis por 14 dias.",
};

// Fase Índice-Público-na-Landing — pedido do Daniel: "essa página de índice
// de preços eu gostaria que estivesse na landing page". Em vez de embutir
// a página inteira, mostramos um teaser com números reais (as mesmas RPCs
// públicas de /indice-precos) + CTA pra página completa — landingBody.ts é
// só HTML estático, então os 3 cards de preço são montados aqui e injetados
// no lugar do marcador <!-- INDICE_PRECOS_PLACEHOLDER -->.
const COMBUSTIVEIS_DESTAQUE: { chave: string; label: string; icone: string }[] = [
  { chave: "OLEO DIESEL S10", label: "Diesel S10", icone: "⛽" },
  { chave: "GASOLINA COMUM", label: "Gasolina Comum", icone: "⛽" },
  { chave: "ETANOL HIDRATADO", label: "Etanol", icone: "🌱" },
];

type LinhaIndiceBrasil = {
  combustivel: string;
  preco_medio_rede: number;
  preco_medio_anp: number | null;
  qtd_postos: number;
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 });
}

function montarSecaoIndicePrecos(dados: LinhaIndiceBrasil[]): string {
  const porCombustivel = new Map(dados.map((d) => [d.combustivel, d]));
  const cards = COMBUSTIVEIS_DESTAQUE.map(({ chave, label, icone }) => {
    const linha = porCombustivel.get(chave);
    if (!linha) return null;
    const diffPct =
      linha.preco_medio_anp && linha.preco_medio_anp > 0
        ? ((linha.preco_medio_rede - linha.preco_medio_anp) / linha.preco_medio_anp) * 100
        : null;
    const corDiff = diffPct !== null && diffPct <= 0 ? "#4ade80" : "#f5a623";
    const diffHtml =
      diffPct !== null
        ? `<div style="margin-top:6px;font-size:0.78rem;color:${corDiff}">${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}% vs. média ANP</div>`
        : "";
    return `<div class="card"><div class="icon">${icone}</div><div class="ct">${label}</div><div style="font-family:'Outfit',sans-serif;font-size:2rem;font-weight:800;margin-top:8px;color:#fff">${formatarPreco(linha.preco_medio_rede)}<span style="font-size:0.85rem;font-weight:500;color:var(--gray)">/L</span></div>${diffHtml}<div style="margin-top:10px;font-size:0.75rem;color:var(--gray)">${linha.qtd_postos.toLocaleString("pt-BR")}+ postos monitorados</div></div>`;
  }).filter((c): c is string => c !== null);

  const corpoCards =
    cards.length > 0
      ? `<div class="grid" style="margin-top:40px">${cards.join("")}</div>`
      : `<p class="sec-sub">Em breve: preço médio de combustível por estado, com amostra ainda em formação.</p>`;

  return `<section class="section" id="indice-precos">
  <div class="sec-lbl">Dado Público e Gratuito</div>
  <div class="sec-title">Índice GF de Preço de Combustível</div>
  <p class="sec-sub">Preço médio nacional, agregado e anônimo, calculado a partir da rede de postos monitorada pela plataforma — comparado à referência da ANP, atualizado automaticamente.</p>
  ${corpoCards}
  <div style="text-align:center;margin-top:40px">
    <a href="/indice-precos" class="btn-p">Ver índice completo por estado →</a>
  </div>
</section>`;
}

// Raiz do domínio público (fxgestaodefrotasonline.com) — landing de
// marketing pra visitante anônimo, com CTA pro cadastro/login (Fase 26).
// Quem já está logado não precisa ver a landing de novo: manda direto pro
// dashboard, mesmo comportamento que "/" sempre teve antes de existir uma
// landing (o middleware libera "/" como rota pública pra isso não virar
// redirect-loop pra quem ainda não tem sessão — ver src/lib/supabase/middleware.ts).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  // Best-effort: se a RPC falhar por qualquer motivo, a seção cai no texto
  // de fallback (sem números) em vez de derrubar a landing inteira — nunca
  // vale a pena quebrar a página que converte visitante em trial por causa
  // de uma seção secundária.
  const { data: indiceRaw } = await supabase.rpc("indice_publico_precos_brasil");
  const secaoIndicePrecos = montarSecaoIndicePrecos((indiceRaw ?? []) as LinhaIndiceBrasil[]);
  const html = LANDING_BODY_HTML.replace("<!-- INDICE_PRECOS_PLACEHOLDER -->", secaoIndicePrecos);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: link direto no Server Component é o padrão suportado, o lint ainda assume Pages Router */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
