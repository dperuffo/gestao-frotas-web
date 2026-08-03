import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ClienteForm } from "../_components/ClienteForm";

export default async function NovoClienteCrmPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="p-4 text-sm text-slate-500">
          Selecione uma empresa em{" "}
          <Link href="/crm-comercial" className="text-frota-600 hover:underline">
            CRM Comercial
          </Link>{" "}
          antes de cadastrar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🤝 Novo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>
      </div>
      <ClienteForm empresaId={empresaSelecionada} modo="criar" />
    </div>
  );
}
