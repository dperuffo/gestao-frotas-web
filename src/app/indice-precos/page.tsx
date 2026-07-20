import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TabelaIndicePrecos } from "./_components/TabelaIndicePrecos";

export const metadata: Metadata = {
  title: "Índice GF de Preço de Combustível | Gestão de Frotas",
  description:
    "Índice público e gratuito de preço de combustível por estado — dados agregados e anônimos da rede de postos monitorada pela Gestão de Frotas, comparados à referência nacional da ANP.",
};

const COMBUSTIVEL_LABEL: Record<string, string> = {
  "OLEO DIESEL": "Diesel Comum",
  "OLEO DIESEL S10": "Diesel S10",
  "ETANOL HIDRATADO": "Etanol",
  "GASOLINA COMUM": "Gasolina Comum",
  "GASOLINA ADITIVADA": "Gasolina Aditivada",
  GNV: "GNV",
  GLP: "GLP",
};

function formatarPreco(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 });
}

// Fase Índice-Público-de-Preço — item #3 de alta prioridade do benchmark
// TicketLog ("a IPTL é basicamente uma página pública alimentada pelos
// dados que eles já têm — nós também já cruzamos preço por UF/combustível
// via ANP e rede própria, falta só publicar uma versão agregada e anônima").
// Rota pública (liberada em src/lib/supabase/middleware.ts), sem exigir
// login — consome indice_publico_precos_uf/brasil(), que já vêm agregadas e
// só publicam célula com >= 3 postos distintos por trás da média (ver
// migration indice_publico_preco_combustivel).
export default async function IndicePrecosPage() {
  const supabase = await createClient();

  const [{ data: nacionalRaw }, { data: ufRaw }] = await Promise.all([
    supabase.rpc("indice_publico_precos_brasil"),
    supabase.rpc("indice_publico_precos_uf"),
  ]);

  const nacional = nacionalRaw ?? [];
  const linhasUf = ufRaw ?? [];
  const totalPostos = Math.max(...nacional.map((n) => n.qtd_postos), 0);
  const atualizadoEm = nacional
    .map((n) => n.atualizado_em)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  return (
    <div className="min-h-screen bg-[#04112e] font-[Outfit,sans-serif] text-white">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: link direto no Server Component é o padrão suportado, o lint ainda assume Pages Router */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <nav className="flex items-center justify-between border-b border-white/10 px-[6%] py-5">
        <div className="text-lg font-bold">
          FNI <span className="text-cyan-400">Gestão de Frotas</span>
        </div>
        <div className="flex gap-6 text-sm text-slate-300">
          <Link href="/" className="hover:text-cyan-400">
            Início
          </Link>
          <Link href="/sobre" className="hover:text-cyan-400">
            Sobre
          </Link>
          <a href="mailto:contato@fxgestaodefrotasonline.com" className="hover:text-cyan-400">
            Contato
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-[6%] py-16">
        <h1 className="mb-4 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-3xl font-bold text-transparent">
          Índice GF de Preço de Combustível
        </h1>
        <p className="mb-2 max-w-2xl text-slate-300">
          Preço médio de combustível por estado, calculado a partir da rede de postos monitorada pela
          plataforma Gestão de Frotas — dados <strong>agregados e anônimos</strong>, comparados à referência
          nacional da ANP.
        </p>
        <p className="mb-10 text-sm text-slate-500">
          {totalPostos > 0 ? `Amostra de ${totalPostos.toLocaleString("pt-BR")}+ postos monitorados` : ""}
          {atualizadoEm
            ? ` · atualizado em ${new Date(`${atualizadoEm}T00:00:00`).toLocaleDateString("pt-BR")}`
            : ""}
          . Só publicamos uma média quando há pelo menos 3 postos distintos por trás dela.
        </p>

        {nacional.length > 0 && (
          <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nacional.map((n) => {
              const diffPct =
                n.preco_medio_anp && n.preco_medio_anp > 0
                  ? ((n.preco_medio_rede - n.preco_medio_anp) / n.preco_medio_anp) * 100
                  : null;
              return (
                <div key={n.combustivel} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-wide text-cyan-300">
                    {COMBUSTIVEL_LABEL[n.combustivel] ?? n.combustivel}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{formatarPreco(n.preco_medio_rede)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Referência ANP: {formatarPreco(n.preco_medio_anp)}
                    {diffPct !== null && (
                      <span className={diffPct <= 0 ? "ml-2 text-emerald-400" : "ml-2 text-amber-400"}>
                        ({diffPct > 0 ? "+" : ""}
                        {diffPct.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {n.qtd_postos.toLocaleString("pt-BR")} postos · {n.qtd_ufs} estados
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mb-4 text-lg font-semibold text-cyan-300">Detalhamento por estado</h2>
        {linhasUf.length > 0 ? (
          <TabelaIndicePrecos linhas={linhasUf} />
        ) : (
          <p className="text-sm text-slate-400">
            Ainda não temos amostra suficiente pra publicar o índice. Volte em breve.
          </p>
        )}
      </div>

      <footer className="mt-16 border-t border-white/5 px-[6%] py-8 text-center text-sm text-slate-500">
        <p>
          <Link href="/termos" className="text-cyan-400 hover:underline">
            Termos de Uso
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" className="text-cyan-400 hover:underline">
            Privacidade
          </Link>{" "}
          ·{" "}
          <Link href="/sobre" className="text-cyan-400 hover:underline">
            Sobre nós
          </Link>
        </p>
        <p className="mt-3">© 2026 Fleet Network Intelligence Ltda. — Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
