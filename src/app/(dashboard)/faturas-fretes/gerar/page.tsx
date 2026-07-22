import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ListaTomadoresPendentes, type TomadorPendente } from "../_components/GerarFaturaFreteForm";

export default async function GerarFaturaFretePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="p-4 text-sm text-slate-500">
          Selecione uma empresa em{" "}
          <Link href="/faturas-fretes" className="text-frota-600 hover:underline">
            Faturas de Frete
          </Link>{" "}
          antes de gerar.
        </p>
      </div>
    );
  }

  const { data: fretesDaEmpresa } = await supabase.from("fretes").select("id").eq("empresa_id", empresaSelecionada);
  const freteIds = (fretesDaEmpresa ?? []).map((f) => f.id);

  let tomadores: TomadorPendente[] = [];
  if (freteIds.length > 0) {
    const { data: ctes } = await supabase
      .from("fretes_cte")
      .select("tomador_cnpj, tomador_nome, valor_prestacao, data_emissao")
      .in("frete_id", freteIds)
      .eq("status", "autorizado")
      .is("fatura_frete_id", null);

    const porTomador = new Map<string, TomadorPendente>();
    for (const c of ctes ?? []) {
      if (!c.tomador_cnpj) continue;
      const dataEmissao = (c.data_emissao ?? new Date().toISOString()).slice(0, 10);
      const atual = porTomador.get(c.tomador_cnpj);
      if (!atual) {
        porTomador.set(c.tomador_cnpj, {
          tomadorCnpj: c.tomador_cnpj,
          tomadorNome: c.tomador_nome,
          quantidade: 1,
          valorTotal: c.valor_prestacao ?? 0,
          dataMin: dataEmissao,
          dataMax: dataEmissao,
        });
      } else {
        atual.quantidade += 1;
        atual.valorTotal += c.valor_prestacao ?? 0;
        if (dataEmissao < atual.dataMin) atual.dataMin = dataEmissao;
        if (dataEmissao > atual.dataMax) atual.dataMax = dataEmissao;
      }
    }
    tomadores = Array.from(porTomador.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🧾 Gerar fatura de frete</h1>
        <p className="mt-1 text-sm text-slate-500">
          {nomeEmpresaSelecionada} — CT-es autorizados agrupados por tomador, ainda não faturados.
        </p>
      </div>
      <ListaTomadoresPendentes empresaId={empresaSelecionada} tomadores={tomadores} />
      <div className="mt-6">
        <Link href={`/faturas-fretes?empresa=${empresaSelecionada}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar para Faturas de Frete
        </Link>
      </div>
    </div>
  );
}
