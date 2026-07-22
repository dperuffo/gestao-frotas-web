import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { CotacaoForm, type TipoCargaOpcao } from "../_components/CotacaoForm";

export default async function NovaCotacaoPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="p-4 text-sm text-slate-500">
          Selecione uma empresa em{" "}
          <Link href="/cotacoes" className="text-frota-600 hover:underline">
            Cotações
          </Link>{" "}
          antes de simular.
        </p>
      </div>
    );
  }

  const [{ data: tabelas }, { data: parceiros }, { data: pisos }] = await Promise.all([
    supabase.from("tabelas_frete").select("id, nome, cliente_tomador_id").eq("empresa_id", empresaSelecionada).eq("ativo", true).order("nome"),
    supabase.from("cadastros_parceiros").select("id, razao_social").eq("empresa_id", empresaSelecionada).eq("papel", "tomador").order("razao_social"),
    supabase.from("pisos_antt").select("tipo_carga, numero_eixos").order("tipo_carga").order("numero_eixos"),
  ]);

  const tiposCargaMap = new Map<string, number[]>();
  for (const p of pisos ?? []) {
    const lista = tiposCargaMap.get(p.tipo_carga) ?? [];
    lista.push(p.numero_eixos);
    tiposCargaMap.set(p.tipo_carga, lista);
  }
  const tiposCarga: TipoCargaOpcao[] = Array.from(tiposCargaMap.entries()).map(([tipoCarga, numerosEixos]) => ({
    tipoCarga,
    numerosEixos,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🧮 Nova cotação</h1>
        <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>
      </div>
      <CotacaoForm
        empresaId={empresaSelecionada}
        tabelas={(tabelas ?? []).map((t) => ({ id: t.id, nome: t.nome, clienteTomadorId: t.cliente_tomador_id }))}
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, razaoSocial: p.razao_social }))}
        tiposCarga={tiposCarga}
      />
    </div>
  );
}
