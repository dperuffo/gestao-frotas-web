import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
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
      <CabecalhoPagina titulo="📋 Nova tabela de frete" descricao={nomeEmpresaSelecionada} />
      <TabelaFreteForm
        empresaId={empresaSelecionada}
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, razaoSocial: p.razao_social, cnpjCpf: p.cnpj_cpf }))}
      />
    </div>
  );
}
