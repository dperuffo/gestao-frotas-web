import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovaPecaForm } from "../_components/NovaPecaForm";

export default async function NovaPecaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente em <Link href="/estoque-pecas" className="underline">Estoque de Peças</Link> antes de cadastrar uma nova peça.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/estoque-pecas?empresa=${empresaSelecionada}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Nova Peça</h1>
      </div>
      <NovaPecaForm empresaId={empresaSelecionada} />
    </div>
  );
}
