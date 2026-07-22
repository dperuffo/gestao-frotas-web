import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { TabelaFreteForm } from "../_components/TabelaFreteForm";

export default async function NovaTabelaFretePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="p-4 text-sm text-slate-500">
          Selecione uma empresa em{" "}
          <Link href="/tabelas-frete" className="text-frota-600 hover:underline">
            Tabelas de Frete
          </Link>{" "}
          antes de criar.
        </p>
      </div>
    );
  }

  const { data: parceiros } = await supabase
    .from("cadastros_parceiros")
    .select("id, razao_social, cnpj_cpf")
    .eq("empresa_id", empresaSelecionada)
    .eq("papel", "tomador")
    .order("razao_social");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">📋 Nova tabela de frete</h1>
        <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>
      </div>
      <TabelaFreteForm
        empresaId={empresaSelecionada}
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, razaoSocial: p.razao_social, cnpjCpf: p.cnpj_cpf }))}
      />
    </div>
  );
}
