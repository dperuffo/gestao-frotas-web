import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import {
  agruparPorMunicipio,
  agruparPorPosto,
  agruparPorSemana,
  maioresDesvios,
  resumir,
  sugerirPostosMelhores,
  type LinhaAgregada,
  type RegistroAnp,
} from "@/lib/precoAnpDetalhe";

// Drill down do painel 10 do Dashboard (Preço pago vs. referência ANP). Responde "onde está o
// desvio?": por posto, município, semana e caso a caso, mais a sugestão de posto melhor na
// mesma cidade. Convenção de cor: âmbar = pagou acima da ANP; verde = abaixo.

const NOME_CATEGORIA: Record<string, string> = {
  "GASOLINA COMUM": "Gasolina comum",
  "GASOLINA ADITIVADA": "Gasolina aditivada / alta octanagem",
  ETANOL: "Etanol",
  "ETANOL HIDRATADO": "Etanol",
  "OLEO DIESEL": "Diesel S-500",
  "OLEO DIESEL S10": "Diesel S-10",
  GNV: "GNV",
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const preco = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const litros = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
// Impacto > 0 = pagou acima da ANP (custo a mais) => âmbar.
const cor = (impacto: number) => (impacto > 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400");

function paraDataISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function TabelaAgregada({ titulo, linhas, rotuloPrimeira, limite }: { titulo: string; linhas: LinhaAgregada[]; rotuloPrimeira: string; limite?: number }) {
  const visiveis = limite ? linhas.slice(0, limite) : linhas;
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
      {visiveis.length === 0 ? (
        <p className="text-sm text-slate-400">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-3">{rotuloPrimeira}</th>
                <th className="py-2 pr-3 text-right">Litros</th>
                <th className="py-2 pr-3 text-right">R$/L pago</th>
                <th className="py-2 pr-3 text-right">R$/L ANP</th>
                <th className="py-2 pr-3 text-right">Diferença</th>
                <th className="py-2 text-right">Impacto (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {visiveis.map((l) => (
                <tr key={l.chave}>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                    {l.rotulo}
                    {l.sub ? <span className="ml-1 text-xs text-slate-400">{l.sub}</span> : null}
                    {l.refMunicipio < l.qtd ? (
                      <span className="ml-1 text-[10px] text-slate-400" title="Parte da comparação usa a média do estado ou do Brasil, não a do município.">
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{litros(l.litros)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(l.precoPago)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(l.precoRef)}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums font-medium ${cor(l.impacto)}`}>{pct(l.pct)}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${cor(l.impacto)}`}>{moeda(l.impacto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function PrecoAnpDetalhePage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; mesAno?: string; cat?: string }>;
}) {
  const { empresa: empresaParam, mesAno, cat } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const agora = new Date();
  const [a, m] = (mesAno ?? `${agora.getFullYear()}-${agora.getMonth() + 1}`).split("-");
  const ano = Number(a) || agora.getFullYear();
  const mes = Math.min(12, Math.max(1, Number(m) || agora.getMonth() + 1));
  const inicio = paraDataISO(new Date(Date.UTC(ano, mes - 1, 1)));
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const fim = paraDataISO(new Date(Date.UTC(ano, mes - 1, mesAtual ? agora.getDate() : ultimoDia)));
  const rotuloMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const linkVoltar = `/dashboard?${new URLSearchParams({ ...(empresaSelecionada ? { empresa: empresaSelecionada } : {}), mesAno: `${ano}-${mes}` }).toString()}`;

  let todos: RegistroAnp[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase.rpc("cliente_preco_anp_detalhe", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: inicio,
      p_data_fim: fim,
    });
    todos = (data as unknown as RegistroAnp[] | null) ?? [];
  }

  const categorias = Array.from(new Set(todos.map((r) => r.ct)));
  const regs = cat ? todos.filter((r) => r.ct === cat) : todos;
  const resumo = resumir(regs);
  const porPosto = agruparPorPosto(regs);
  const porMunicipio = agruparPorMunicipio(regs);
  const porSemana = agruparPorSemana(regs);
  const desvios = maioresDesvios(regs, 20);
  const sugestoes = sugerirPostosMelhores(regs).slice(0, 10);
  const economiaPotencial = sugestoes.reduce((s, x) => s + x.economia, 0);

  const hrefCat = (c?: string) =>
    `/dashboard/preco-anp?${new URLSearchParams({ ...(empresaSelecionada ? { empresa: empresaSelecionada } : {}), mesAno: `${ano}-${mes}`, ...(c ? { cat: c } : {}) }).toString()}`;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Preço pago vs. referência ANP — detalhe"
        descricao={`${nomeEmpresaSelecionada ?? ""} — ${rotuloMes}${cat ? ` — ${NOME_CATEGORIA[cat] ?? cat}` : ""}`}
        acoes={
          <Link href={linkVoltar} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25">
            ← Voltar ao Dashboard
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link href={hrefCat()} className={`rounded-full border px-3 py-1 text-xs ${!cat ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"}`}>
          Todos
        </Link>
        {categorias.map((c) => (
          <Link key={c} href={hrefCat(c)} className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"}`}>
            {NOME_CATEGORIA[c] ?? c}
          </Link>
        ))}
      </div>

      {regs.length === 0 ? (
        <div className="card p-4 text-sm text-slate-500">Sem abastecimentos com referência ANP neste período.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pago (bomba)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{moeda(resumo.pago)}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Referência ANP</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{moeda(resumo.ref)}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{resumo.impacto > 0 ? "Acima da ANP" : "Abaixo da ANP"}</p>
              <p className={`mt-1 text-lg font-semibold ${cor(resumo.impacto)}`}>
                {moeda(Math.abs(resumo.impacto))} ({pct(resumo.pct)})
              </p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Economia potencial (mesma cidade)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{moeda(economiaPotencial)}</p>
            </div>
          </div>

          {sugestoes.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Onde agir: posto melhor na mesma cidade</h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Compara postos que a sua frota já usou, no mesmo município e combustível, e estima a economia se o volume fosse para o mais barato
                (só considera postos com pelo menos 100 L no período). É uma estimativa: confira bandeira, localização e rota antes de redirecionar.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Posto atual</th>
                      <th className="py-2 pr-3">Cidade</th>
                      <th className="py-2 pr-3 text-right">Litros</th>
                      <th className="py-2 pr-3 text-right">R$/L atual</th>
                      <th className="py-2 pr-3">Melhor posto</th>
                      <th className="py-2 pr-3 text-right">R$/L melhor</th>
                      <th className="py-2 text-right">Economia est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sugestoes.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{s.postoAtual}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{s.municipio}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{litros(s.litros)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(s.precoAtual)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{s.melhorPosto}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(s.melhorPreco)}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-green-700 dark:text-green-400">{moeda(s.economia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <TabelaAgregada titulo="Por posto (maior custo acima da ANP primeiro)" linhas={porPosto} rotuloPrimeira="Posto" limite={25} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TabelaAgregada titulo="Por município" linhas={porMunicipio} rotuloPrimeira="Município" limite={15} />
            <TabelaAgregada titulo="Por semana" linhas={porSemana.map((l) => ({ ...l, rotulo: `Semana de ${dataBr(l.chave)}` }))} rotuloPrimeira="Semana" />
          </div>

          <div className="card p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Maiores desvios, abastecimento a abastecimento</h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Os 20 que mais custaram acima da referência. Use para conferir com o motorista ou o posto.</p>
            {desvios.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum abastecimento acima da ANP.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Placa</th>
                      <th className="py-2 pr-3">Motorista</th>
                      <th className="py-2 pr-3">Posto</th>
                      <th className="py-2 pr-3">Produto</th>
                      <th className="py-2 pr-3 text-right">Litros</th>
                      <th className="py-2 pr-3 text-right">R$/L pago</th>
                      <th className="py-2 pr-3 text-right">R$/L ANP</th>
                      <th className="py-2 text-right">Impacto (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {desvios.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{dataBr(d.d)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{d.pl ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{d.mo ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{d.pn ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{d.pr ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{litros(d.l)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(d.precoPago)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{preco(d.rf)}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-amber-700 dark:text-amber-400">{moeda(d.impacto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            * Parte da comparação usa a média ANP do estado ou do Brasil, porque não há levantamento do município na semana. Descontos negociados
            não estão incluídos: o dado recebido traz só o preço de bomba.
          </p>
        </>
      )}
    </div>
  );
}
