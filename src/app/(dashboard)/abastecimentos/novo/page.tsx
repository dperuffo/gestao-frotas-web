import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AbastecimentoForm } from "../_components/AbastecimentoForm";
import { FormAbastecimentoInterno } from "../_components/FormAbastecimentoInterno";

// Fase Abastecimento-Interno (21/08/2026) — a mesma tela de "Lançar
// Abastecimento Manual" agora cobre as 2 fontes: posto externo (formulário
// já existente, grava em profrotas_abastecimentos) e posto interno
// (formulário novo, grava em abastecimentos_internos). Escolha por query
// param simples, mesmo padrão de abas usado em /postos (?visao=).
export default async function NovoAbastecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string }>;
}) {
  const { fonte } = await searchParams;
  const fonteAtual = fonte === "interno" ? "interno" : "externo";

  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Lançar Abastecimento Manual</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <AbaLink fonte="externo" ativo={fonteAtual === "externo"}>
          Posto Externo
        </AbaLink>
        <AbaLink fonte="interno" ativo={fonteAtual === "interno"}>
          Posto Interno
        </AbaLink>
      </div>

      {fonteAtual === "interno" ? (
        <FormAbastecimentoInterno empresas={empresas ?? []} />
      ) : (
        <AbastecimentoForm empresas={empresas ?? []} />
      )}
    </div>
  );
}

function AbaLink({ fonte, ativo, children }: { fonte: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={`/abastecimentos/novo?fonte=${fonte}`}
      className={
        "border-b-2 px-3 py-2 text-sm font-medium " +
        (ativo ? "border-frota-600 text-frota-600" : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </Link>
  );
}
